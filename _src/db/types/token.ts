/**
 * Parameter interface for creating tokens (both access and refresh)
 */
export interface CreateTokenParams {
  userId: string;
  clientId: string;
  scope?: string;
  expiresInSeconds?: number;
}

/**
 * Parameter interface for validating tokens
 */
export interface ValidateTokenParams {
  token: string;
  userId?: string;
  checkPasswordChange?: boolean;
}