# User Service - Pagination & Filtering Guide

## Quick Start

### Basic Pagination (10 users per page)
```
GET http://localhost:8082/api/users/paginated
```

## Common Use Cases

### 1. Get First Page of Users (Default: 10 users)
```http
GET http://localhost:8082/api/users/paginated
```

### 2. Get Specific Page
```http
# Page 2 (pages start at 0, so this is the third page)
GET http://localhost:8082/api/users/paginated?page=2

# Page 1 with 20 users
GET http://localhost:8082/api/users/paginated?page=0&size=20
```

### 3. Filter by First Name
```http
GET http://localhost:8082/api/users/paginated?firstName=John
```

### 4. Filter by Last Name
```http
GET http://localhost:8082/api/users/paginated?lastName=Doe
```

### 5. Filter by Email
```http
# Partial match
GET http://localhost:8082/api/users/paginated?email=gmail.com

# Specific email
GET http://localhost:8082/api/users/paginated?email=john.doe@example.com
```

### 6. Filter by Role
```http
# Get all admins
GET http://localhost:8082/api/users/paginated?role=ADMIN

# Get all instructors
GET http://localhost:8082/api/users/paginated?role=INSTRUCTOR
```

### 7. Filter by Active Status
```http
# Only active users
GET http://localhost:8082/api/users/paginated?active=true

# Only inactive users
GET http://localhost:8082/api/users/paginated?active=false
```

### 8. Filter by Gender (Sexe)
```http
GET http://localhost:8082/api/users/paginated?sexe=MALE
GET http://localhost:8082/api/users/paginated?sexe=FEMALE
GET http://localhost:8082/api/users/paginated?sexe=OTHER
```

### 9. Global Search (searches across all text fields)
```http
# Search for "john" in firstName, lastName, username, email, or phoneNumber
GET http://localhost:8082/api/users/paginated?search=john
```

### 10. Combine Multiple Filters
```http
# Active male instructors
GET http://localhost:8082/api/users/paginated?role=INSTRUCTOR&sexe=MALE&active=true

# Users with first name John and email containing gmail
GET http://localhost:8082/api/users/paginated?firstName=John&email=gmail
```

### 11. Sorting

#### Sort by Creation Date (Newest First)
```http
GET http://localhost:8082/api/users/paginated?sortBy=createdAt&sortDirection=DESC
```

#### Sort by First Name (A-Z)
```http
GET http://localhost:8082/api/users/paginated?sortBy=firstName&sortDirection=ASC
```

#### Sort by Last Name (Z-A)
```http
GET http://localhost:8082/api/users/paginated?sortBy=lastName&sortDirection=DESC
```

### 12. Complex Queries

#### Get page 2 of active admins, sorted by name, 15 per page
```http
GET http://localhost:8082/api/users/paginated?page=1&size=15&role=ADMIN&active=true&sortBy=firstName&sortDirection=ASC
```

#### Search for "smith" in active users, sorted by creation date
```http
GET http://localhost:8082/api/users/paginated?search=smith&active=true&sortBy=createdAt&sortDirection=DESC
```

#### Get instructors with emails from example.com domain
```http
GET http://localhost:8082/api/users/paginated?role=INSTRUCTOR&email=example.com
```

## Response Format

All paginated responses return this structure:

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

### Response Fields Explanation:
- **users**: Array of user objects for the current page
- **currentPage**: Current page number (0-indexed)
- **totalPages**: Total number of pages available
- **totalElements**: Total number of users matching your filters
- **pageSize**: Number of users per page
- **hasNext**: `true` if there are more pages after this one
- **hasPrevious**: `true` if there are pages before this one

## Frontend Integration Examples

### JavaScript/Fetch Example
```javascript
async function getUsers(page = 0, size = 10, filters = {}) {
  const params = new URLSearchParams({
    page,
    size,
    ...filters
  });

  const response = await fetch(
    `http://localhost:8082/api/users/paginated?${params}`
  );
  
  const data = await response.json();
  return data;
}

// Usage examples:
// Get first page
const firstPage = await getUsers();

// Get users filtered by role
const admins = await getUsers(0, 10, { role: 'ADMIN' });

// Search for users
const results = await getUsers(0, 10, { search: 'john' });

// Complex filter
const filtered = await getUsers(0, 20, {
  role: 'INSTRUCTOR',
  active: true,
  sortBy: 'createdAt',
  sortDirection: 'DESC'
});
```

### Angular Example
```typescript
import { HttpClient, HttpParams } from '@angular/common/http';

interface UserFilter {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  active?: boolean;
  search?: string;
}

getUsersPaginated(
  page: number = 0,
  size: number = 10,
  filter?: UserFilter,
  sortBy: string = 'id',
  sortDirection: string = 'ASC'
) {
  let params = new HttpParams()
    .set('page', page.toString())
    .set('size', size.toString())
    .set('sortBy', sortBy)
    .set('sortDirection', sortDirection);

  if (filter) {
    Object.keys(filter).forEach(key => {
      if (filter[key] !== undefined && filter[key] !== null) {
        params = params.set(key, filter[key].toString());
      }
    });
  }

  return this.http.get<PagedUserResponse>(
    'http://localhost:8082/api/users/paginated',
    { params }
  );
}
```

## Testing with cURL

### Windows PowerShell
```powershell
# Basic request
Invoke-RestMethod -Uri "http://localhost:8082/api/users/paginated" -Method Get

# With filters
Invoke-RestMethod -Uri "http://localhost:8082/api/users/paginated?role=ADMIN&active=true" -Method Get

# Save to variable
$users = Invoke-RestMethod -Uri "http://localhost:8082/api/users/paginated?page=0&size=10" -Method Get
$users.users | Format-Table
```

### Bash/Linux
```bash
# Basic request
curl -X GET "http://localhost:8082/api/users/paginated"

# With filters
curl -X GET "http://localhost:8082/api/users/paginated?role=ADMIN&active=true"

# Pretty print with jq
curl -X GET "http://localhost:8082/api/users/paginated" | jq
```

## Tips

1. **Default Values**: If you don't specify page/size, defaults are page=0, size=10
2. **Maximum Size**: Maximum page size is 100. Anything larger will be capped at 100
3. **Case Sensitivity**: Text filters (firstName, lastName, email, etc.) are case-insensitive
4. **Partial Matching**: Text filters use partial matching (contains), not exact matching
5. **Enum Values**: Role and Sexe filters are case-sensitive and must match exactly
6. **Global Search**: Use `search` parameter to search across multiple fields at once
7. **Combine Filters**: You can combine as many filters as needed

## Performance Notes

- Pagination is handled at the database level for efficiency
- Filtering uses database indexes for better performance
- Maximum page size is capped at 100 to prevent excessive data transfer
- Sorting is optimized using database-level sorting
