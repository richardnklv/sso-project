import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db, { DatabaseError } from '../database';
import { User } from './user';
import { AUTH_CODE_BYTES, AUTH_CODE_EXPIRATION_SECONDS } from '../constants';
import { CreateAuthCodeParams, ValidateAuthCodeParams } from '../types/authCode';

/**
 * Error for when an authorization code is not found
 */
export class AuthCodeNotFoundError extends Error {
  constructor(code: string) {
    super(`Authorization code not found: ${code}`);
    this.name = 'AuthCodeNotFoundError';
  }
}

/**
 * Error for when an authorization code is invalid
 */
export class InvalidAuthCodeError extends Error {
  constructor(message = 'Invalid authorization code') {
    super(message);
    this.name = 'InvalidAuthCodeError';
  }
}

// Define the AuthorizationCode interface that matches our database schema
export interface AuthorizationCode {
  id: string;
  code: string;
  user_id: string;
  client_id: string;
  redirect_uri: string;
  expires_at: Date;
  scope: string | null;
  code_challenge: string | null;
  code_challenge_method: 'plain' | 'S256' | null;
  created_at: Date;
}

/**
 * AuthorizationCode model with methods to interact with the authorization_codes table
 */
export class AuthCodeModel {
  /**
   * Create a new authorization code
   * @param params Parameters for creating the authorization code
   * @returns The created authorization code
   */
  static async create(params: CreateAuthCodeParams): Promise<AuthorizationCode> {
    const {
      userId,
      clientId,
      redirectUri,
      scope,
      codeChallenge,
      codeChallengeMethod,
      expiresInSeconds = AUTH_CODE_EXPIRATION_SECONDS
    } = params;
    
    // Generate a secure authorization code
    const code = this.generateCode();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);
    
    // Insert the authorization code into the database
    const result = await db.query<AuthorizationCode>(
      `INSERT INTO authorization_codes (
        id, code, user_id, client_id, redirect_uri, expires_at, scope, 
        code_challenge, code_challenge_method
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`,
      [
        uuidv4(), code, userId, clientId, redirectUri, expiresAt, 
        scope || null, codeChallenge || null, codeChallengeMethod || null
      ]
    );
    
    return result.rows[0];
  }

  /**
   * Find an authorization code by its code string
   * @param code The code string to search for
   * @returns The authorization code if found, null otherwise
   */
  static async findByCode(code: string): Promise<AuthorizationCode | null> {
    const result = await db.query<AuthorizationCode>(
      'SELECT * FROM authorization_codes WHERE code = $1',
      [code]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Validate an authorization code
   * This checks if the code exists, hasn't expired, and the user hasn't changed their password
   * @param params Parameters for validating the authorization code
   * @returns The authorization code if valid
   * @throws InvalidAuthCodeError if the code is invalid
   * @throws AuthCodeNotFoundError if the code is not found
   */
  static async validate(params: ValidateAuthCodeParams): Promise<AuthorizationCode> {
    const { code, redirectUri, codeVerifier, userId } = params;
    
    // Find the code
    const authCode = await this.findByCode(code);
    
    // If the code doesn't exist, it's invalid
    if (!authCode) {
      throw new AuthCodeNotFoundError(code);
    }
    
    // Check if the code has expired
    if (new Date() > authCode.expires_at) {
      throw new InvalidAuthCodeError('Authorization code has expired');
    }
    
    // Check if the redirect URI matches
    if (authCode.redirect_uri !== redirectUri) {
      throw new InvalidAuthCodeError('Redirect URI mismatch');
    }
    
    // If PKCE is being used, validate the code verifier
    if (authCode.code_challenge && codeVerifier) {
      const isValidCodeVerifier = this.validateCodeVerifier(
        codeVerifier,
        authCode.code_challenge,
        authCode.code_challenge_method
      );
      
      if (!isValidCodeVerifier) {
        throw new InvalidAuthCodeError('Invalid code verifier');
      }
    }
    
    // If user is provided, check if the code was issued before the password was changed
    if (userId) {
      const result = await db.query<{ password_changed_at: Date }>(
        'SELECT password_changed_at FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        // Get the user's password_changed_at timestamp
        const passwordChangedAt = new Date(result.rows[0].password_changed_at);
        
        // Get the code's created_at timestamp
        const codeCreatedAt = new Date(authCode.created_at);
        
        // If the password was changed after the code was created, the code is invalid
        if (passwordChangedAt > codeCreatedAt) {
          throw new InvalidAuthCodeError('Password changed since code was issued');
        }
      }
    }
    
    return authCode;
  }

  /**
   * Consume an authorization code (delete it after use)
   * @param code The code string to consume
   * @returns True if the code was consumed, false otherwise
   */
  static async consume(code: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM authorization_codes WHERE code = $1 RETURNING id',
      [code]
    );
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Generate a secure authorization code
   * @returns A random authorization code
   */
  private static generateCode(): string {
    return crypto.randomBytes(AUTH_CODE_BYTES).toString('hex');
  }

  /**
   * Validate a PKCE code verifier against a code challenge
   * @param codeVerifier The code verifier from the client
   * @param codeChallenge The code challenge stored during authorization
   * @param codeChallengeMethod The method used to create the code challenge
   * @returns True if the code verifier is valid, false otherwise
   */
  private static validateCodeVerifier(
    codeVerifier: string,
    codeChallenge: string,
    codeChallengeMethod: 'plain' | 'S256' | null
  ): boolean {
    // If the method is 'plain', simply compare the verifier to the challenge
    if (!codeChallengeMethod || codeChallengeMethod === 'plain') {
      return codeVerifier === codeChallenge;
    }
    
    // If the method is 'S256', hash the verifier and compare to the challenge
    if (codeChallengeMethod === 'S256') {
      const hash = crypto.createHash('sha256')
        .update(codeVerifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      
      return hash === codeChallenge;
    }
    
    return false;
  }
}