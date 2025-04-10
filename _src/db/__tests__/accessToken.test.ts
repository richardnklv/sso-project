import { AccessTokenModel, AccessTokenNotFoundError, InvalidAccessTokenError } from '../models/accessToken';
import { UserModel } from '../models/user';
import { ClientModel } from '../models/client';

describe('AccessTokenModel', () => {
  let userId: string;
  let clientId: string;
  let testToken: string;

  // ⚠️ Moving this from beforeAll to beforeEach to ensure data exists for each test
  beforeEach(async () => {
    // First create user and client for each test
    const user = await UserModel.create('testuser_token', 'password123');
    userId = user.id;
    
    const client = await ClientModel.create({
      clientId: 'test-client-token',
      clientType: 'confidential',
      redirectUris: ['https://test.com/callback'],
      clientSecret: 'secret123'
    });
    clientId = client.id;
    
    // Then create a token for the test
    const token = await AccessTokenModel.create({
      userId,
      clientId,
      scope: 'read'
    });
    testToken = token.token;
  });

  describe('create', () => {
    it('should create a token with default expiration', async () => {
      // Act
      const token = await AccessTokenModel.create({
        userId,
        clientId,
        scope: 'write'
      });
      
      // Assert
      expect(token).toBeDefined();
      expect(token.user_id).toBe(userId);
      expect(token.client_id).toBe(clientId);
      expect(token.scope).toBe('write');
      expect(token.expires_at).toBeInstanceOf(Date);
    });

    it('should create a token with custom expiration', async () => {
      // Arrange
      const now = Date.now();
      const customExpirationSeconds = 60; // 1 minute
      
      // Act
      const token = await AccessTokenModel.create({
        userId,
        clientId,
        expiresInSeconds: customExpirationSeconds
      });
      
      // Assert
      const expirationTime = new Date(token.expires_at).getTime();
      const expectedExpirationTime = now + (customExpirationSeconds * 1000);
      
      // Allow for small timing differences (within 5 seconds)
      expect(expirationTime).toBeGreaterThan(expectedExpirationTime - 5000);
      expect(expirationTime).toBeLessThan(expectedExpirationTime + 5000);
    });
  });

  describe('validate', () => {
    it('should validate a valid token', async () => {
      // Act
      const token = await AccessTokenModel.validate({
        token: testToken
      });
      
      // Assert
      expect(token).toBeDefined();
      expect(token.token).toBe(testToken);
    });

    it('should throw NotFoundError for nonexistent token', async () => {
      // Act & Assert
      await expect(AccessTokenModel.validate({
        token: 'nonexistent-token'
      })).rejects.toThrow(AccessTokenNotFoundError);
    });

    it('should throw InvalidError for expired token', async () => {
      // Arrange - Create an expired token (expiration in the past)
      const expiredToken = await AccessTokenModel.create({
        userId,
        clientId,
        expiresInSeconds: -60 // Expired 1 minute ago
      });
      
      // Act & Assert
      await expect(AccessTokenModel.validate({
        token: expiredToken.token
      })).rejects.toThrow(InvalidAccessTokenError);
    });

    it('should invalidate token when password changes', async () => {
      // Arrange - Create a token
      const token = await AccessTokenModel.create({
        userId,
        clientId
      });
      
      // Act - Change the user's password
      await UserModel.changePassword(userId, 'newpassword123');
      
      // Assert - Token should be invalid after password change
      await expect(AccessTokenModel.validate({
        token: token.token,
        userId,
        checkPasswordChange: true
      })).rejects.toThrow(InvalidAccessTokenError);
    });
  });

  describe('revoke', () => {
    it('should revoke a token', async () => {
      // Act
      const result = await AccessTokenModel.revoke(testToken);
      
      // Assert
      expect(result).toBe(true);
      
      // Verify token is gone
      await expect(AccessTokenModel.validate({
        token: testToken
      })).rejects.toThrow(AccessTokenNotFoundError);
    });

    it('should return false when revoking nonexistent token', async () => {
      // Act
      const result = await AccessTokenModel.revoke('nonexistent-token');
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all tokens for a user', async () => {
      // Arrange - Create multiple tokens for the user
      await AccessTokenModel.create({ userId, clientId });
      await AccessTokenModel.create({ userId, clientId });
      
      // Act
      const revokedCount = await AccessTokenModel.revokeAllForUser(userId);
      
      // Assert
      expect(revokedCount).toBeGreaterThan(0);
      
      // Verify all tokens are gone
      const tokens = await AccessTokenModel.findByUserId(userId);
      expect(tokens.length).toBe(0);
    });
  });
});