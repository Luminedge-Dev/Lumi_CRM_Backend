import { Request, Response, NextFunction } from 'express';
import { checkStaffAccount, checkStudentAccount, AccountCheck } from '../../modules/auth/account.service';
import { verifyToken } from '../../modules/auth/token.service';

interface JwtPayload {
  userId: string;
  role: string;
}

interface StudentJwtPayload {
  studentId: string;
  role: 'student';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      student?: StudentJwtPayload;
    }
  }
}

// AUTHENTICATION only: who are you, and is the account still valid? Whether the caller may do
// the thing is decided by the authorization middleware (roles) and the services (ownership).

const rejectAccount = (res: Response, account: Extract<AccountCheck, { ok: false }>): void => {
  res.status(403).json({
    error: account.reason === 'inactive' ? 'Account is inactive' : 'Account no longer exists',
  });
};

const bearerToken = (req: Request): string | undefined => {
  const authHeader = req.headers['authorization'];
  return authHeader && authHeader.split(' ')[1];
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = bearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  let decoded: JwtPayload & { studentId?: string };
  try {
    decoded = verifyToken<JwtPayload & { studentId?: string }>(token);
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    // Student tokens are also accepted here (they carry studentId instead of userId); routes that
    // are staff-only add requireStaff. Either way the account must still exist and be active.
    const isStudentToken = decoded.role === 'student';
    const subject = isStudentToken ? decoded.studentId : decoded.userId;
    if (!subject) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }

    const account = isStudentToken ? await checkStudentAccount(subject) : await checkStaffAccount(subject);
    if (!account.ok) {
      rejectAccount(res, account);
      return;
    }

    // The role comes from the current account record, not from the (possibly stale) token.
    req.user = { ...decoded, role: account.role };
    (req as any).userId = decoded.userId;
    (req as any).role = account.role;
    next();
  } catch (error) {
    console.error('Authentication lookup failed:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
};

export const authMiddleware = authenticateToken;

export const authenticateStudent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = bearerToken(req);

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  let decoded: StudentJwtPayload;
  try {
    decoded = verifyToken<StudentJwtPayload>(token);
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  if (decoded.role !== 'student' || !decoded.studentId) {
    res.status(403).json({ error: 'Invalid token type' });
    return;
  }

  try {
    // A deactivated or deleted student must not keep using an unexpired token.
    const account = await checkStudentAccount(decoded.studentId);
    if (!account.ok) {
      rejectAccount(res, account);
      return;
    }
    req.student = decoded;
    (req as any).studentId = decoded.studentId;
    next();
  } catch (error) {
    console.error('Student authentication lookup failed:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
};

export const studentAuthMiddleware = authenticateStudent;
