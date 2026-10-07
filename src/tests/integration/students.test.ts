import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import Student from '../../models/Student';
import Lead from '../../models/Lead';
import User from '../../models/User';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// Student portal API contract: response keys, statuses and messages the student frontend reads.

const API = '/api/student';

describe('POST /api/student/auth/register', () => {
  const body = { name: 'Ayesha', email: 'Ayesha@Example.com', password: 'secret1', phone: '+8801700000000' };

  it('creates the account, lowercases the email and returns a student token', async () => {
    const res = await request(app).post(`${API}/auth/register`).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Account created successfully.',
      student: { name: 'Ayesha', email: 'ayesha@example.com', role: 'student', hasLinkedLead: false },
    });
    const decoded: any = jwt.verify(res.body.accessToken, process.env.JWT_SECRET as string);
    expect(decoded).toMatchObject({ studentId: String(res.body.student.id), role: 'student' });
    // the stored password is hashed, never the plain text
    const stored = await Student.findOne({ email: 'ayesha@example.com' });
    expect(stored!.passwordHash).toBeTruthy();
    expect(stored!.passwordHash).not.toBe('secret1');
  });

  it('links an existing lead filed under the same email', async () => {
    await Lead.create({ fullName: 'Ayesha', phone: '+8801711111111', email: 'ayesha@example.com' });
    const res = await request(app).post(`${API}/auth/register`).send(body);
    expect(res.status).toBe(201);
    expect(res.body.student.hasLinkedLead).toBe(true);
  });

  it('validates input with {message} bodies', async () => {
    expect((await request(app).post(`${API}/auth/register`).send({})).body).toEqual({ message: 'Name, email and password are required' });
    expect((await request(app).post(`${API}/auth/register`).send({ ...body, password: '123' })).body).toEqual({
      message: 'Password must be at least 6 characters',
    });
  });

  it('rejects a duplicate email', async () => {
    await request(app).post(`${API}/auth/register`).send(body);
    const res = await request(app).post(`${API}/auth/register`).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'An account with this email already exists' });
  });

  it('removes a stray non-staff record in the users collection that squats on the email', async () => {
    await User.collection.insertOne({ email: 'ayesha@example.com', name: 'Stray', role: 'student', isActive: true });
    await request(app).post(`${API}/auth/register`).send(body);
    expect(await User.collection.countDocuments({ email: 'ayesha@example.com' })).toBe(0);
  });
});

describe('POST /api/student/auth/login', () => {
  const register = () =>
    request(app).post(`${API}/auth/register`).send({ name: 'S', email: 'login@example.com', password: 'secret1' });

  it('signs in with the right password', async () => {
    await register();
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'LOGIN@example.com', password: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ student: { email: 'login@example.com', role: 'student' } });
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('401s a wrong password or unknown email with the same message', async () => {
    await register();
    const wrong = await request(app).post(`${API}/auth/login`).send({ email: 'login@example.com', password: 'nope' });
    const unknown = await request(app).post(`${API}/auth/login`).send({ email: 'x@example.com', password: 'secret1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual({ message: 'Invalid credentials' });
    expect(unknown.body).toEqual({ message: 'Invalid credentials' });
  });

  it('reports a Google-only account with GOOGLE_ONLY_ACCOUNT', async () => {
    await Student.create({ name: 'G', email: 'g@example.com' });
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'g@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'GOOGLE_ONLY_ACCOUNT' });
  });

  it('403s an inactive account only after the password is verified', async () => {
    await register();
    await Student.updateOne({ email: 'login@example.com' }, { isActive: false });
    const ok = await request(app).post(`${API}/auth/login`).send({ email: 'login@example.com', password: 'secret1' });
    expect(ok.status).toBe(403);
    expect(ok.body).toEqual({ message: 'Account is inactive. Please contact support.' });
    const bad = await request(app).post(`${API}/auth/login`).send({ email: 'login@example.com', password: 'nope' });
    expect(bad.status).toBe(401);
  });
});

describe('password reset', () => {
  it('forgot-password answers the same message whether or not the account exists, and stores a hashed token', async () => {
    await Student.create({ name: 'R', email: 'reset@example.com' });
    const known = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'reset@example.com' });
    const unknown = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'none@example.com' });
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    const stored = await Student.findOne({ email: 'reset@example.com' });
    expect(stored!.resetPasswordToken).toMatch(/^[0-9a-f]{64}$/);
    expect(stored!.resetPasswordExpires!.getTime()).toBeGreaterThan(Date.now());
  });

  it('reset-password consumes a valid token and rejects an invalid one', async () => {
    const crypto = await import('crypto');
    const token = 'plain-reset-token';
    await Student.create({
      name: 'R',
      email: 'reset2@example.com',
      resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
      resetPasswordExpires: new Date(Date.now() + 60_000),
    });

    expect((await request(app).post(`${API}/auth/reset-password`).send({ token: 'wrong', password: 'newpass1' })).body).toEqual({
      message: 'Invalid or expired reset token',
    });
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token, password: '123' })).body).toEqual({
      message: 'Password must be at least 6 characters',
    });

    const ok = await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'newpass1' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ message: 'Password reset successfully' });
    const stored = await Student.findOne({ email: 'reset2@example.com' });
    expect(stored!.resetPasswordToken).toBeUndefined();
    // single use
    expect((await request(app).post(`${API}/auth/reset-password`).send({ token, password: 'again12' })).status).toBe(400);
  });
});

describe('student profile', () => {
  it('GET /profile returns { student, lead } and links a lead found by email', async () => {
    const { student, auth } = await makeStudent({ email: 'p@example.com' });
    const lead = await Lead.create({ fullName: 'P', phone: '+8801722222222', email: 'p@example.com' });
    const res = await request(app).get(`${API}/profile`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.student.email).toBe('p@example.com');
    expect(res.body.lead._id).toBe(String(lead._id));
    expect((await Student.findById(student._id))!.linkedLeadId).toEqual(lead._id);
  });

  it('GET /profile has lead: null when there is none', async () => {
    const { auth } = await makeStudent();
    const res = await request(app).get(`${API}/profile`).set('Authorization', auth);
    expect(res.body.lead).toBeNull();
  });

  it('PUT /profile updates only name, phone and address (trimmed)', async () => {
    const { student, auth } = await makeStudent();
    const res = await request(app)
      .put(`${API}/profile`)
      .set('Authorization', auth)
      .send({ name: '  New Name ', phone: ' +880 ', address: ' Dhaka ', isActive: false, role: 'admin', email: 'x@y.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const stored: any = await Student.findById(student._id).lean();
    expect(stored).toMatchObject({ name: 'New Name', phone: '+880', isActive: true, role: 'student' });
    expect(stored.email).toBe(student.email);
  });

  it('PUT /profile/password verifies the current password', async () => {
    await request(app).post(`${API}/auth/register`).send({ name: 'C', email: 'cp@example.com', password: 'oldpass1' });
    const login = await request(app).post(`${API}/auth/login`).send({ email: 'cp@example.com', password: 'oldpass1' });
    const auth = `Bearer ${login.body.accessToken}`;

    expect((await request(app).put(`${API}/profile/password`).set('Authorization', auth).send({})).body).toEqual({
      message: 'Current and new password are required',
    });
    expect(
      (await request(app).put(`${API}/profile/password`).set('Authorization', auth).send({ currentPassword: 'bad', newPassword: 'newpass1' })).body,
    ).toEqual({ message: 'Current password is incorrect' });
    const ok = await request(app).put(`${API}/profile/password`).set('Authorization', auth).send({ currentPassword: 'oldpass1', newPassword: 'newpass1' });
    expect(ok.body).toEqual({ success: true, message: 'Password changed successfully' });
    expect((await request(app).post(`${API}/auth/login`).send({ email: 'cp@example.com', password: 'newpass1' })).status).toBe(200);
  });

  it('PUT /onboarding stores the answers and marks onboarding complete', async () => {
    const { student, auth } = await makeStudent();
    const res = await request(app)
      .put(`${API}/onboarding`)
      .set('Authorization', auth)
      .send({ nationality: 'Bangladeshi', gender: 'F', englishTest: { type: 'IELTS', score: '7.0' }, onboardingComplete: false, isActive: false });
    expect(res.status).toBe(200);
    const stored: any = await Student.findById(student._id).lean();
    expect(stored).toMatchObject({ nationality: 'Bangladeshi', onboardingComplete: true, isActive: true });
    expect(stored.englishTest).toMatchObject({ type: 'IELTS', score: '7.0' });
  });

  it('every student route rejects a missing token (401) and a staff token (403)', async () => {
    expect((await request(app).get(`${API}/profile`)).status).toBe(401);
    const { auth } = await makeStaff('admin');
    expect((await request(app).get(`${API}/profile`).set('Authorization', auth)).status).toBe(403);
  });
});

describe('staff views of students', () => {
  it('GET /students returns { success, students } with the assigned BDM resolved', async () => {
    const { user: bdm, auth } = await makeStaff('bdm');
    await Student.create({ name: 'S1', email: 's1@example.com', assignedBDM: bdm._id });
    const res = await request(app).get(`${API}/students`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.students[0].assignedBDM).toMatchObject({ name: bdm.name, role: 'bdm' });
  });

  it('GET /students/:id returns the student, or 404 { message }', async () => {
    const { auth } = await makeStaff('admin');
    const s = await Student.create({ name: 'S2', email: 's2@example.com' });
    const ok = await request(app).get(`${API}/students/${s._id}`).set('Authorization', auth);
    expect(ok.body.student.email).toBe('s2@example.com');
    const missing = await request(app).get(`${API}/students/507f1f77bcf86cd799439011`).set('Authorization', auth);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: 'Student not found' });
  });

  it('logout clears the cookie and answers { success, message }', async () => {
    const res = await request(app).post(`${API}/auth/logout`);
    expect(res.body).toEqual({ success: true, message: 'Logged out successfully' });
    expect(String(res.headers['set-cookie'])).toContain('studentToken=;');
  });
});
