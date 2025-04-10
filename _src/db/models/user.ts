import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import db, { DatabaseError } from '../database';
import { SALT_ROUNDS } from '../constants';

/**
 * Error for when a user is not found
 */
export class UserNotFoundError extends Error {
  constructor(identifier: string) {
    super(`User not found: ${identifier}`);
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error for authentication failures
 */
export class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Define the User interface that matches our database schema
export interface User {
  id: string;
  username: string;
  password_hash: string;
  password_changed_at: Date;
  created_at: Date;
  updated_at: Date;
}

// User data transfer object - used for returning user data without sensitive information
export interface UserDTO {
  id: string;
  username: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * User model with methods to interact with the users table
 */
export class UserModel {
  /**
   * Create a new user
   * @param username The username for the new user
   * @param password The plaintext password for the new user (will be hashed)
   * @returns The created user without password hash
   */
  static async create(username: string, password: string): Promise<UserDTO> {
    // Generate a salt and hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // Insert the user into the database
    const result = await db.query<UserDTO>(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id, username, created_at, updated_at',
      [uuidv4(), username, passwordHash]
    );
    
    return result.rows[0];
  }

  /**
   * Find a user by their username
   * @param username The username to search for
   * @returns The user if found, null otherwise
   */
  static async findByUsername(username: string): Promise<User | null> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Find a user by their ID
   * @param id The user ID to search for
   * @returns The user if found, null otherwise
   * @throws UserNotFoundError if the user is not found
   */
  static async findById(id: string): Promise<User> {
    const result = await db.query<User>(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new UserNotFoundError(id);
    }
    
    return result.rows[0];
  }

  /**
   * Find a user by their ID, returning null if not found instead of throwing
   * @param id The user ID to search for
   * @returns The user if found, null otherwise
   */
  static async findByIdSafe(id: string): Promise<User | null> {
    try {
      return await UserModel.findById(id);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Verify a user's password
   * @param user The user to verify the password for
   * @param password The plaintext password to verify
   * @returns True if the password is correct, false otherwise
   */
  static async verifyPassword(user: User, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password_hash);
  }

  /**
   * Change a user's password and invalidate all sessions
   * @param id The ID of the user
   * @param newPassword The new plaintext password
   * @returns The updated user without password hash
   * @throws UserNotFoundError if the user is not found
   */
  static async changePassword(id: string, newPassword: string): Promise<UserDTO> {
    // Start a transaction
    return db.transaction(async (client) => {
      // Generate a salt and hash the new password
      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      
      // Update the user's password and password_changed_at timestamp
      // The password_changed_at update is what invalidates all existing sessions
      const result = await client.query<UserDTO>(
        `UPDATE users 
         SET password_hash = $1, 
             password_changed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, username, created_at, updated_at`,
        [passwordHash, id]
      );
      
      // If no user was found, throw an error
      if (result.rows.length === 0) {
        throw new UserNotFoundError(id);
      }
      
      return result.rows[0];
    });
  }

  /**
   * Authenticate a user with username and password
   * @param username The username
   * @param password The plaintext password
   * @returns The authenticated user if successful, null otherwise
   */
  static async authenticate(username: string, password: string): Promise<UserDTO | null> {
    // Find the user by username
    const user = await this.findByUsername(username);
    
    // If no user was found or the password is incorrect, return null
    if (!user || !(await this.verifyPassword(user, password))) {
      return null;
    }
    
    // Return the user DTO (without password hash)
    return this.toDTO(user);
  }

  /**
   * Converts a User to a UserDTO by removing sensitive information
   * @param user The user to convert
   * @returns The user data transfer object
   */
  static toDTO(user: User): UserDTO {
    return {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }
}