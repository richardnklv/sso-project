# OAuth 2.0 Framework - Condensed Version

## 1. Core Concepts

OAuth 2.0 enables a third-party application to obtain limited access to an HTTP service, either on behalf of a resource owner or by allowing the application to obtain access on its own behalf.

### 1.1 Roles

- **Resource Owner**: Entity capable of granting access to a protected resource (typically an end-user).
- **Client**: Application requesting access to protected resources with the resource owner's authorization.
- **Resource Server**: Server hosting protected resources, capable of accepting and responding to requests using access tokens.
- **Authorization Server**: Server issuing access tokens to clients after authenticating the resource owner and obtaining authorization.

### 1.2 Protocol Flow

```
+--------+                               +---------------+
|        |--(A)- Authorization Request ->|   Resource    |
|        |                               |     Owner     |
|        |<-(B)-- Authorization Grant ---|               |
|        |                               +---------------+
|        |
|        |                               +---------------+
|        |--(C)-- Authorization Grant -->| Authorization |
| Client |                               |     Server    |
|        |<-(D)----- Access Token -------|               |
|        |                               +---------------+
|        |
|        |                               +---------------+
|        |--(E)----- Access Token ------>|    Resource   |
|        |                               |     Server    |
|        |<-(F)--- Protected Resource ---|               |
+--------+                               +---------------+
```

1. Client requests authorization from resource owner
2. Client receives an authorization grant 
3. Client requests access token by presenting the authorization grant
4. Authorization server authenticates client and validates the grant
5. Client uses access token to access protected resources
6. Resource server validates token and serves the request

## 2. Authorization Grants

An authorization grant is a credential representing the resource owner's authorization, used by the client to obtain an access token.

### 2.1 Authorization Code

- Most suitable for SSO implementation
- Uses the Authorization Server as intermediary
- Resource owner is only authenticated by the Authorization Server
- Resource owner credentials are never shared with client
- Token is delivered directly to client, not via user-agent
- Supports client authentication

### 2.2 Implicit (Less Relevant for SSO)

- Simplified flow for browser-based applications
- Client receives access token directly
- No intermediate code
- Client not authenticated
- Less secure than Authorization Code flow

### 2.3 Resource Owner Password Credentials (Less Secure)

- Username and password used directly
- Only for high-trust clients
- Should be avoided when other grant types available

### 2.4 Client Credentials

- For client acting on its own behalf
- No resource owner involvement
- Used when client is also resource owner

## 3. Tokens

### 3.1 Access Token

- Credential used to access protected resources
- String representing specific scope, lifetime, and access attributes
- Usually opaque to the client
- Provides an abstraction layer, replacing direct authorization with a single token
- Shorter lifetime for security

### 3.2 Refresh Token

- Used to obtain new access tokens when current one expires
- Issued with access token (optional)
- Only used with authorization server, never sent to resource servers
- Enables session persistence without re-authentication
- Critical for "authenticate once" requirement in SSO

When refreshing an expired token:
1. Client authenticates to authorization server with refresh token
2. If valid, server issues new access token
3. Optionally also issues new refresh token

## 4. Client Types and Authentication

### 4.1 Client Types

- **Confidential Clients**: Can securely store credentials (server-side applications)
- **Public Clients**: Cannot securely store secrets (browser-based, mobile applications)

### 4.2 Client Authentication

- Required for confidential clients
- Methods include:
  - Client password (using HTTP Basic auth)
  - Other methods (certificates, JWT assertions, etc.)
- Public clients should not rely on authentication for security

## 5. Protocol Endpoints

### 5.1 Authorization Endpoint

- Used to interact with resource owner
- Obtains authorization grant
- Requires TLS
- Supports GET method, optionally POST

### 5.2 Token Endpoint

- Used by client to exchange authorization grant for tokens
- Typically requires client authentication
- Always requires TLS
- Uses POST method

### 5.3 Redirection Endpoint

- Used by authorization server to return responses to client
- Must be pre-registered
- Critical security component

## 6. Security Considerations for SSO

### 6.1 Access Token Security
- Access tokens MUST be kept confidential in transit and storage
- Only share tokens among authorization server, resource server, and client
- Always use TLS for token transmission
- Authorization server MUST ensure tokens cannot be generated, modified, or guessed
- Request tokens with minimal scope necessary

### 6.2 Refresh Token Security
- Keep refresh tokens confidential, store securely
- Authorization server MUST maintain binding between refresh token and client
- Verify token-client binding whenever client identity is authenticated
- Consider refresh token rotation (issue new refresh token with each access token refresh)
- Critical for implementing "expire all sessions when password changed" requirement

### 6.3 Authorization Code Security
- Transmit only over secure channels
- Codes MUST be short-lived and single-use
- If multiple use attempts are detected, revoke all tokens issued with that code
- Validate redirection URIs to prevent code interception attacks

### 6.4 Cross-Site Request Forgery Protection
- Implement CSRF protection for client redirection URI
- Use state parameter to bind request to user-agent's authenticated state
- State value MUST contain non-guessable values
- Authorization server should also implement CSRF protection

### 6.5 Additional Security Recommendations
- Always validate TLS certificates to prevent man-in-the-middle attacks
- Protect all endpoints against credentials-guessing attacks
- Sanitize and validate all input values
- Avoid open redirectors
- If using for third-party sign-in, add proper audience restrictions
- Use PKCE extension with public clients
- Invalidate all tokens when password changes

The authorization server MUST ensure all token types have sufficient entropy to prevent guessing attacks. The probability of an attacker guessing generated tokens MUST be less than or equal to 2^(-128).