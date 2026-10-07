import jwt from 'jsonwebtoken';
import User from '../../models/User';
import Student from '../../models/Student';

// Authenticated requests now require the account to exist and be active, so tests create real
// accounts (in the isolated in-memory database) and sign tokens for them.

let counter = 0;
const secret = () => process.env.JWT_SECRET as string;

export async function makeStaff(role: 'admin' | 'bdm', overrides: Record<string, unknown> = {}) {
  counter += 1;
  const user = await User.create({
    name: `${role} ${counter}`,
    email: `${role}-${counter}@example.com`,
    passwordHash: 'x',
    role,
    ...overrides,
  });
  const token = jwt.sign({ userId: String(user._id), role }, secret(), { expiresIn: '1h' });
  return { user, token, auth: `Bearer ${token}` };
}

export async function makeStudent(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const student = await Student.create({
    name: `student ${counter}`,
    email: `student-${counter}@example.com`,
    passwordHash: 'x',
    ...overrides,
  });
  const token = jwt.sign({ studentId: String(student._id), role: 'student' }, secret(), { expiresIn: '1h' });
  return { student, token, auth: `Bearer ${token}` };
}
