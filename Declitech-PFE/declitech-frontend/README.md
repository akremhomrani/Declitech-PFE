d:\PFE_Declitech\declitech-frontend\README.md

# DecliTech Frontend Dashboard

Angular 17+ application for real-time student emotion monitoring.

## Prerequisites

- Node.js 18+ and npm
- Angular CLI: `npm install -g @angular/cli`

## Installation

```bash
cd declitech-frontend
npm install
```

## Development

Start the development server:
```bash
npm start
```

Navigate to `http://localhost:4200/`

## Backend Connection

The frontend connects to the Spring Boot backend at `http://localhost:8081/api`

Make sure your Spring Boot services are running:
- Eureka Server: `http://localhost:8761`
- Report Service: `http://localhost:8081`

## Features

- **Real-time Dashboard**: Auto-refreshes every 5 seconds to show live student data
- **Student Grid**: Displays all connected students with their emotion states
- **Session Statistics**: Shows connected, focused, and distracted student counts
- **Live Status**: Color-coded cards show student engagement levels
- **Responsive Design**: Works on desktop and tablet devices

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   └── dashboard/          # Main dashboard component
│   ├── services/
│   │   └── emotion.service.ts  # API service for emotion reports
│   ├── models/
│   │   └── emotion-report.model.ts  # TypeScript interfaces
│   └── main.ts
├── environments/
│   ├── environment.ts          # Development config
│   └── environment.prod.ts     # Production config
└── styles.css                  # Global styles with Tailwind
```

## API Endpoints Used

- `GET /api/reports` - Get all emotion reports
- `GET /api/reports/student/{studentLoginIdentity}` - Get reports by student
- `GET /api/reports/session/{sessionId}` - Get report by session
- `GET /api/reports/student/{studentLoginIdentity}/statistics` - Get student statistics

## Build

```bash
npm run build
```

Build artifacts will be in the `dist/` directory.
