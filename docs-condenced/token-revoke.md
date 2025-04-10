# OAuth 2.0 Token Revocation - Condensed Version

## 1. Introduction and Purpose

The OAuth 2.0 Token Revocation specification defines an endpoint that allows clients to notify the authorization server that a previously obtained refresh or access token is no longer needed. This enables the authorization server to:

- Clean up security credentials and associated session data
- Invalidate tokens and related authorization grants
- Improve end-user experience by removing abandoned tokens
- Implement "log out" functionality for OAuth-based applications

From an end-user perspective, this is often equivalent to "logging out" of a site or application.

## 2. Token Revocation Endpoint

### 2.1 Endpoint Requirements

- The endpoint URL MUST use HTTPS (TLS)
- The endpoint location is typically published in server documentation or via discovery mechanisms
- If the host can also be reached over HTTP, the server SHOULD offer revocation at the corresponding HTTP URI but MUST NOT publish it as a revocation endpoint

### 2.2 Supported Token Types

- Implementations MUST support the revocation of refresh tokens
- Implementations SHOULD support the revocation of access tokens

## 3. Revocation Request

### 3.1 Request Format

Requests are made using HTTP POST with `application/x-www-form-urlencoded` parameters:

```
POST /revoke HTTP/1.1
Host: server.example.com
Content-Type: application/x-www-form-urlencoded
Authorization: Basic czZCaGRSa3F0MzpnWDFmQmF0M2JW

token=45ghiukldjahdnhzdauz&token_type_hint=refresh_token
```

### 3.2 Request Parameters

- `token` (REQUIRED): The token the client wants to revoke
- `token_type_hint` (OPTIONAL): A hint about the token type to help server optimize token lookup
  - `access_token`: Indicates an access token
  - `refresh_token`: Indicates a refresh token

### 3.3 Client Authentication

- Client authentication credentials MUST be included for confidential clients as described in OAuth 2.0 core specification
- The token must have been issued to the client making the revocation request

## 4. Revocation Response

### 4.1 Successful Response

- HTTP status code 200 if the token has been revoked successfully OR if the client submitted an invalid token
- The content of the response body is ignored by the client
- An invalid token type hint value is ignored by the server

### 4.2 Error Response

Error responses use the OAuth 2.0 error format with the following possible errors:

- `unsupported_token_type`: The server does not support the revocation of the presented token type
- HTTP status code 503: Service temporarily unavailable. Client should retry after delay (may include Retry-After header)

### 4.3 Cross-Origin Support

- The revocation endpoint MAY support CORS for user-agent-based applications
- For legacy user-agents, it MAY also support JSONP with an additional `callback` parameter

## 5. Revocation Behavior

### 5.1 Token Invalidation

- Invalidation takes place immediately after successful validation
- The token cannot be used again after revocation
- There may be a propagation delay, but clients must not try to use the token after receiving a 200 response

### 5.2 Related Token Revocation

Depending on the server's revocation policy:

- If a refresh token is revoked, the server SHOULD also invalidate all access tokens based on the same authorization grant
- If an access token is revoked, the server MAY revoke the respective refresh token as well
- The revocation of a token may cause revocation of related tokens and the underlying authorization grant

## 6. Security Considerations

### 6.1 Implementation Security

- Clients MUST verify the HTTPS URL of the revocation endpoint
- Clients MUST authenticate the revocation endpoint (certificate validation)
- Clients must obtain the endpoint location from a trustworthy source only

### 6.2 Server-Side Considerations

- Appropriate countermeasures against denial-of-service attacks MUST be implemented
- Care MUST be taken to prevent malicious clients from exploiting this feature to launch DoS attacks
- Invalid token type hints could cause additional database lookups
- If a refresh token is revoked but access token revocation is not supported, access tokens will not be immediately invalidated

## 7. Implementation Note

OAuth 2.0 allows different styles of access tokens:

- Self-contained tokens: Resource server needs no further interaction with authorization server
- Reference tokens: Resource server must check with authorization server for each access attempt

These approaches have different implications for token revocation:

- For reference tokens, revocation is straightforward as resource servers check with the authorization server
- For self-contained tokens, backend interaction between authorization server and resource servers may be needed
- Alternatively, short-lived access tokens with refresh tokens allow limiting the time revoked tokens remain valid

The choice depends on the system design and security requirements.