import { NextFunction, Request, Response } from 'express';
import connectDB, { isDatabaseConnected } from '../../config/database';

// Serverless platforms start the app without server.ts, so the first request (re)connects. The
// connection string comes from configuration; this only connects, it never writes.
export const ensureDatabase = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (!isDatabaseConnected()) {
    try {
      await connectDB();
    } catch (err) {
      console.error('DB connection failed:', err);
      res.status(500).json({ message: 'Database connection failed' });
      return;
    }
  }
  next();
};
