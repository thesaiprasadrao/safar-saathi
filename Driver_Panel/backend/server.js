
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';


import authRoutes from './routes/auth.js';
import tripRoutes from './routes/trips.js';
import locationRoutes from './routes/locations.js';


import { errorHandler, notFound } from './middleware/errorHandler.js';


import { testConnection } from './config/database.js';

import { startCleanupJob } from './services/cleanupService.js';


dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5000'
    ],
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 5001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.use(helmet());


app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(morgan('combined'));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


app.get('/health', (req, res) => {
  res.json({
    success: true,
message: 'Safar Saathi Driver Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});




app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/locations', locationRoutes);


app.get('/api', (req, res) => {
  res.json({
    success: true,
message: 'Safar Saathi Driver Backend API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/login': 'Authenticate driver',
        'GET /api/auth/driver/:driverId': 'Get driver information',
        'POST /api/auth/logout': 'Logout driver and reset statuses'
      },
      trips: {
        'GET /api/trips/active/:driverId': 'Get active trip for driver',
        'POST /api/trips/start': 'Start new trip',
        'POST /api/trips/end': 'End active trip',
        'GET /api/trips/:tripId': 'Get trip details'
      },
      locations: {
        'POST /api/locations': 'Save GPS location',
        'GET /api/locations/trip/:tripId': 'Get location history',
        'GET /api/locations/latest/:tripId': 'Get latest location by trip',
        'GET /api/locations/latest-by-bus/:busNumber': 'Get latest location by bus',
        'GET /api/locations/active': 'Get all active locations'
      }
    }
  });
});


io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  
  socket.on('location-update', (data) => {
    console.log('Location update received:', data);
    
    io.emit('bus-location-update', data);
  });

  
  socket.on('trip-status-update', (data) => {
    console.log('Trip status update:', data);
    io.emit('bus-status-update', data);
  });

  
  socket.on('subscribe-to-bus', (busId) => {
    socket.join(`bus-${busId}`);
    console.log(`User subscribed to bus: ${busId}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});


const distPath = path.resolve(__dirname, '../frontend/dist');

if (!fs.existsSync(distPath)) {
  console.warn('⚠️  Frontend build not found at', distPath);
  console.warn('   Run "npm --prefix ../frontend run build" to generate the production build for single-port mode.');
}
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      
      res.setHeader('Cache-Control', 'no-store');
    } else if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf)$/.test(filePath)) {
      
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));


app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});


app.use(notFound);
app.use(errorHandler);


const startServer = async () => {
  try {
    
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Server will continue but may not function properly.');
    }

    server.listen(PORT, '0.0.0.0', () => {
console.log('🚀 Safar Saathi Driver Backend Server Started');
      console.log('================================');
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📚 API docs: http://localhost:${PORT}/api`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🗄️ Database: ${dbConnected ? 'Connected' : 'Connection failed'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('================================');
      
      startCleanupJob();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};


process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();