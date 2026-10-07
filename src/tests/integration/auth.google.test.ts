import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import User from '../../models/User';
import Student from '../../models/Student';
import { makeStaff } from '../helpers/testAuth';

// Google sign-in endpoints. Google's APIs are mocked by URL — no network calls are made.
// A token is trusted only if tokeninfo says it was issued to OUR client, for a verified email,
// and the profile carries the same email.

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

type GoogleMock = {
  /** tokeninfo response; null = Google rejects the token (HTTP 400) */
  tokeninfo?: Record<string, unknown> | null;
  /** userinfo (profile) response; null = HTTP 401 */
  profile?: Record<string, unknown> | null;
};

const mockGoogle = ({ tokeninfo, profile }: GoogleMock) =>
  jest.spyOn(global, 'fetch').mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    const reply = (body: Record<string, unknown> | null | undefined) =>
      ({ ok: body != null, status: body != null ? 200 : 400, json: async () => body ?? {} }) as Response;
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return reply(tokeninfo);
    if (url.startsWith('https://www.googleapis.com/oauth2/v3/userinfo')) return reply(profile);
    throw new Error(`Unexpected network call in test: ${url}`);
  });

/** A fully valid Google response for an email. */
const valid = (email: string, extra: Record<string, unknown> = {}): GoogleMock => ({
  tokeninfo: { aud: CLIENT_ID, email, email_verified: 'true', expires_in: '3500' },
  profile: { email, ...extra },
});

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
});
afterEach(() => {
  process.env.GOOGLE_CLIENT_ID = '';
});

let adminAuthHeader: string;
const adminAuth = () => adminAuthHeader;
const googleLogin = (token = 't') => request(app).post('/api/auth/google').send({ token });

describe('Google token verification (staff login)', () => {
  beforeEach(async () => {
    await User.create({ name: 'Staff', email: 'staff@example.com', role: 'bdm', avatarUrl: 'http://a/b.png' });
  });

  it('valid token: signs in an existing staff user with a staff token', async () => {
    mockGoogle(valid('STAFF@example.com'));
    const res = await googleLogin();
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Staff', email: 'staff@example.com', role: 'bdm', avatarUrl: 'http://a/b.png' });
    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET as string) as any;
    expect(decoded).toMatchObject({ role: 'bdm' });
  });

  it('wrong audience (token issued to another app) is rejected', async () => {
    mockGoogle({ ...valid('staff@example.com'), tokeninfo: { aud: 'someone-elses-client', email: 'staff@example.com', email_verified: 'true', expires_in: '3500' } });
    const res = await googleLogin();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid Google token' });
    expect(res.body.accessToken).toBeUndefined();
  });

  it('unverified email is rejected', async () => {
    mockGoogle({ ...valid('staff@example.com'), tokeninfo: { aud: CLIENT_ID, email: 'staff@example.com', email_verified: 'false', expires_in: '3500' } });
    const res = await googleLogin();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid Google token' });
  });

  it('invalid token (Google rejects it) is rejected', async () => {
    mockGoogle({ tokeninfo: null });
    const res = await googleLogin();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Invalid Google token' });
  });

  it('expired token is rejected', async () => {
    mockGoogle({ ...valid('staff@example.com'), tokeninfo: { aud: CLIENT_ID, email: 'staff@example.com', email_verified: 'true', expires_in: '0' } });
    expect((await googleLogin()).status).toBe(400);
  });

  it('a profile whose email differs from the verified token email is rejected', async () => {
    mockGoogle({ tokeninfo: valid('staff@example.com').tokeninfo, profile: { email: 'someone-else@example.com' } });
    expect((await googleLogin()).status).toBe(400);
  });

  it('a failing profile lookup is rejected', async () => {
    mockGoogle({ tokeninfo: valid('staff@example.com').tokeninfo, profile: null });
    expect((await googleLogin()).status).toBe(400);
  });

  it('fails closed when GOOGLE_CLIENT_ID is not configured', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const spy = mockGoogle(valid('staff@example.com'));
    const res = await googleLogin();
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('403s a deactivated staff account and issues no token', async () => {
    await User.updateOne({ email: 'staff@example.com' }, { isActive: false });
    mockGoogle(valid('staff@example.com'));
    const res = await googleLogin();
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: 'Account is inactive. Please contact support.' });
    expect(res.body.accessToken).toBeUndefined();
  });

  it('still 401s a verified Google user that has no staff account', async () => {
    mockGoogle(valid('ghost@example.com'));
    const res = await googleLogin();
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Account not found. Please sign up first.' });
  });
});

describe('POST /api/auth/google-register (admin only)', () => {
  beforeEach(async () => {
    adminAuthHeader = (await makeStaff('admin')).auth;
  });

  it('creates a staff user from a verified token and returns 201', async () => {
    mockGoogle(valid('new@example.com', { name: 'New Person', picture: 'http://p' }));
    const res = await request(app).post('/api/auth/google-register').set('Authorization', adminAuth()).send({ token: 't', role: 'bdm' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account created successfully');
    expect(res.body.user).toMatchObject({ name: 'New Person', email: 'new@example.com', role: 'bdm', avatarUrl: 'http://p' });
    expect(await User.exists({ email: 'new@example.com' })).toBeTruthy();
  });

  it('does not create a user from an unverified or foreign token', async () => {
    mockGoogle({ tokeninfo: { aud: 'other-app', email: 'x@example.com', email_verified: 'true', expires_in: '3500' }, profile: { email: 'x@example.com' } });
    const res = await request(app).post('/api/auth/google-register').set('Authorization', adminAuth()).send({ token: 't', role: 'bdm' });
    expect(res.status).toBe(400);
    expect(await User.exists({ email: 'x@example.com' })).toBeNull();
  });
});

describe('POST /api/student/auth/google', () => {
  const studentGoogle = (token?: string) => request(app).post('/api/student/auth/google').send(token === undefined ? {} : { token });

  it('requires a token', async () => {
    const res = await studentGoogle();
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Google token is required' });
  });

  it('rejects invalid, foreign-audience and unverified tokens', async () => {
    mockGoogle({ tokeninfo: null });
    expect((await studentGoogle('t')).body).toEqual({ message: 'Invalid Google token' });

    mockGoogle({ tokeninfo: { aud: 'other-app', email: 'k@example.com', email_verified: 'true', expires_in: '3500' }, profile: { email: 'k@example.com' } });
    expect((await studentGoogle('t')).status).toBe(400);

    mockGoogle({ tokeninfo: { aud: CLIENT_ID, email: 'k@example.com', email_verified: 'false', expires_in: '3500' }, profile: { email: 'k@example.com' } });
    expect((await studentGoogle('t')).status).toBe(400);
    expect(await Student.countDocuments({ email: 'k@example.com' })).toBe(0);
  });

  it('creates a student on first sign-in and returns a student token', async () => {
    mockGoogle(valid('Kid@Example.com', { name: 'Kid', picture: 'http://p' }));
    const res = await studentGoogle('t');
    expect(res.status).toBe(200);
    expect(res.body.student).toMatchObject({ name: 'Kid', email: 'kid@example.com', role: 'student', avatarUrl: 'http://p' });
    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET as string) as any;
    expect(decoded).toMatchObject({ studentId: res.body.student.id, role: 'student' });
    expect(await Student.countDocuments({ email: 'kid@example.com' })).toBe(1);
  });
});
