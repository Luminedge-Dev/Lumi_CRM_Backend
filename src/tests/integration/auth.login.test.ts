import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import app from '../../app';
import User from '../../models/User';

// app.ts calls dotenv.config(), which can load real SMTP credentials — never let a test send mail.
const sendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }) },
  createTransport: () => ({ sendMail: (...a: unknown[]) => sendMail(...a) }),
}));

// Characterization tests for POST /api/auth/login (response key is `message`).

const login = (body: unknown) => request(app).post('/api/auth/login').send(body as object);

beforeEach(async () => {
  sendMail.mockClear();
  await User.create({ name: 'Staff', email: 'staff@example.com', passwordHash: await bcrypt.hash('secret123', 4), role: 'bdm' });
});

describe('POST /api/auth/login', () => {
  it('400s when email or password is missing', async () => {
    const res = await login({ email: 'staff@example.com' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Email and password are required' });
  });

  it('401s for unknown email and for wrong password with the same body', async () => {
    const unknown = await login({ email: 'nobody@example.com', password: 'secret123' });
    const wrong = await login({ email: 'staff@example.com', password: 'nope' });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual({ message: 'Invalid credentials' });
    expect(wrong.body).toEqual({ message: 'Invalid credentials' });
  });

  it('403s an inactive account', async () => {
    await User.updateOne({ email: 'staff@example.com' }, { isActive: false });
    const res = await login({ email: 'staff@example.com', password: 'secret123' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Account is inactive. Please contact support.' });
  });

  it('returns a 7-day token and the user on success (email is case/space-insensitive)', async () => {
    const res = await login({ email: '  STAFF@Example.com ', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['accessToken', 'user']);
    expect(res.body.user).toMatchObject({ name: 'Staff', email: 'staff@example.com', role: 'bdm' });
    expect(Object.keys(res.body.user).sort()).toEqual(['email', 'id', 'name', 'role']);

    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET as string) as any;
    expect(decoded.role).toBe('bdm');
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 3600);
  });

  it('returns 200 PASSWORD_SETUP_REQUIRED for a Google-only account and stores a reset token', async () => {
    await User.create({ name: 'Googler', email: 'g@example.com', role: 'admin' });
    const res = await login({ email: 'g@example.com', password: 'whatever' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'PASSWORD_SETUP_REQUIRED', email: 'g@example.com' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const saved = await User.findOne({ email: 'g@example.com' });
    expect(saved!.resetPasswordToken).toMatch(/^[0-9a-f]{64}$/);
    expect(saved!.resetPasswordExpires!.getTime()).toBeGreaterThan(Date.now());
  });
});
