# Auth Service (DecliTech)

Authentication and Authorization microservice for the DecliTech platform. This service handles JWT-based authentication using OpenFeign to communicate with the user-service.

## 🔑 Features

- **JWT Authentication**: Secure token-based authentication
- **Login**: User authentication with username/email and password
- **Token Refresh**: Refresh expired access tokens
- **Token Validation**: Validate JWT tokens
- **OpenFeign Integration**: Communicates with user-service for user data
- **Spring Security**: Full security configuration
- **Eureka Integration**: Service discovery and registration

## 📋 Prerequisites

- Java 17+
- Maven 3.6+
- Eureka Server running on port 8761
- User Service running and registered with Eureka

## 🚀 Getting Started

### Configuration

The service runs on port **8082** by default. Configuration is in `application.yml`:

```yaml
server:
  port: 8082

jwt:
  secret: your-secret-key
  expiration: 86400000  # 24 hours
  refresh-expiration: 604800000  # 7 days
```

### Environment Variables

- `JWT_SECRET`: JWT signing secret (optional, defaults to a development key)

### Running the Service

```bash
cd auth-service
mvn clean install
mvn spring-boot:run
```

## 📡 API Endpoints

### 1. Login

**POST** `/api/auth/login`

Authenticate a user and receive JWT tokens.

**Request Body:**
```json
{
  "usernameOrEmail": "john.doe",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400000,
  "user": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "role": "INSTRUCTOR",
    "active": true
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: User account is inactive

---

### 2. Refresh Token

**POST** `/api/auth/refresh`

Get new access and refresh tokens using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400000
}
```

**Error Response:**
- `401 Unauthorized`: Invalid or expired refresh token

---

### 3. Validate Token

**GET** `/api/auth/validate`

Validate if a JWT token is valid.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200 OK):**
```json
{
  "valid": true
}
```

---

### 4. Health Check

**GET** `/api/auth/health`

Check if the service is running.

**Response (200 OK):**
```json
{
  "status": "UP",
  "service": "auth-service"
}
```

---

## 🔒 Security

### Protected Endpoints

All endpoints except the following require authentication:
- `/api/auth/login` - Public
- `/api/auth/refresh` - Public
- `/actuator/**` - Public (for monitoring)

### Using JWT Tokens

Include the access token in the Authorization header for protected endpoints:

```
Authorization: Bearer <your-access-token>
```

### Token Structure

JWT tokens contain:
- **Subject**: Username
- **IssuedAt**: Token creation time
- **Expiration**: Token expiry time
- **Signature**: HMAC SHA-256 signature

---

## 🔄 Communication with User Service

The auth-service uses **OpenFeign** to communicate with the user-service:

```java
@FeignClient(name = "user-service")
public interface UserServiceClient {
    @GetMapping("/api/users/{id}")
    UserDto getUserById(@PathVariable Long id);
    
    @GetMapping("/api/users/username/{username}")
    UserDto getUserByUsername(@PathVariable String username);
    
    @GetMapping("/api/users/email/{email}")
    UserDto getUserByEmail(@PathVariable String email);
}
```

---

## 📦 Dependencies

Key dependencies used:
- **Spring Boot 3.2.1**
- **Spring Security**
- **Spring Cloud OpenFeign**
- **Spring Cloud Netflix Eureka Client**
- **JJWT 0.11.5** (JWT library)
- **Lombok**
- **Spring Boot Actuator**

---

## 🏗️ Project Structure

```
auth-service/
├── src/main/java/com/declitech/auth/
│   ├── AuthServiceApplication.java
│   ├── client/
│   │   └── UserServiceClient.java
│   ├── config/
│   │   ├── FeignConfig.java
│   │   └── JwtProperties.java
│   ├── controller/
│   │   └── AuthController.java
│   ├── dto/
│   │   ├── LoginRequest.java
│   │   ├── LoginResponse.java
│   │   ├── RefreshTokenRequest.java
│   │   ├── TokenResponse.java
│   │   └── UserDto.java
│   ├── exception/
│   │   ├── ErrorResponse.java
│   │   ├── GlobalExceptionHandler.java
│   │   ├── InvalidCredentialsException.java
│   │   ├── InvalidTokenException.java
│   │   ├── TokenExpiredException.java
│   │   └── UserInactiveException.java
│   ├── security/
│   │   ├── CustomUserDetailsService.java
│   │   ├── JwtAuthenticationEntryPoint.java
│   │   ├── JwtAuthenticationFilter.java
│   │   └── SecurityConfig.java
│   └── service/
│       ├── AuthService.java
│       └── JwtService.java
└── src/main/resources/
    └── application.yml
```

---

## 🧪 Testing

### Example Login Request (using curl)

```bash
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "john.doe",
    "password": "password123"
  }'
```

### Example Protected Request

```bash
curl -X GET http://localhost:8082/api/auth/validate \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📝 Notes

- **No Registration**: This service does NOT handle user registration. Users must be created via the user-service.
- **Password Validation**: Passwords are validated against BCrypt hashes stored in the user-service.
- **Service Discovery**: Uses Eureka for discovering the user-service.
- **Stateless**: The service is completely stateless using JWT tokens.

---

## 🔧 Troubleshooting

### Service Not Connecting to User Service

1. Ensure Eureka Server is running
2. Verify user-service is registered with Eureka
3. Check Feign client configuration

### Invalid Token Errors

1. Verify JWT secret matches between environments
2. Check token expiration time
3. Ensure token format is correct (Bearer prefix)

### Authentication Failures

1. Verify user exists in user-service
2. Check user is active (active = true)
3. Verify password is correct

---

## 📄 License

© 2026 DecliTech. All rights reserved.
