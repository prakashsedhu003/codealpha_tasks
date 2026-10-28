
require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const pool = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500'
    ],
    credentials: true
  })
);

// Serve the frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Register existing API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);

// Register posts only if the route file exists
const postRoutesPath = path.join(__dirname, 'routes', 'postRoutes.js');

if (fs.existsSync(postRoutesPath)) {
  app.use('/api/posts', require(postRoutesPath));
  console.log('Posts routes registered.');
} else {
  console.warn('postRoutes.js is missing; /api/posts is unavailable.');
}

// Database health check
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS server_time'
    );

    res.json({
      status: 'success',
      message: 'ConnectSphere backend is running!',
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time
    });
  } catch (error) {
    console.error('Database health error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed'
    });
  }
});

// Handle unknown API endpoints AFTER registering routes
app.use('/api', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'API endpoint not found.'
  });
});

// General error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack || err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    status: 'error',
    message: 'Internal server error.'
  });
});

const server = app.listen(PORT, () => {
  console.log(`ConnectSphere server running at http://localhost:${PORT}`);
});

server.on('error', (error) => {
  console.error('Server startup error:', error.message);
});
