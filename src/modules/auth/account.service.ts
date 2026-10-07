import { userRepository } from '../users/user.repository';
import { studentRepository } from '../students/student.repository';
import { toStaffRole } from '../../shared/constants/roles';

// JWTs live for 7 days and carry the role they were issued with. These checks re-read the
// account (one _id lookup, two fields) so deactivation, deletion and role changes take effect
// immediately instead of when the token expires. Read-only: nothing here writes to the database.

export type AccountCheck =
  | { ok: true; role: string }
  | { ok: false; reason: 'missing' | 'inactive' };

export const checkStaffAccount = async (userId: unknown): Promise<AccountCheck> => {
  const user = await userRepository.findAuthState(userId);
  if (!user) return { ok: false, reason: 'missing' };
  // Only an explicit `false` deactivates; legacy documents without the field stay active.
  if (user.isActive === false) return { ok: false, reason: 'inactive' };
  return { ok: true, role: toStaffRole(user.role) };
};

export const checkStudentAccount = async (studentId: unknown): Promise<AccountCheck> => {
  const student = await studentRepository.findAuthState(studentId);
  if (!student) return { ok: false, reason: 'missing' };
  if (student.isActive === false) return { ok: false, reason: 'inactive' };
  return { ok: true, role: 'student' };
};
