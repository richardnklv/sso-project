-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
-- Stores user authentication information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Store bcrypt/argon2 hashed passwords only
    password_changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Used for invalidating sessions
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for username lookups (used during authentication)
CREATE INDEX idx_users_username ON users(username);

COMMENT ON COLUMN users.password_changed_at IS 'Timestamp used to invalidate all sessions when password changes';

-- Clients Table
-- Stores information about registered applications that can use SSO
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) UNIQUE NOT NULL, -- Public identifier for the client
    client_secret VARCHAR(255), -- NULL for public clients, set for confidential clients
    client_type VARCHAR(50) NOT NULL CHECK (client_type IN ('confidential', 'public')),
    redirect_uris TEXT[] NOT NULL, -- Array of allowed redirect URIs
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for client_id lookups
CREATE INDEX idx_clients_client_id ON clients(client_id);

COMMENT ON COLUMN clients.redirect_uris IS 'Array of allowed redirect URIs that the client can use';
COMMENT ON COLUMN clients.client_type IS 'Either "confidential" (can keep secrets) or "public" (browser apps, mobile apps)';

-- Access Tokens Table
-- Stores active access tokens used for API access
CREATE TABLE access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL, -- The actual token string sent in requests
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When this token becomes invalid
    scope VARCHAR(255), -- Space-separated list of allowed scopes
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for token lookup and management
CREATE INDEX idx_access_tokens_token ON access_tokens(token);
CREATE INDEX idx_access_tokens_user_id ON access_tokens(user_id); -- For finding all tokens for a user
CREATE INDEX idx_access_tokens_expires_at ON access_tokens(expires_at); -- For cleanup of expired tokens

COMMENT ON TABLE access_tokens IS 'Short-lived tokens used to access protected resources';
COMMENT ON COLUMN access_tokens.user_id IS 'User this token belongs to - used for invalidation on password change';

-- Refresh Tokens Table
-- Stores refresh tokens that can be used to obtain new access tokens
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token VARCHAR(255) UNIQUE NOT NULL, -- The actual refresh token string
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When this token becomes invalid
    scope VARCHAR(255), -- Space-separated list of allowed scopes
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for token lookup and management
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id); -- For finding all tokens for a user
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at); -- For cleanup of expired tokens

COMMENT ON TABLE refresh_tokens IS 'Long-lived tokens used to get new access tokens without re-authentication';
COMMENT ON COLUMN refresh_tokens.user_id IS 'User this token belongs to - used for invalidation on password change';

-- Authorization Codes Table
-- Stores temporary authorization codes from the authorization endpoint
CREATE TABLE authorization_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(255) UNIQUE NOT NULL, -- The actual authorization code
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL, -- The specific redirect_uri this code was issued for
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Very short-lived (seconds)
    scope VARCHAR(255), -- Space-separated list of allowed scopes
    code_challenge VARCHAR(255), -- For PKCE support
    code_challenge_method VARCHAR(10) CHECK (code_challenge_method IN ('plain', 'S256')), -- PKCE method
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for code lookup and management
CREATE INDEX idx_authorization_codes_code ON authorization_codes(code);
CREATE INDEX idx_authorization_codes_expires_at ON authorization_codes(expires_at); -- For cleanup

COMMENT ON TABLE authorization_codes IS 'Temporary codes from OAuth2 authorization endpoint, exchanged for tokens';
COMMENT ON COLUMN authorization_codes.code_challenge IS 'PKCE code challenge for securing authorization to public clients';
COMMENT ON COLUMN authorization_codes.code_challenge_method IS 'PKCE method: "plain" or "S256" (preferred)';

-- Add a function to update the 'updated_at' column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add a trigger to the users table to update 'updated_at' automatically
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();