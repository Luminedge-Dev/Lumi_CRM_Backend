import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import User from '../models/User';

function tokenFor(role: 'admin' | 'bdm', userId = '507f1f77bcf86cd799439011') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}

describe('POST /api/auth/register', () => {
  const newUser = { name: 'New Staff', email: 'new-staff@example.com', password: 'password123', role: 'bdm' };

  it('rejects requests with no auth token', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser);
    expect(res.status).toBe(401);
  });

  it('rejects a non-admin (bdm) token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenFor('bdm')}`)
      .send(newUser);
    expect(res.status).toBe(403);
  });

  it('allows an admin token to create a staff account', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send(newUser);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: newUser.email, role: 'bdm' });

    const saved = await User.findOne({ email: newUser.email });
    expect(saved).not.toBeNull();
    expect(saved!.passwordHash).not.toBe(newUser.password);
  });

  it('rejects a duplicate email even as admin', async () => {
    await User.create({ name: 'Existing', email: newUser.email, passwordHash: 'x', role: 'bdm' });

    const res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${tokenFor('admin')}`)
      .send(newUser);

    expect(res.status).toBe(400);
  });
});
