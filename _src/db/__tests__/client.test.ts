import { ClientModel, ClientNotFoundError, InvalidClientError } from '../models/client';

describe('ClientModel', () => {
  let testClient: { id: string; client_id: string };

  beforeEach(async () => {
    // Create a test client before each test
    testClient = await ClientModel.create({
      clientId: 'test-client',
      clientType: 'confidential',
      redirectUris: ['https://test.com/callback'],
      clientSecret: 'secret123'
    });
  });

  describe('create', () => {
    it('should create a confidential client with secret', async () => {
      // Act
      const client = await ClientModel.create({
        clientId: 'confidential-client',
        clientType: 'confidential',
        redirectUris: ['https://example.com/callback'],
        clientSecret: 'secret456'
      });
      
      // Assert
      expect(client).toBeDefined();
      expect(client.client_id).toBe('confidential-client');
      expect(client.client_type).toBe('confidential');
      expect(client.client_secret).toBe('secret456');
      expect(client.redirect_uris).toEqual(['https://example.com/callback']);
    });

    it('should create a public client with null secret', async () => {
      // Act
      const client = await ClientModel.create({
        clientId: 'public-client',
        clientType: 'public',
        redirectUris: ['https://example.com/callback']
      });
      
      // Assert
      expect(client).toBeDefined();
      expect(client.client_id).toBe('public-client');
      expect(client.client_type).toBe('public');
      expect(client.client_secret).toBeNull();
    });

    it('should throw error when confidential client has no secret', async () => {
      // Act & Assert
      await expect(ClientModel.create({
        clientId: 'confidential-client-no-secret',
        clientType: 'confidential',
        redirectUris: ['https://example.com/callback']
      })).rejects.toThrow(InvalidClientError);
    });
  });

  describe('findByClientId', () => {
    it('should find a client by client_id', async () => {
      // Act
      const client = await ClientModel.findByClientId('test-client');
      
      // Assert
      expect(client).toBeDefined();
      expect(client?.client_id).toBe('test-client');
    });

    it('should return null if client not found', async () => {
      // Act
      const client = await ClientModel.findByClientId('nonexistent-client');
      
      // Assert
      expect(client).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find a client by ID', async () => {
      // Act
      const client = await ClientModel.findById(testClient.id);
      
      // Assert
      expect(client).toBeDefined();
      expect(client.id).toBe(testClient.id);
    });

    it('should throw ClientNotFoundError if client not found', async () => {
      // Act & Assert
      await expect(ClientModel.findById('00000000-0000-0000-0000-000000000000')).rejects.toThrow(ClientNotFoundError);
    });
  });

  describe('verifyClientCredentials', () => {
    it('should verify confidential client with correct secret', async () => {
      // Act
      const client = await ClientModel.verifyClientCredentials('test-client', 'secret123');
      
      // Assert
      expect(client).toBeDefined();
      expect(client?.client_id).toBe('test-client');
    });

    it('should reject confidential client with incorrect secret', async () => {
      // Act
      const client = await ClientModel.verifyClientCredentials('test-client', 'wrong-secret');
      
      // Assert
      expect(client).toBeNull();
    });

    it('should verify public client without checking secret', async () => {
      // Arrange - Create a public client
      await ClientModel.create({
        clientId: 'public-test-client',
        clientType: 'public',
        redirectUris: ['https://example.com/callback']
      });
      
      // Act - Even with wrong secret, public client should verify
      const client = await ClientModel.verifyClientCredentials('public-test-client', 'any-secret');
      
      // Assert
      expect(client).toBeDefined();
      expect(client?.client_id).toBe('public-test-client');
      expect(client?.client_type).toBe('public');
    });
  });

  describe('validateRedirectUri', () => {
    it('should validate a registered redirect URI', async () => {
      // Arrange
      const client = await ClientModel.findByClientId('test-client');
      
      // Act
      const isValid = ClientModel.validateRedirectUri(client!, 'https://test.com/callback');
      
      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject an unregistered redirect URI', async () => {
      // Arrange
      const client = await ClientModel.findByClientId('test-client');
      
      // Act
      const isValid = ClientModel.validateRedirectUri(client!, 'https://malicious.com/callback');
      
      // Assert
      expect(isValid).toBe(false);
    });
  });
});