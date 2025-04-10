/**
 * Security constants
 */
export const SALT_ROUNDS = 10;

/**
 * Token generation constants
 */
export const ACCESS_TOKEN_BYTES = 32;
export const REFRESH_TOKEN_BYTES = 48;
export const AUTH_CODE_BYTES = 24;

/**
 * Expiration constants
 */
export const ACCESS_TOKEN_EXPIRATION_SECONDS = 3600; // 1 hour
export const REFRESH_TOKEN_EXPIRATION_SECONDS = 30 * 24 * 60 * 60; // 30 days 
export const AUTH_CODE_EXPIRATION_SECONDS = 10 * 60; // 10 minutes