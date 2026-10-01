import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import connectDB from './config/db';

// Import routes
import authRoutes from './routes/auth.routes';
import tasksRoutes from './routes/tasks.routes';
import dashboardRoutes from './routes/dashboard.routes';
import coursesRoutes from './routes/courses.routes';
import mockTestsRoutes from './routes/mockTests.routes';
import examsRoutes from './routes/exams.routes';
import leadsRoutes from './routes/leads.routes';
import schedulesRoutes from './routes/schedules.routes';
import mockTestPackagesRoutes from './routes/mockTestPackages.routes';
import notificationRoutes from './routes/notification.routes';
import activitiesRoutes from './routes/activities.routes';
import reportsRoutes from './routes/reports.routes';
import studentRoutes from './routes/student.routes';
import applicationRoutes from './routes/application.routes';
import leadEditRequestsRoutes from './routes/leadEditRequests.routes';
import chatRoutes from './routes/chat.routes';
import documentRoutes from './routes/document.routes';
import milestoneRoutes from './routes/milestone.routes';
import newsRoutes from './routes/news.routes';
import appointmentRoutes from './routes/appointment.routes';
import path from 'path';
import { createAndEmitNotification } from './services/notification.service';
import { socketService } from './services/socket.service';
import { isAllowedOrigin } from './utils/origin';

const app = express();

// Trust proxy (required for Vercel/reverse proxies with express-rate-limit)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:3001']
  ).map(o => o.trim().replace(/\/+$/, ''))
);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin/server-to-server requests, local dev, and approved hosting origins.
    if (isAllowedOrigin(origin, allowedOrigins)) {
      callback(null, true);
      return;
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    const corsError: Error & { status?: number } = new Error('Not allowed by CORS');
    corsError.status = 403;
    callback(corsError);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Health check — placed before rate limiter and DB middleware so Render's
// probe always gets a fast 200 even during cold start or DB reconnection.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'CRM API is running' });
});

// This serverless deployment has no persistent HTTP server, so Socket.IO is
// never mounted here (see socket.service.ts / README "Realtime Notifications").
// Short-circuit before the rate limiter and DB-connection middleware so stray
// /socket.io polling (misconfigured clients, bots) can't burn shared rate-limit
// budget or trigger a cold-start DB reconnect for a request that can never succeed.
app.use('/socket.io', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Socket.IO is not available on this deployment' });
});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/dashboard'),
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forget-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/set-password', authLimiter);
app.use('/api/student/auth/forgot-password', authLimiter);
app.use('/api/student/auth/reset-password', authLimiter);
app.use('/api', generalLimiter);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Ensure DB is connected before handling requests (required for serverless/Vercel)
app.use(async (_req: Request, res: Response, next: NextFunction) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error('DB connection failed:', err);
      res.status(500).json({ message: 'Database connection failed' });
      return;
    }
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/mock-tests', mockTestsRoutes);
app.use('/api/exams', examsRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/mock-test-packages', mockTestPackagesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activities', activitiesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api', applicationRoutes);
app.use('/api', leadEditRequestsRoutes);
app.use('/api', chatRoutes);
app.use('/api', documentRoutes);
app.use('/api', milestoneRoutes);
app.use('/api', newsRoutes);
app.use('/api', appointmentRoutes);
// Dev-only fallback for documents stored on local disk (see utils/fileStorage.ts).
// Production-uploaded files are served directly from their Vercel Blob URL.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Internal socket bridge endpoint.
// When the API and Socket.IO server are deployed separately, the API can
// forward notifications here and the dedicated socket host will emit them.
app.post('/api/internal/socket/notifications', (req: Request, res: Response) => {
  const sharedSecret = process.env.SOCKET_SERVER_SECRET;
  const incomingSecret = req.header('x-socket-server-secret');

  if (!sharedSecret) {
    res.status(503).json({ success: false, message: 'Socket bridge is not configured' });
    return;
  }

  if (!incomingSecret || incomingSecret !== sharedSecret) {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return;
  }

  const { recipientId, notification } = req.body ?? {};

  if (!recipientId || !notification) {
    res.status(400).json({ success: false, message: 'recipientId and notification are required' });
    return;
  }

  socketService.emitToUser(recipientId, 'new-notification', notification);
  res.json({ success: true });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;

