import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface StudentJwtPayload {
  studentId: string;
  role: 'student';
}

declare global {
  namespace Express {
    interface Request {
      student?: StudentJwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');

export const authenticateStudent = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as StudentJwtPayload;
    if (decoded.role !== 'student') {
      res.status(403).json({ error: 'Invalid token type' });
      return;
    }
    req.student = decoded;
    (req as any).studentId = decoded.studentId;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const studentAuthMiddleware = authenticateStudent;
