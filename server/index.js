const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const dotenv = require('dotenv');
const { setupFileMonitoring } = require('./src/services/fileMonitor');
const { setupDatabase } = require('./src/db/setup');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Database setup
setupDatabase();

// API Routes
app.use('/api/auth', require('./src/api/auth'));
app.use('/api/events', require('./src/api/events'));
app.use('/api/analytics', require('./src/api/analytics'));
app.use('/api/settings', require('./src/api/settings'));
app.use('/api/files', require('./src/api/files'));
app.use('/api/acfbf', require('./src/api/acfbf'));

// Serve static assets in production
// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  const fs = require('fs');
  const buildPath = path.join(__dirname, '../client/build');
  const indexPath = path.join(buildPath, 'index.html');

  app.use(express.static(buildPath));

  app.get('*', (req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send(`DEBUG: Creating build path failed. <br>Looking for: ${indexPath}<br>Current Dir: ${__dirname}`);
    }
  });
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Initialize file monitoring
setupFileMonitoring(io);

// Start server
const PORT = process.env.PORT || 5001;
// Only start listening when not under test to avoid EADDRINUSE
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server started in mode:', process.env.NODE_ENV);
  });
}

module.exports = { app, server };