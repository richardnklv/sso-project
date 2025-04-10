import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db, { DatabaseError } from '../database';
import { User } from './user';
import { Client } from './client';
import { ACCESS_TOKEN_BYTES, ACCESS_TOKEN_EXPIRATION_SECONDS } from '../constants';
import { CreateTokenParams, ValidateTokenParams } from '../types/token';

/**
 * Error for when an access token is not found
 */
export class AccessTokenNotFoundError extends Error {
  constructor(token: string) {
    super(`Access token not found: ${token}`);
    this.name = 'AccessTokenNotFoundError';
  }
}

/**
 * Error for when an access token is invalid
 */
export class InvalidAccessTokenError extends Error {
  constructor(message = 'Invalid access token') {
    super(message);
    this.name = 'InvalidAccessTokenError';
  }
}

// Define the AccessToken interface that matches our database schema
export interface AccessToken {
  id: string;
  token: string;
  user_id: string;
  client_id: string;
  expires_at: Date;
  scope: string | null;
  created_at: Date;
}

/**
 * AccessToken model with methods to interact with the access_tokens table
 */
export class AccessTokenModel {
  /**
   * Create a new access token
   * @param params Parameters for creating the token
   * @returns The created access token
   */
  static async create(params: CreateTokenParams): Promise<AccessToken> {
    const { 
      userId, 
      clientId, 
      scope, 
      expiresInSeconds = ACCESS_TOKEN_EXPIRATION_SECONDS 
    } = params;
    
    // Generate a secure token
    const token = this.generateToken();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);
    
    // Insert the access token into the database
    const result = await db.query<AccessToken>(
      `INSERT INTO access_tokens (id, token, user_id, client_id, expires_at, scope) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [uuidv4(), token, userId, clientId, expiresAt, scope || null]
    );
    
    return result.rows[0];
  }

  /**
   * Find an access token by its token string
   * @param token The token string to search for
   * @returns The access token if found, null otherwise
   */
  static async findByToken(token: string): Promise<AccessToken | null> {
    const result = await db.query<AccessToken>(
      'SELECT * FROM access_tokens WHERE token = $1',
      [token]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Find all access tokens for a user
   * @param userId The ID of the user
   * @returns Array of access tokens
   */
  static async findByUserId(userId: string): Promise<AccessToken[]> {
    const result = await db.query<AccessToken>(
      'SELECT * FROM access_tokens WHERE user_id = $1',
      [userId]
    );
    
    return result.rows;
  }

  /**
   * Find all access tokens for a client
   * @param clientId The ID of the client
   * @returns Array of access tokens
   */
  static async findByClientId(clientId: string): Promise<AccessToken[]> {
    const result = await db.query<AccessToken>(
      'SELECT * FROM access_tokens WHERE client_id = $1',
      [clientId]
    );
    
    return result.rows;
  }

  /**
   * Validate an access token
   * This checks if the token exists, hasn't expired, and the user hasn't changed their password
   * @param params Parameters for validating the token
   * @returns The access token if valid
   * @throws InvalidAccessTokenError if the token is invalid
   * @throws AccessTokenNotFoundError if the token is not found
   */
  static async validate(params: ValidateTokenParams): Promise<AccessToken> {
    const { token, userId, checkPasswordChange = true } = params;
    
    // Find the token
    const accessToken = await this.findByToken(token);
    
    // If the token doesn't exist, it's invalid
    if (!accessToken) {
      throw new AccessTokenNotFoundError(token);
    }
    
    // Check if the token has expired
    if (new Date() > accessToken.expires_at) {
      throw new InvalidAccessTokenError('Access token has expired');
    }
    
    // If checking password changes and userId is provided, check if the token was issued before the password was changed
    if (checkPasswordChange && userId) {
      const result = await db.query<{ password_changed_at: Date }>(
        'SELECT password_changed_at FROM users WHERE id = $1',
        [userId]
      );
      
      if (result.rows.length > 0) {
        // Get the user's password_changed_at timestamp
        const passwordChangedAt = new Date(result.rows[0].password_changed_at);
        
        // Get the token's created_at timestamp
        const tokenCreatedAt = new Date(accessToken.created_at);
        
        // If the password was changed after the token was created, the token is invalid
        if (passwordChangedAt > tokenCreatedAt) {
          throw new InvalidAccessTokenError('Password changed since token was issued');
        }
      }
    }
    
    return accessToken;
  }

  /**
   * Validate an access token without throwing errors
   * @param params Parameters for validating the token
   * @returns The access token if valid, null otherwise
   */
  static async validateSafe(params: ValidateTokenParams): Promise<AccessToken | null> {
    try {
      return await this.validate(params);
    } catch (error) {
      if (error instanceof AccessTokenNotFoundError || error instanceof InvalidAccessTokenError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Revoke an access token
   * @param token The token string to revoke
   * @returns True if the token was revoked, false otherwise
   */
  static async revoke(token: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM access_tokens WHERE token = $1 RETURNING id',
      [token]
    );
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Revoke all access tokens for a user
   * @param userId The ID of the user
   * @returns Number of tokens revoked
   */
  static async revokeAllForUser(userId: string): Promise<number> {
    const result = await db.query(
      'DELETE FROM access_tokens WHERE user_id = $1',
      [userId]
    );
    
    return result.rowCount ?? 0;
  }

  /**
   * Generate a secure token string
   * @returns A random token string
   */
  private static generateToken(): string {
    return crypto.randomBytes(ACCESS_TOKEN_BYTES).toString('hex');
  }
}