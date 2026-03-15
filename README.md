# SENTRY-DOC

A secure file monitoring and analytics system that tracks file events, detects suspicious behavior, and provides security insights through interactive dashboards.

![SENTRY-DOC Dashboard](./docs/dashboard-preview.png)

## Features

- **File Activity Monitoring**: Track file creation, modification, deletion, and access events
- **External Drive Detection**: Monitor file transfers to/from external drives
- **Risk Scoring**: Automated risk assessment for file events
- **Real-time Alerts**: Immediate notification of suspicious activities
- **Interactive Dashboard**: Visualize file events and security metrics
- **Secure Authentication**: JWT-based user authentication

## Architecture

SENTRY-DOC follows a clean architecture pattern with these main components:

- **Frontend**: React + TypeScript with Material UI
- **Backend API**: Node.js + Express
- **File Monitoring**: Node.js with Chokidar
- **Analytics Engine**: Anomaly detection for file events
- **Database**: SQLite (with option to switch to PostgreSQL)
- **Real-time Updates**: WebSocket for live event streaming

## Prerequisites

- Node.js (v14+)
- npm or yarn
- Git

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/sentry-doc.git
   cd sentry-doc
   ```

2. Install server dependencies:
   ```
   npm install
   ```

3. Install client dependencies:
   ```
   cd client
   npm install
   cd ..
   ```

4. Create a `.env` file in the root directory with the following content:
   ```
   PORT=5001
   NODE_ENV=development
   JWT_SECRET=your_jwt_secret_key_here
   DB_PATH=./data/sentry.db
   MONITORING_PATHS=C:/Users/Documents,C:/Users/Downloads
   LOG_LEVEL=info
   ```

## Running the Application

1. Start the development server:
   ```
   npm run dev
   ```

   This will start both the backend server and the React frontend concurrently.

2. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5001

## Usage

1. Register a new user account or login with existing credentials
2. Navigate the dashboard to view file events and security metrics
3. Check the Event Logs page for detailed file activity
4. Use the Risk Analytics page to identify potential security threats
5. Configure monitoring settings in the Settings page

## Security Features

- Local secure storage with SQLite
- JWT authentication for API access
- Role-based access control (admin/user)
- Local audit logs for security events
- Input sanitization to prevent injection attacks

## Future Expansion

SENTRY-DOC is designed to support:

- Electron desktop application packaging
- Mobile application via React Native or Capacitor
- Optional cloud synchronization while maintaining offline capabilities
- Advanced machine learning for improved anomaly detection

## Testing

Run tests with:
```
npm test
```

Generate fake data for testing:
```
npm run generate-data
```

## Documentation

- [API Documentation](./docs/api.md)
- [Database Schema](./docs/schema.md)
- [Deployment Guide](./docs/deployment.md)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
