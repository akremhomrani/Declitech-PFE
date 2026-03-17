# User Service - DecliTech Backend

## Description
The User Service is a microservice for managing users in the DecliTech platform. It provides CRUD operations for user management with PostgreSQL database integration and Eureka service discovery.

## Technologies
- **Spring Boot 3.2.1**
- **Java 17**
- **PostgreSQL**
- **Spring Data JPA**
- **Spring Cloud (Eureka Client)**
- **Lombok**
- **Spring Security (for password encoding)**
- **Maven**

## Prerequisites
- Java 17 or higher
- Maven 3.6+
- PostgreSQL 12+
- Eureka Server running on port 8761

## Database Setup

### Create PostgreSQL Database
```sql
CREATE DATABASE declitech_users;
```

### Configure Database Connection
Update the database credentials in `src/main/resources/application.yml`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/declitech_users
    username: postgres
    password: your_password
```

## Build and Run

### Build the project
```bash
mvn clean install
```

### Run the service
```bash
mvn spring-boot:run
```

The service will start on port **8082**.

## API Endpoints

### Base URL
```
http://localhost:8082/api/users
```

---

## CRUD Operations

### 1. Create User
**POST** `/api/users`

Creates a new user with default role INSTRUCTOR.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "sexe": "MALE",
  "phoneNumber": "+1234567890"
}
```

**Required Fields:**
- `firstName` (String, 2-50 characters)
- `lastName` (String, 2-50 characters)
- `email` (String, valid email format, max 100 characters)
- `sexe` (Enum: MALE, FEMALE, OTHER)
- `phoneNumber` (String, 8-20 characters)

**Response:** `201 Created`
```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john.doe@example.com",
  "sexe": "MALE",
  "phoneNumber": "+1234567890",
  "role": "INSTRUCTOR",
  "active": true,
  "createdAt": "2026-02-03T10:30:00",
  "updatedAt": "2026-02-03T10:30:00"
}
```

**Notes:**
- Username is auto-generated from email (part before @)
- Password is auto-generated (random 12-character string)
- Default role is INSTRUCTOR
- User is active by default

---

### 2. Get User by ID
**GET** `/api/users/{id}`

Retrieves a user by their ID.

**Path Parameter:**
- `id` (Long) - User ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john.doe@example.com",
  "sexe": "MALE",
  "phoneNumber": "+1234567890",
  "role": "INSTRUCTOR",
  "active": true,
  "createdAt": "2026-02-03T10:30:00",
  "updatedAt": "2026-02-03T10:30:00"
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `400 Bad Request` - Invalid user ID

---

### 3. Get All Users
**GET** `/api/users`

Retrieves all active users by default.

**Query Parameters:**
- `includeInactive` (boolean, optional, default: false) - Include inactive users

**Examples:**
```
GET /api/users
GET /api/users?includeInactive=true
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "email": "john.doe@example.com",
    "sexe": "MALE",
    "phoneNumber": "+1234567890",
    "role": "INSTRUCTOR",
    "active": true,
    "createdAt": "2026-02-03T10:30:00",
    "updatedAt": "2026-02-03T10:30:00"
  }
]
```

---

### 3.1. Get Users with Pagination and Filtering
**GET** `/api/users/paginated`

Retrieves users with pagination, filtering, and sorting capabilities.

**Query Parameters:**

**Pagination:**
- `page` (integer, optional, default: 0) - Page number (0-indexed)
- `size` (integer, optional, default: 10, max: 100) - Number of users per page
- `sortBy` (string, optional, default: "id") - Field to sort by (id, firstName, lastName, email, username, createdAt, etc.)
- `sortDirection` (string, optional, default: "ASC") - Sort direction (ASC or DESC)

**Filters (all optional, case-insensitive partial match):**
- `firstName` (string) - Filter by first name
- `lastName` (string) - Filter by last name
- `username` (string) - Filter by username
- `email` (string) - Filter by email
- `phoneNumber` (string) - Filter by phone number
- `sexe` (enum: MALE, FEMALE, OTHER) - Filter by gender
- `role` (enum: INSTRUCTOR, ADMIN) - Filter by role
- `active` (boolean) - Filter by active status
- `search` (string) - Global search across firstName, lastName, username, email, and phoneNumber

**Examples:**
```
# Get first page with 10 users
GET /api/users/paginated

# Get second page with 20 users
GET /api/users/paginated?page=1&size=20

# Filter by first name
GET /api/users/paginated?firstName=John

# Filter by role and active status
GET /api/users/paginated?role=ADMIN&active=true

# Global search
GET /api/users/paginated?search=john

# Complex query with pagination, filtering, and sorting
GET /api/users/paginated?page=0&size=10&sortBy=createdAt&sortDirection=DESC&role=INSTRUCTOR&active=true

# Filter by multiple criteria
GET /api/users/paginated?firstName=John&email=example.com&sexe=MALE&page=0&size=10
```

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "username": "johndoe",
      "email": "john.doe@example.com",
      "sexe": "MALE",
      "phoneNumber": "+1234567890",
      "role": "INSTRUCTOR",
      "active": true,
      "createdAt": "2026-02-03T10:30:00",
      "updatedAt": "2026-02-03T10:30:00"
    }
  ],
  "currentPage": 0,
  "totalPages": 5,
  "totalElements": 50,
  "pageSize": 10,
  "hasNext": true,
  "hasPrevious": false
}
```

**Response Fields:**
- `users` - Array of user objects for the current page
- `currentPage` - Current page number (0-indexed)
- `totalPages` - Total number of pages
- `totalElements` - Total number of users matching the filter
- `pageSize` - Number of users per page
- `hasNext` - Whether there is a next page
- `hasPrevious` - Whether there is a previous page

---

### 4. Update User
**PUT** `/api/users/{id}`

Updates an existing user's information.

**Path Parameter:**
- `id` (Long) - User ID

**Request Body (all fields optional):**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "janesmith",
  "email": "jane.smith@example.com",
  "password": "newpassword123",
  "sexe": "FEMALE",
  "phoneNumber": "+9876543210",
  "role": "ADMIN"
}
```

**Optional Fields:**
- `firstName` (String, 2-50 characters)
- `lastName` (String, 2-50 characters)
- `username` (String, 3-50 characters)
- `email` (String, valid email format)
- `password` (String, min 6 characters)
- `sexe` (Enum: MALE, FEMALE, OTHER)
- `phoneNumber` (String, 8-20 characters)
- `role` (Enum: INSTRUCTOR, ADMIN)

**Response:** `200 OK`
```json
{
  "id": 1,
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "janesmith",
  "email": "jane.smith@example.com",
  "sexe": "FEMALE",
  "phoneNumber": "+9876543210",
  "role": "ADMIN",
  "active": true,
  "createdAt": "2026-02-03T10:30:00",
  "updatedAt": "2026-02-03T11:45:00"
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `403 Forbidden` - User is inactive
- `409 Conflict` - Username/Email already exists
- `400 Bad Request` - Invalid data

---

### 5. Delete User (Soft Delete)
**DELETE** `/api/users/{id}`

Soft deletes a user by setting their `active` status to false.

**Path Parameter:**
- `id` (Long) - User ID

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - User not found
- `403 Forbidden` - User is already inactive
- `400 Bad Request` - Invalid user ID

**Note:** This is a soft delete. The user record remains in the database but is marked as inactive.

---

### 6. Reactivate User
**PATCH** `/api/users/{id}/reactivate`

Reactivates a previously deleted (inactive) user.

**Path Parameter:**
- `id` (Long) - User ID

**Response:** `200 OK`
```json
{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john.doe@example.com",
  "sexe": "MALE",
  "phoneNumber": "+1234567890",
  "role": "INSTRUCTOR",
  "active": true,
  "createdAt": "2026-02-03T10:30:00",
  "updatedAt": "2026-02-03T12:00:00"
}
```

**Error Responses:**
- `404 Not Found` - User not found
- `400 Bad Request` - User is already active

---

## Enums

### Role
```java
public enum Role {
    INSTRUCTOR,
    ADMIN
}
```

### Sexe
```java
public enum Sexe {
    MALE,
    FEMALE,
    OTHER
}
```

---

## Error Response Format

All errors return the following JSON structure:

```json
{
  "timestamp": "2026-02-03T10:30:00",
  "status": 400,
  "error": "Bad Request",
  "message": "Field 'email' cannot be empty or null",
  "path": "/api/users"
}
```

---

## Custom Exceptions

The service uses custom exceptions for detailed error handling:

1. **UserNotFoundException** - User not found (404)
2. **UserAlreadyExistsException** - Duplicate username/email (409)
3. **InvalidUserDataException** - Invalid input data (400)
4. **UserInactiveException** - User is inactive (403)
5. **EmptyFieldException** - Required field is empty (400)
6. **InvalidEmailFormatException** - Invalid email format (400)
7. **InvalidPhoneNumberException** - Invalid phone number (400)

---

## Validation Rules

### Email
- Must be a valid email format
- Max 100 characters
- Unique in the database

### Phone Number
- Must match pattern: `^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$`
- 8-20 characters

### Username
- Auto-generated from email (before @)
- Made unique if conflicts exist
- 3-50 characters for manual updates

### Password
- Minimum 6 characters
- Stored encrypted using BCrypt

### Names
- 2-50 characters
- Cannot be empty

---

## Service Integration

### Eureka Registration
The service automatically registers with Eureka Server:
```yaml
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka/
```

### Health Check
```
GET http://localhost:8082/actuator/health
```

---

## Testing with cURL

### Create User
```bash
curl -X POST http://localhost:8082/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "sexe": "MALE",
    "phoneNumber": "+1234567890"
  }'
```

### Get User
```bash
curl -X GET http://localhost:8082/api/users/1
```

### Get All Users
```bash
curl -X GET http://localhost:8082/api/users
```

### Get Users with Pagination
```bash
# Get first page (10 users)
curl -X GET "http://localhost:8082/api/users/paginated"

# Get second page with 20 users per page
curl -X GET "http://localhost:8082/api/users/paginated?page=1&size=20"

# Filter by first name
curl -X GET "http://localhost:8082/api/users/paginated?firstName=John"

# Filter by role
curl -X GET "http://localhost:8082/api/users/paginated?role=ADMIN"

# Global search
curl -X GET "http://localhost:8082/api/users/paginated?search=john"

# Complex filtering with pagination and sorting
curl -X GET "http://localhost:8082/api/users/paginated?page=0&size=10&sortBy=createdAt&sortDirection=DESC&role=INSTRUCTOR&active=true"

# Filter by multiple fields
curl -X GET "http://localhost:8082/api/users/paginated?firstName=John&lastName=Doe&email=example.com"
```

### Update User
```bash
curl -X PUT http://localhost:8082/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "role": "ADMIN"
  }'
```

### Delete User
```bash
curl -X DELETE http://localhost:8082/api/users/1
```

### Reactivate User
```bash
curl -X PATCH http://localhost:8082/api/users/1/reactivate
```

---

## Additional Features

- **Automatic Username Generation** - Generated from email prefix
- **Password Encryption** - BCrypt encryption for security
- **Soft Delete** - Users are never permanently deleted
- **Timestamp Tracking** - Automatic createdAt and updatedAt timestamps
- **Comprehensive Logging** - SLF4J logging for all operations
- **Transaction Management** - Database transactions for data consistency
- **CORS Enabled** - Cross-origin requests allowed
- **Pagination Support** - Efficient pagination for large datasets (default 10 users per page)
- **Advanced Filtering** - Filter by any user field (firstName, lastName, email, username, role, etc.)
- **Global Search** - Search across multiple fields simultaneously
- **Flexible Sorting** - Sort by any field in ascending or descending order

---

## Filtering and Pagination Features

### Supported Filter Fields
- **firstName** - Partial match, case-insensitive
- **lastName** - Partial match, case-insensitive
- **username** - Partial match, case-insensitive
- **email** - Partial match, case-insensitive
- **phoneNumber** - Partial match
- **sexe** - Exact match (MALE, FEMALE, OTHER)
- **role** - Exact match (INSTRUCTOR, ADMIN)
- **active** - Exact match (true/false)
- **search** - Global search across firstName, lastName, username, email, phoneNumber

### Sorting Options
You can sort by any of these fields:
- `id` (default)
- `firstName`
- `lastName`
- `username`
- `email`
- `createdAt`
- `updatedAt`
- `role`

Sort directions: `ASC` (ascending, default) or `DESC` (descending)

### Pagination Parameters
- **page** - Page number starting from 0
- **size** - Number of items per page (default: 10, max: 100)

### Usage Examples

#### Example 1: Get active instructors, sorted by creation date (newest first)
```
GET /api/users/paginated?role=INSTRUCTOR&active=true&sortBy=createdAt&sortDirection=DESC
```

#### Example 2: Search for users with "john" in any field
```
GET /api/users/paginated?search=john
```

#### Example 3: Get male users, page 2, 20 per page
```
GET /api/users/paginated?sexe=MALE&page=1&size=20
```

#### Example 4: Filter by email domain
```
GET /api/users/paginated?email=@gmail.com
```

#### Example 5: Combine multiple filters
```
GET /api/users/paginated?firstName=John&role=ADMIN&active=true&sortBy=lastName&sortDirection=ASC
```

---

## Contact & Support

For issues or questions, please contact the development team.
