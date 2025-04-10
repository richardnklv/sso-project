/**
 * Parameter interface for creating authorization codes
 */
export interface CreateAuthCodeParams {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'plain' | 'S256';
  expiresInSeconds?: number;
}

/**
 * Parameter interface for validating authorization codes
 */
export interface ValidateAuthCodeParams {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  userId?: string;
}