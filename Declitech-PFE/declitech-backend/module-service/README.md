# Module Service

Module Management Microservice for DecliTech platform. This service handles the creation, management, and organization of learning modules with associated sessions.

## Architecture

- **Port**: 8085
- **Database**: PostgreSQL (`declitech_modules`)
- **Framework**: Spring Boot 3.2.1
- **Authentication**: JWT-based (via API Gateway)
- **Service Registry**: Eureka Client

## Features

### Module Management
- **Create Module**: Create new learning modules with title and description
- **Update Module**: Modify existing modules (creator only)
- **Delete Module**: Remove modules (creator only)
- **List Modules**: Retrieve all modules or paginated results
- **My Modules**: Get modules created by authenticated user

### Session Association

Sessions are automatically linked to modules when created. When an instructor creates a session, they can optionally specify a `moduleId` to associate it with a module:

```http
POST /api/sessions
Content-Type: application/json

{
  "title": "Spring Boot Basics",
  "moduleId": 1,
  "durationHours": 2.0
}
```

The session is then automatically linked to the specified module.

## Database Schema

### Modules Table
```sql
CREATE TABLE modules (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    created_by BIGINT NOT NULL,
    created_by_username VARCHAR(255),
    created_by_email VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Note**: Sessions are linked to modules via the `module_id` field in the `sessions` table (in session-service).

## API Endpoints

All endpoints are accessed through the API Gateway at `http://localhost:8083/api/modules`

### Module CRUD

#### Create Module
```http
POST /api/modules
Authorization: Bearer {token} or Cookie: accessToken={token}
Content-Type: application/json

{
  "title": "Introduction to Spring Boot",
  "description": "Learn the fundamentals of Spring Boot framework"
}
```

**Response**: `201 Created`
```json
{
  "id": 1,
  "title": "Introduction to Spring Boot",
  "description": "Learn the fundamentals of Spring Boot framework",
  "createdBy": 10,
  "createdByUsername": "admin",
  "createdByEmail": "admin@declitech.com",
  "createdAt": "2026-02-24T10:30:00",
  "updatedAt": "2026-02-24T10:30:00",
  "sessionCount": 0,
  "sessions": []
}
```

#### Get Module by ID
```http
GET /api/modules/{id}
```

#### Get All Modules
```http
GET /api/modules
```

#### Get Paginated Modules
```http
GET /api/modules/paginated?page=0&size=10&sortBy=createdAt&sortDirection=DESC
```

#### Get My Modules
```http
GET /api/modules/my-modules
Authorization: Required
```

#### Update Module
```http
PUT /api/modules/{id}
Authorization: Required (must be creator)
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### Delete Module
```http
DELETE /api/modules/{id}
Authorization: Required (must be creator)
```

### Session Management

#### Add Session to Module
```http
POST /api/modules/{moduleId}/sessions
Authorization: Required (must be module creator)
Content-Type: application/json

{
  "sessionId": 5
} "sessionId": 5,
    "sessionCode": "ABC123",
    "sessionTitle": "Spring Boot Basics Session",
    "addedAt": "2026-02-24T11:00:00"
  }
]
```

## Authentication & Authorization

All create, update, and delete operations require authentication. The user ID is extracted from the JWT token (either from cookie or Authorization header).

### Authorization Rules
- **Create Module**: Any authenticated user
- **Update Module**: Only the module creator
- **Delete Module**: Only the module creator
- **Add/Remove Sessions**: Only the module creator

## Exception Handling

### Custom Exceptions
- `ModuleNotFoundException`: HTTP 404 - Module not found
- `SessionNotFoundException`: HTTP 404 - Session not found
- `SessionAlreadyAddedException`: HTTP 409 - Session already in module
- `UnauthorizedException`: HTTP 401 - Authentication/authorization failed
- `ValidationException`: HTTP 400 - Request validation failed

### Error Response Format
```json
{
  "timestamp": "2026-02-24T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Module not found with ID: 123",
  "path": "/api/modules/123"
}
```

## Gateway Security

This service is protected by the API Gateway and requires the `X-Gateway-Secret` header for direct access. All requests should go through the auth-service gateway at port 8083.

## 
### Dependencies
- **Create Session with Module**: Any authenticated instructor can link a session to any module
- **Session Service**: Fetch session details

## Configuration

### Application Properties
```yaml
server:
  port: 8085

spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/declitech_modules
    username: postgres
    password: admin

gateway:
  secret: declitech-gateway-secret-2024
  require-header: true
```

## Running the Service

### Prerequisites
1. PostgreSQL database running
2. Eureka Server running (port 8761)
3. Auth Service running (port 8083)
4. Database `declitech_modules` created

### Build & Run
```bash
cd module-service
mvn clean install
mvn spring-boot:run
```

### Database Setup
```sql
CREATE DATABASE declitech_modules;
```

The tables will be created automatically by Hibernate.

## Integration with Session Service

When creating a session, instructors can specify a `moduleId` to link the session to a module:

```http
POST /api/sessions
Content-Type: application/json

{
  "title": "Spring Boot Basics",
  "moduleId": 1,
  "durationHours": 2.0
}
```

The relationship is stored in the Session entity (session-service) via the `moduleId` field. Module-service fetches sessions for a module by querying session-service.

## Workflow Example

1. **Instructor creates a module**
   ```
   POST /api/modules
   { "title": "Web Development", "description": "..." }
   ```

2. **Instructor creates sessions for the module**
   ```
   POST /api/sessions
   { "title": "Session 1", "moduleId": 1 }
   ```

3. **Or add existing sessions to module**
   ```
   POST /api/modules/1/sessions
   { "sessionId": 5 }
   ```

4. **Students can view module sessions**
   ```
   GET /api/modules/1/sessions
   ```

## Logging

The service uses SLF4J with Logback for logging. Log level can be configured in `application.yml`:
a session and links it to the module**
   ```
   POST /api/sessions
   { "title": "Session 1: HTML Basics", "moduleId": 1, "durationHours": 2.0 }
   ```

3. **View all sessions in a module**
   ```
   GET /api/modules/1/sessions
   ```

4. **Students can view module details with session count**
   ```
   GET /api/modules/1
- Java 17
- Spring Boot 3.2.1
- Spring Data JPA
- PostgreSQL
- Eureka Client (Service Discovery)
- OpenFeign (Inter-service communication)
- JWT (Authentication)
- Lombok
- Maven
