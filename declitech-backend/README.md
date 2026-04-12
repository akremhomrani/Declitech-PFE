# DecliTech Backend - Spring Boot Microservices

## Architecture Overview

This backend system consists of two microservices:

### 1. **Eureka Server** (Port 8761)
- Service Discovery server
- Registers and manages all microservices
- Dashboard: http://localhost:8761

### 2. **Report Service** (Port 8081)
- Handles emotion reports from Python agent
- Stores and retrieves emotion analysis data
- Provides student statistics and analytics

## Prerequisites

- Java 17 or higher
- Maven 3.8+
- Python Agent running on http://127.0.0.1:8765

## Project Structure

```
declitech-backend/
├── eureka-server/          # Service discovery
│   ├── src/
│   └── pom.xml
└── report-service/         # Emotion report microservice
    ├── src/
    │   └── main/
    │       ├── java/com/declitech/report/
    │       │   ├── model/              # JPA entities
    │       │   ├── dto/                # Data transfer objects
    │       │   ├── repository/         # Database repositories
    │       │   ├── service/            # Business logic
    │       │   └── controller/         # REST endpoints
    │       └── resources/
    │           └── application.yml
    └── pom.xml
```

## Getting Started

### Step 1: Start Eureka Server

```bash
cd eureka-server
mvn clean install
mvn spring-boot:run
```

Access Eureka Dashboard: http://localhost:8761

### Step 2: Start Report Service

```bash
cd report-service
mvn clean install
mvn spring-boot:run
```

## API Endpoints

### Report Service (http://localhost:8081/api/reports)

#### 1. **Import Report from JSON File**
```http
POST /api/reports/import?filePath=/path/to/emotion_report.json
```

#### 2. **Create Report (Direct from Python Agent)**
```http
POST /api/reports
Content-Type: application/json

{
  "sessionId": "LOCAL-123456",
  "participantId": "LOCAL-E12",
  "generatedAt": "2026-01-27T13:27:02.355390",
  "studentLoginIdentity": "student@example.com",
  "summaryMean": { ... },
  "finalState": { ... },
  "timeline": [ ... ]
}
```

#### 3. **Get Report by Session ID**
```http
GET /api/reports/session/{sessionId}
```

#### 4. **Get All Reports for a Student**
```http
GET /api/reports/student/{studentLoginIdentity}
```

#### 5. **Get Student Statistics**
```http
GET /api/reports/student/{studentLoginIdentity}/statistics
```

#### 6. **Get All Reports**
```http
GET /api/reports
```

#### 7. **Get Reports by Date Range**
```http
GET /api/reports/date-range?start=2026-01-01T00:00:00&end=2026-01-31T23:59:59
```

#### 8. **Health Check**
```http
GET /api/reports/health
```

## Database

### H2 Console (Development)
- URL: http://localhost:8081/h2-console
- JDBC URL: `jdbc:h2:mem:declitech_reports`
- Username: `sa`
- Password: (leave empty)

### Switching to MySQL (Production)

1. Uncomment MySQL dependency in `pom.xml`
2. Update `application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/declitech_db
    driver-class-name: com.mysql.cj.jdbc.Driver
    username: your_username
    password: your_password
  jpa:
    properties:
      hibernate:
        dialect: org.hibernate.dialect.MySQL8Dialect
```

## Entity Model

### EmotionReport
- Session and participant details
- Student login identity
- Emotion statistics (angry, happy, sad, fear, etc.)
- Final emotional state
- Timestamps

### EmotionTimeline
- Individual emotion captures during session
- Timestamp and status
- Emotion probabilities
- Error tracking

## Integration with Python Agent

The Report Service can receive emotion reports in two ways:

### Method 1: Automatic Import on Startup
Add a scheduled task to import the JSON file periodically.

### Method 2: Direct API Call from Python
Modify the Python agent to POST reports directly to the Spring Boot service.

## Testing the Services

### 1. Import the existing emotion report:
```bash
curl -X POST "http://localhost:8081/api/reports/import?filePath=/path/to/emotion_report.json"
```

### 2. Get student reports:
```bash
curl http://localhost:8081/api/reports/student/eya%20ben%20attig
```

### 3. Get student statistics:
```bash
curl http://localhost:8081/api/reports/student/eya%20ben%20attig/statistics
```

## Next Steps

1. Start both services (Eureka + Report Service)
2. Test the import endpoint with your existing JSON file
3. Verify data in H2 console
4. Query the student reports via REST API
5. Integrate with frontend application

## Future Enhancements

- [ ] Add authentication/authorization (Spring Security + JWT)
- [ ] Add API Gateway (Spring Cloud Gateway)
- [ ] Add Config Server for centralized configuration
- [ ] Add real-time notifications (WebSocket)
- [ ] Add caching (Redis)
- [ ] Add message queue (RabbitMQ/Kafka)
