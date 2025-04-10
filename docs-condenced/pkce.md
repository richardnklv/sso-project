# PKCE (Proof Key for Code Exchange) - Condensed Version

## 1. Introduction and Problem Statement

OAuth 2.0 public clients (like mobile apps and single-page applications) are vulnerable to the **authorization code interception attack**. In this attack, an attacker intercepts the authorization code returned from the authorization endpoint within a communication path not protected by TLS, such as inter-application communication within a device's operating system.

PKCE (pronounced "pixy") mitigates this attack by introducing a dynamically created cryptographically random key called "code verifier" that can be verified by the authorization server.

## 2. Protocol Flow

```
                                             +-------------------+
                                             |   Authz Server    |
   +--------+                                | +---------------+ |
   |        |--(A)- Authorization Request ---->|               | |
   |        |       + t(code_verifier), t_m  | | Authorization | |
   |        |                                | |    Endpoint   | |
   |        |<-(B)---- Authorization Code -----|               | |
   |        |                                | +---------------+ |
   | Client |                                |                   |
   |        |                                | +---------------+ |
   |        |--(C)-- Access Token Request ---->|               | |
   |        |          + code_verifier       | |    Token      | |
   |        |                                | |   Endpoint    | |
   |        |<-(D)------ Access Token ---------|               | |
   +--------+                                | +---------------+ |
                                             +-------------------+
```

A. Client creates a "code_verifier" and transforms it to create a "code_challenge", which is sent in the authorization request
B. Authorization endpoint records the code_challenge and returns the code
C. Client sends the code and original code_verifier in the token request
D. Server validates the code_verifier against the recorded code_challenge

## 3. PKCE Parameters

### 3.1 Code Verifier

- A cryptographically random string created by the client for each authorization request
- Uses [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~" characters
- Minimum length of 43 characters, maximum 128 characters
- MUST have enough entropy to make it impractical to guess (32 octets minimum recommended)

Example:
```
dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

### 3.2 Code Challenge Methods

Two transformation methods to derive the code challenge from the code verifier:

#### Plain Method
```
code_challenge = code_verifier
```

#### S256 Method (Recommended)
```
code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))
```

Example:
```
code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
code_challenge (using S256): E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
```

- S256 is Mandatory To Implement (MTI) for servers
- Clients MUST use S256 if they can support it
- Plain method should only be used when client has technical limitations and knows server supports it

## 4. Protocol Steps

### 4.1 Authorization Request

The client sends the authorization request with additional parameters:

- `code_challenge` (REQUIRED): The transformed code verifier
- `code_challenge_method` (OPTIONAL): "S256" or "plain", defaults to "plain" if not present

Example:
```
https://server.example.com/authorize
  ?response_type=code
  &client_id=s6BhdRkqt3
  &state=af0ifjsldkj
  &redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

### 4.2 Authorization Response

The server associates the code_challenge and code_challenge_method with the issued authorization code.

### 4.3 Token Request

The client sends the token request with an additional parameter:

- `code_verifier` (REQUIRED): The original code verifier string

Example:
```
POST /token HTTP/1.1
Host: server.example.com
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=SplxlOBeZQQYbYS6WxSbIA
&redirect_uri=https%3A%2F%2Fclient.example.org%2Fcb
&client_id=s6BhdRkqt3
&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
```

### 4.4 Token Validation and Response

The server:
1. Retrieves the previously associated code_challenge and code_challenge_method
2. Transforms the received code_verifier using the associated method
3. Compares the result with the stored code_challenge
4. Issues the tokens if the values match

## 5. Security Considerations

### 5.1 Code Verifier Strength
- MUST use cryptographically random string with minimum 256 bits of entropy
- Recommended: 32-octet random sequence, base64url-encoded

### 5.2 No Downgrading
- Clients MUST NOT downgrade from S256 to plain
- Server error with S256 indicates either server fault or MITM attack

### 5.3 Method Selection
- S256 SHOULD be used in all new implementations
- Plain should only be used when technical reasons prevent S256 support

### 5.4 Protection Level
- S256 protects against eavesdroppers observing the code_challenge
- Plain offers no protection if the code_challenge is observed

## 6. Implementation Benefits

- Prevents authorization code interception by malicious applications on the same device
- Works for public clients (mobile apps, SPAs) that cannot securely store client secrets
- Simple to implement with minimal changes to existing OAuth flows
- Required for secure OAuth implementation in mobile and single-page applications

## 7. When to Use PKCE

- REQUIRED for all OAuth public clients (mobile apps, single-page applications)
- RECOMMENDED for all OAuth clients, even confidential ones, for extra security
- Essential for applications using custom URI schemes or universal links/app links
- Critical for SSO implementations where multiple applications access the same identity provider