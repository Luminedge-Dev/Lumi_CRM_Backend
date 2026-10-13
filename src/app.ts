import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { assertRequiredConfig, corsOptions, warnMissingProductionConfig } from './config';

// Modules (each owns its routes, controller, service and repository)
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/user.routes';
import tasksRoutes from './modules/tasks/task.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import coursesRoutes from './modules/courses/course.routes';
import mockTestsRoutes from './modules/mockTests/mockTest.routes';
import examsRoutes from './modules/exams/exam.routes';
import leadsRoutes from './modules/leads/lead.routes';
import schedulesRoutes from './modules/schedules/schedule.routes';
import mockTestPackagesRoutes from './modules/mockTestPackages/mockTestPackage.routes';
import notificationRoutes from './modules/notifications/notification.routes';
import activitiesRoutes from './modules/activities/activity.routes';
import reportsRoutes from './modules/reports/report.routes';
import studentRoutes from './modules/students/student.routes';
import applicationRoutes from './modules/applications/application.routes';
import leadEditRequestsRoutes from './modules/leadEditRequests/leadEditRequest.routes';
import conversationRoutes from './modules/conversations/conversation.routes';
import messageRoutes from './modules/messages/message.routes';
import documentRoutes from './modules/documents/document.routes';
import milestoneRoutes from './modules/milestones/milestone.routes';
import newsRoutes from './modules/news/news.routes';
import appointmentRoutes from './modules/appointments/appointment.routes';
import socketBridgeRoutes from './integrations/socket/socketBridge.routes';

import { errorHandler, notFoundHandler } from './middleware/error/errorHandler.middleware';
import { ensureDatabase } from './middleware/request/ensureDatabase.middleware';
import {
  ACCOUNT_LOOKUP_PATHS,
  AUTH_LIMITED_PATHS,
  SIGN_IN_LIMITED_PATHS,
  accountLookupLimiter,
  authLimiter,
  generalLimiter,
  signInLimiter,
} from './middleware/security/rateLimit.middleware';
import { sanitizeInput } from './middleware/security/sanitizeInput.middleware';

// Fail fast when a required secret is missing (also covers serverless cold starts, which never run server.ts).
assertRequiredConfig();
warnMissingProductionConfig();

const app = express();

// Trust proxy (required for Vercel/reverse proxies with express-rate-limit)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Health check: placed before the rate limiter and DB middleware so Render's probe always gets a
// fast 200 even during cold start or DB reconnection.
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'CRM API is running' });
});

// This serverless deployment has no persistent HTTP server, so Socket.IO is never mounted here
// (see integrations/socket and README "Realtime Notifications"). Short-circuit before the rate
// limiter and DB-connection middleware so stray /socket.io polling can't burn shared rate-limit
// budget or trigger a cold-start DB reconnect for a request that can never succeed.
app.use('/socket.io', (_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Socket.IO is not available on this deployment' });
});

// Rate limiting
AUTH_LIMITED_PATHS.forEach((p) => app.use(p, authLimiter));
SIGN_IN_LIMITED_PATHS.forEach((p) => app.use(p, signInLimiter));
ACCOUNT_LOOKUP_PATHS.forEach((p) => app.use(p, accountLookupLimiter));
app.use('/api', generalLimiter);

// Body parsing and NoSQL-operator sanitisation
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);

// Ensure DB is connected before handling requests (required for serverless/Vercel)
app.use(ensureDatabase);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', userRoutes);
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
app.use('/api', conversationRoutes);
app.use('/api', messageRoutes);
app.use('/api', documentRoutes);
app.use('/api', milestoneRoutes);
app.use('/api', newsRoutes);
app.use('/api', appointmentRoutes);

// Dev-only fallback for documents stored on local disk (see integrations/storage/fileStorage.ts).
// Production-uploaded files are served directly from their Vercel Blob URL.
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Internal socket bridge (split API / socket-host deployments)
app.use(socketBridgeRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
