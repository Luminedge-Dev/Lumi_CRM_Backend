import { Request, Response, NextFunction } from 'express';

// AUTHORIZATION by role only. Ownership rules ("is this lead yours?") need business context and
// live in the services, not here.

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Student and staff JWTs share one signing secret, so authenticateToken alone also accepts a
// student token. Use this (after authenticateToken) on any route that is meant for staff only.
export const requireStaff = authorizeRoles('admin', 'bdm');
