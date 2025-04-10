import { v4 as uuidv4 } from 'uuid';
import db, { DatabaseError } from '../database';

/**
 * Error for when a client is not found
 */
export class ClientNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Client not found: ${identifier}`);
    this.name = 'ClientNotFoundError';
  }
}

/**
 * Error for client validation issues
 */
export class InvalidClientError extends Error {
  constructor(message = 'Invalid client') {
    super(message);
    this.name = 'InvalidClientError';
  }
}

// Define the Client interface that matches our database schema
export interface Client {
  id: string;
  client_id: string;
  client_secret: string | null;
  client_type: 'confidential' | 'public';
  redirect_uris: string[];
  created_at: Date;
}

/**
 * Parameters for creating a client
 */
export interface CreateClientParams {
  clientId: string;
  clientType: 'confidential' | 'public';
  redirectUris: string[];
  clientSecret?: string | null;
}

/**
 * Client model with methods to interact with the clients table
 */
export class ClientModel {
  /**
   * Create a new client application
   * @param params Parameters for creating the client
   * @returns The created client
   * @throws InvalidClientError if the client parameters are invalid
   */
  static async create(params: CreateClientParams): Promise<Client> {
    const { clientId, clientType, redirectUris, clientSecret } = params;
    
    // For confidential clients, we require a client secret
    if (clientType === 'confidential' && !clientSecret) {
      throw new InvalidClientError('Client secret is required for confidential clients');
    }

    // For public clients, client secret should be null
    const finalClientSecret = clientType === 'public' ? null : clientSecret;
    
    // Insert the client into the database
    const result = await db.query<Client>(
      'INSERT INTO clients (id, client_id, client_secret, client_type, redirect_uris) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [uuidv4(), clientId, finalClientSecret, clientType, redirectUris]
    );
    
    return result.rows[0];
  }

  /**
   * Find a client by its client_id
   * @param clientId The client_id to search for
   * @returns The client if found, null otherwise
   */
  static async findByClientId(clientId: string): Promise<Client | null> {
    const result = await db.query<Client>(
      'SELECT * FROM clients WHERE client_id = $1',
      [clientId]
    );
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Find a client by its internal ID
   * @param id The internal ID to search for
   * @returns The client if found
   * @throws ClientNotFoundError if the client is not found
   */
  static async findById(id: string): Promise<Client> {
    const result = await db.query<Client>(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new ClientNotFoundError(id);
    }
    
    return result.rows[0];
  }

  /**
   * Find a client by its internal ID, returning null if not found instead of throwing
   * @param id The internal ID to search for
   * @returns The client if found, null otherwise
   */
  static async findByIdSafe(id: string): Promise<Client | null> {
    try {
      return await ClientModel.findById(id);
    } catch (error) {
      if (error instanceof ClientNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Verify a client's credentials
   * @param clientId The client_id
   * @param clientSecret The client_secret
   * @returns The client if the credentials are valid, null otherwise
   */
  static async verifyClientCredentials(clientId: string, clientSecret: string): Promise<Client | null> {
    // Find the client by client_id
    const client = await this.findByClientId(clientId);
    
    // If no client was found, return null
    if (!client) {
      return null;
    }
    
    // For public clients, we don't verify the client_secret
    if (client.client_type === 'public') {
      return client;
    }
    
    // For confidential clients, we verify the client_secret
    if (client.client_secret === clientSecret) {
      return client;
    }
    
    // If the client_secret is invalid, return null
    return null;
  }

  /**
   * Validate a redirect URI for a client
   * @param client The client
   * @param redirectUri The redirect URI to validate
   * @returns True if the redirect URI is valid, false otherwise
   */
  static validateRedirectUri(client: Client, redirectUri: string): boolean {
    return client.redirect_uris.includes(redirectUri);
  }
}