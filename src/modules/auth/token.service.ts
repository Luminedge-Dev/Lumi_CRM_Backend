import jwt from 'jsonwebtoken';
import { config } from '../../config/env';

/** Staff (admin/bdm) access token. Payload shape is read by the authenticate middleware. */
export const signStaffToken = (userId: unknown, role: string): string =>
  jwt.sign({ userId, role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

/** Student access token. Payload shape is read by the authenticateStudent middleware. */
export const signStudentToken = (studentId: string): string =>
  jwt.sign({ studentId, role: 'student' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

/** Throws if the token is invalid or expired. Only the algorithm we sign with (HS256) is accepted. */
export const verifyToken = <T = Record<string, any>>(token: string): T =>
  jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as T;
