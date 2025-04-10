import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';

// Import constants
import {
  AUTH_CODE_EXPIRATION_SECONDS,
  ACCESS_TOKEN_BYTES,
  REFRESH_TOKEN_BYTES,
  AUTH_CODE_BYTES
} from '../db/constants';

// Import database models
import { AuthCodeModel } from '../db/models/authCode';
import { AccessTokenModel } from '../db/models/accessToken';
import { RefreshTokenModel } from '../db/models/refreshToken';
import { ClientModel } from '../db/models/client';

// OAuth specific constants
const TOKEN_TYPE_BEARER = 'Bearer';

// Error types
const ERROR = {
  MISSING_CLIENT_ID: 'missing_client_id',
  MISSING_REDIRECT_URI: 'missing_redirect_uri',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_CLIENT: 'invalid_client',
  INVALID_REDIRECT_URI: 'invalid_redirect_uri',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  MISSING_CLIENT_SECRET: 'missing_client_secret',
  MISSING_CODE: 'missing_code',
  INVALID_GRANT: 'invalid_grant',
  MISSING_CODE_VERIFIER: 'missing_code_verifier',
  INVALID_CODE_VERIFIER: 'invalid_code_verifier',
  MISSING_REFRESH_TOKEN: 'missing_refresh_token',
  SERVER_ERROR: 'server_error',
  EXPIRED_CODE: 'expired_code'
};

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
  if (!req.client_id) return { valid: false, error: ERROR.MISSING_CLIENT_ID };
  if (!req.redirect_uri) return { valid: false, error: ERROR.MISSING_REDIRECT_URI };
  if (req.response_type !== 'code') return { valid: false, error: ERROR.UNSUPPORTED_RESPONSE_TYPE };

  // Validate client
  const client = await ClientModel.findByClientId(req.client_id);
  if (!client) return { valid: false, error: ERROR.INVALID_CLIENT };

  // Validate redirect URI
  if (!ClientModel.validateRedirectUri(client, req.redirect_uri)) {
    return { valid: false, error: ERROR.INVALID_REDIRECT_URI };
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
  console.log('Generating auth code with params:', {
    clientId: clientId.substring(0, 8) + '...',
    redirectUri
  });
  
  // Create auth code in database
  const authCode = await AuthCodeModel.create({
    clientId,
    userId,
    redirectUri,
    scope: scope || '',
    expiresInSeconds: AUTH_CODE_EXPIRATION_SECONDS,
    codeChallenge,
    codeChallengeMethod
  });
  
  console.log('Auth code created successfully:', authCode.code.substring(0, 8) + '...');
  
  // Return the code from the database instead of generating our own
  return authCode.code;
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
    return { valid: false, error: ERROR.UNSUPPORTED_GRANT_TYPE };
  }
  
  // Validate client
  const client = await ClientModel.findByClientId(req.client_id);
  if (!client) return { valid: false, error: ERROR.INVALID_CLIENT };
  
  // Handle confidential clients
  if (client.client_type === 'confidential') {
    if (!req.client_secret) return { valid: false, error: ERROR.MISSING_CLIENT_SECRET };
    
    const authenticated = await ClientModel.verifyClientCredentials(
      req.client_id,
      req.client_secret
    );
    
    if (!authenticated) return { valid: false, error: ERROR.INVALID_CLIENT };
  }
  
  // For authorization code grant
  if (req.grant_type === 'authorization_code') {
    if (!req.code) return { valid: false, error: ERROR.MISSING_CODE };
    if (!req.redirect_uri) return { valid: false, error: ERROR.MISSING_REDIRECT_URI };
    
    try {
      console.log('Validating auth code:', {
        code: req.code.substring(0, 10) + '...',
        redirectUri: req.redirect_uri
      });
      
      // Find the auth code first
      const authCode = await AuthCodeModel.findByCode(req.code);
      if (!authCode) {
        console.log('Auth code not found');
        return { valid: false, error: ERROR.INVALID_GRANT };
      }
      
      console.log('Auth code found, checking client_id match');
      // Verify the code belongs to the right client
      if (authCode.client_id !== client.id) {
        console.log('Client ID mismatch', {
          codeClientId: authCode.client_id,
          requestClientId: client.id
        });
        return { valid: false, error: ERROR.INVALID_GRANT };
      }
      
      console.log('Checking redirect URI match');
      // Check redirect URI match
      if (authCode.redirect_uri !== req.redirect_uri) {
        console.log('Redirect URI mismatch', {
          storedUri: authCode.redirect_uri,
          requestUri: req.redirect_uri
        });
        return { valid: false, error: ERROR.INVALID_REDIRECT_URI };
      }
      
      console.log('Checking expiration');
      // Check expiration
      if (new Date() > authCode.expires_at) {
        console.log('Code expired');
        return { valid: false, error: ERROR.EXPIRED_CODE };
      }
      
      // Handle PKCE if required
      if (authCode.code_challenge && !req.code_verifier) {
        console.log('Missing code verifier');
        return { valid: false, error: ERROR.MISSING_CODE_VERIFIER };
      }
      
      if (authCode.code_challenge && req.code_verifier) {
        console.log('Verifying PKCE');
        const verified = verifyPKCE(
          req.code_verifier,
          authCode.code_challenge,
          authCode.code_challenge_method as 'plain' | 'S256'
        );
        
        if (!verified) {
          console.log('Invalid code verifier');
          return { valid: false, error: ERROR.INVALID_CODE_VERIFIER };
        }
      }
      
      console.log('Auth code validation successful');
      return { valid: true, client, authCode };
    } catch (error) {
      console.error('Auth code validation error:', error);
      return { valid: false, error: ERROR.INVALID_GRANT };
    }
  }
  
  // For refresh token grant
  if (req.grant_type === 'refresh_token') {
    if (!req.refresh_token) return { valid: false, error: ERROR.MISSING_REFRESH_TOKEN };
    
    try {
      const refreshToken = await RefreshTokenModel.validate({
        token: req.refresh_token
      });
      
      // Verify the token belongs to the right client
      if (refreshToken.client_id !== client.id) {
        return { valid: false, error: ERROR.INVALID_GRANT };
      }
      
      return { valid: true, client, refreshToken };
    } catch (error) {
      console.error('Refresh token validation error:', error);
      return { valid: false, error: ERROR.INVALID_GRANT };
    }
  }
  
  return { valid: false, error: ERROR.SERVER_ERROR };
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
    token_type: TOKEN_TYPE_BEARER
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
      token_type: TOKEN_TYPE_BEARER
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