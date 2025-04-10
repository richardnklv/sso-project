import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

// Import database models
import { AuthCodeModel } from '../db/models/authCode';
import { AccessTokenModel } from '../db/models/accessToken';
import { RefreshTokenModel } from '../db/models/refreshToken';
import { ClientModel } from '../db/models/client';

// Types
export interface AuthorizationRequest {
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: 'plain' | 'S256';
}

export interface TokenRequest {
  grant_type: string;
  code?: string;
  redirect_uri?: string;
  client_id: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
}

// PKCE Utils
export const generatePKCEChallenge = (verifier: string, method: 'plain' | 'S256' = 'S256'): string => {
  if (method === 'plain') {
    return verifier;
  }
  
  // S256 method
  const hash = createHash('sha256').update(verifier).digest();
  return hash.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

export const verifyPKCE = (verifier: string, challenge: string, method: 'plain' | 'S256' = 'S256'): boolean => {
  const calculatedChallenge = generatePKCEChallenge(verifier, method);
  return calculatedChallenge === challenge;
};

// Core OAuth Functions
export const validateAuthorizationRequest = async (
  req: AuthorizationRequest
): Promise<{ valid: boolean; error?: string; client?: any }> => {
  // Validate required parameters
  if (!req.client_id) return { valid: false, error: 'missing_client_id' };
  if (!req.redirect_uri) return { valid: false, error: 'missing_redirect_uri' };
  if (req.response_type !== 'code') return { valid: false, error: 'unsupported_response_type' };

  // Validate client
  const client = await ClientModel.findByClientId(req.client_id);
  if (!client) return { valid: false, error: 'invalid_client' };

  // Validate redirect URI
  if (!ClientModel.validateRedirectUri(client, req.redirect_uri)) {
    return { valid: false, error: 'invalid_redirect_uri' };
  }

  return { valid: true, client };
};

export const generateAuthorizationCode = async (
  clientId: string,
  userId: string,
  redirectUri: string,
  scope?: string,
  codeChallenge?: string,
  codeChallengeMethod?: 'plain' | 'S256'
): Promise<string> => {
  // Generate a secure random authorization code
  const code = crypto.randomBytes(32).toString('hex');
  
  // We'll set expiration to 10 minutes (600 seconds)
  // Store in database
  await AuthCodeModel.create({
    clientId,
    userId,
    redirectUri,
    scope: scope || '',
    expiresInSeconds: 600, // 10 minutes in seconds
    codeChallenge,
    codeChallengeMethod
  });
  
  return code;
};

export const validateTokenRequest = async (
  req: TokenRequest
): Promise<{ 
  valid: boolean; 
  error?: string; 
  client?: any; 
  authCode?: any; 
  refreshToken?: any;
}> => {
  // Validate grant type
  if (req.grant_type !== 'authorization_code' && req.grant_type !== 'refresh_token') {
    return { valid: false, error: 'unsupported_grant_type' };
  }
  
  // Validate client
  const client = await ClientModel.findByClientId(req.client_id);
  if (!client) return { valid: false, error: 'invalid_client' };
  
  // Handle confidential clients
  if (client.client_type === 'confidential') {
    if (!req.client_secret) return { valid: false, error: 'missing_client_secret' };
    
    const authenticated = await ClientModel.verifyClientCredentials(
      req.client_id, 
      req.client_secret
    );
    
    if (!authenticated) return { valid: false, error: 'invalid_client' };
  }
  
  // For authorization code grant
  if (req.grant_type === 'authorization_code') {
    if (!req.code) return { valid: false, error: 'missing_code' };
    if (!req.redirect_uri) return { valid: false, error: 'missing_redirect_uri' };
    
    try {
      const authCode = await AuthCodeModel.validate({
        code: req.code,
        redirectUri: req.redirect_uri
      });
      
      // Verify the code belongs to the right client
      if (authCode.client_id !== client.id) {
        return { valid: false, error: 'invalid_grant' };
      }
      
      // Handle PKCE if required
      if (authCode.code_challenge && !req.code_verifier) {
        return { valid: false, error: 'missing_code_verifier' };
      }
      
      if (authCode.code_challenge && req.code_verifier) {
        const verified = verifyPKCE(
          req.code_verifier,
          authCode.code_challenge,
          authCode.code_challenge_method as 'plain' | 'S256'
        );
        
        if (!verified) return { valid: false, error: 'invalid_code_verifier' };
      }
      
      return { valid: true, client, authCode };
    } catch (error) {
      return { valid: false, error: 'invalid_grant' };
    }
  }
  
  // For refresh token grant
  if (req.grant_type === 'refresh_token') {
    if (!req.refresh_token) return { valid: false, error: 'missing_refresh_token' };
    
    try {
      const refreshToken = await RefreshTokenModel.validate({
        token: req.refresh_token
      });
      
      // Verify the token belongs to the right client
      if (refreshToken.client_id !== client.id) {
        return { valid: false, error: 'invalid_grant' };
      }
      
      return { valid: true, client, refreshToken };
    } catch (error) {
      return { valid: false, error: 'invalid_grant' };
    }
  }
  
  return { valid: false, error: 'server_error' };
};

export const generateTokens = async (
  clientId: string,
  userId: string,
  scope?: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: string }> => {
  // Generate access token
  const accessToken = await AccessTokenModel.create({
    clientId,
    userId,
    scope: scope || ''
  });
  
  // Generate refresh token
  const refreshToken = await RefreshTokenModel.create({
    clientId,
    userId,
    scope: scope || ''
  });
  
  // Calculate expiration
  // Use the default token expiration (from constants)
  // Calculate based on expires_at
  const expires_in = Math.floor(
    (new Date(accessToken.expires_at).getTime() - Date.now()) / 1000
  );
  
  return {
    access_token: accessToken.token,
    refresh_token: refreshToken.token,
    expires_in,
    token_type: 'Bearer'
  };
};

export const refreshAccessToken = async (
  refreshToken: string,
  clientId: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: string }> => {
  try {
    // Validate refresh token
    const token = await RefreshTokenModel.validate({
      token: refreshToken
    });
    
    // Verify the token belongs to the right client
    if (token.client_id !== clientId) {
      throw new Error('invalid_grant');
    }
    
    // Generate new access token
    const accessToken = await AccessTokenModel.create({
      clientId,
      userId: token.user_id,
      scope: token.scope || ''
    });
    
    // Generate new refresh token (rotation)
    const newRefreshToken = await RefreshTokenModel.create({
      clientId,
      userId: token.user_id,
      scope: token.scope || ''
    });
    
    // Revoke old refresh token
    await RefreshTokenModel.revoke(refreshToken);
    
    // Calculate based on expires_at
    const expires_in = Math.floor(
      (new Date(accessToken.expires_at).getTime() - Date.now()) / 1000
    );
    
    return {
      access_token: accessToken.token,
      refresh_token: newRefreshToken.token,
      expires_in,
      token_type: 'Bearer'
    };
  } catch (error) {
    throw new Error('invalid_grant');
  }
};

export const revokeToken = async (token: string, clientId: string): Promise<boolean> => {
  // Try to revoke as access token
  const accessRevoked = await AccessTokenModel.revoke(token);
  if (accessRevoked) return true;
  
  // Try to revoke as refresh token
  const refreshRevoked = await RefreshTokenModel.revoke(token);
  return refreshRevoked;
};

export const revokeAllUserTokens = async (userId: string): Promise<void> => {
  await AccessTokenModel.revokeAllForUser(userId);
  await RefreshTokenModel.revokeAllForUser(userId);
};