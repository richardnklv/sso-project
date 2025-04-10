import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db, { DatabaseError } from '../database';
import { User } from './user';
import { Client } from './client';
import { REFRESH_TOKEN_BYTES, REFRESH_TOKEN_EXPIRATION_SECONDS } from '../constants';
import { CreateTokenParams, ValidateTokenParams } from '../types/token';

/**
 * Error for when a refresh token is not found
 */
export class RefreshTokenNotFoundError extends Error {
  constructor(token: string) {
    super(`Refresh token not found: ${token}`);
    this.name = 'RefreshTokenNotFoundError';
  }
}

/**
 * Error for when a refresh token is invalid
 */
export class InvalidRefreshTokenError extends Error {
  constructor(message = 'Invalid refresh token') {
    super(message);
    this.name = 'InvalidRefreshTokenError';
  }
}

// Define the RefreshToken interface that matches our database schema
export interface RefreshToken {
  id: string;
  token: string;
  user_id: string;
  client_id: string;
  expires_at: Date;
  scope: string | null;
  created_at: Date;
}

/**
 * RefreshToken model with methods to interact with the refresh_tokens table
 */
export class RefreshTokenModel {
  /**
   * Create a new refresh token
   * @param params Parameters for creating the token
   * @returns The created refresh token
   */
  static async create(params: CreateTokenParams): Promise<RefreshToken> {
    const { 
      userId, 
      clientId, 
      scope, 
      expiresInSeconds = REFRESH_TOKEN_EXPIRATION_SECONDS 
    } = params;
    
    // Generate a secure token
    const token = this.generateToken();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);
    
    // Insert the refresh token into the database
    const result = await db.query<RefreshToken>(
      `INSERT INTO refresh_tokens (id, token, user_id, client_id, expires_at, scope) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [uuidv4(), token, userId, clientId, expiresAt, scope || null]
    );
    
    return result.rows[0];
  }

  /**
   * Find a refresh token by its token string
   * @param token The token string to search for
   * @returns The refresh token if found, null otherwise
   */
  static async findByToken(token: string): Promise<RefreshToken | null> {
    const result = await db.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE token = $1',
      [token]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Find all refresh tokens for a user
   * @param userId The ID of the user
   * @returns Array of refresh tokens
   */
  static async findByUserId(userId: string): Promise<RefreshToken[]> {
    const result = await db.query<RefreshToken>(
      'SELECT * FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
    
    return result.rows;
  }

  /**
   * Validate a refresh token
   * This checks if the token exists, hasn't expired, and the user hasn't changed their password
   * @param params Parameters for validating the token
   * @returns The refresh token if valid
   * @throws InvalidRefreshTokenError if the token is invalid
   * @throws RefreshTokenNotFoundError if the token is not found
   */
  static async validate(params: ValidateTokenParams): Promise<RefreshToken> {
    const { token, userId, checkPasswordChange = true } = params;
    
    // Find the token
    const refreshToken = await this.findByToken(token);
    
    // If the token doesn't exist, it's invalid
    if (!refreshToken) {
      throw new RefreshTokenNotFoundError(token);
    }
    
    // Check if the token has expired
    if (new Date() > refreshToken.expires_at) {
      throw new InvalidRefreshTokenError('Refresh token has expired');
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
        const tokenCreatedAt = new Date(refreshToken.created_at);
        
        // If the password was changed after the token was created, the token is invalid
        if (passwordChangedAt > tokenCreatedAt) {
          throw new InvalidRefreshTokenError('Password changed since token was issued');
        }
      }
    }
    
    return refreshToken;
  }

  /**
   * Validate a refresh token without throwing errors
   * @param params Parameters for validating the token
   * @returns The refresh token if valid, null otherwise
   */
  static async validateSafe(params: ValidateTokenParams): Promise<RefreshToken | null> {
    try {
      return await this.validate(params);
    } catch (error) {
      if (error instanceof RefreshTokenNotFoundError || error instanceof InvalidRefreshTokenError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Revoke a refresh token
   * @param token The token string to revoke
   * @returns True if the token was revoked, false otherwise
   */
  static async revoke(token: string): Promise<boolean> {
    const result = await db.query(
      'DELETE FROM refresh_tokens WHERE token = $1 RETURNING id',
      [token]
    );
    
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Revoke all refresh tokens for a user
   * @param userId The ID of the user
   * @returns Number of tokens revoked
   */
  static async revokeAllForUser(userId: string): Promise<number> {
    const result = await db.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
    
    return result.rowCount ?? 0;
  }

  /**
   * Generate a secure token string
   * @returns A random token string
   */
  private static generateToken(): string {
    return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  }
}