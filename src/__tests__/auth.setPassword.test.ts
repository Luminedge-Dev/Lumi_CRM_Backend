import request from 'supertest';
import crypto from 'crypto';
import app from '../app';
import User from '../models/User';

async function createUserWithResetToken(rawToken: string, expiresAt: Date) {
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return User.create({
    name: 'Google Staff',
    email: 'google-staff@example.com',
    role: 'bdm',
    resetPasswordToken: tokenHash,
    resetPasswordExpires: expiresAt,
  });
}

describe('POST /api/auth/set-password', () => {
  it('rejects a missing token or password', async () => {
    const res = await request(app).post('/api/auth/set-password').send({ password: 'newpassword123' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown token', async () => {
    const res = await request(app)
      .post('/api/auth/set-password')
      .send({ token: 'does-not-exist', password: 'newpassword123' });
    expect(res.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const rawToken = 'expired-raw-token';
    await createUserWithResetToken(rawToken, new Date(Date.now() - 1000));

    const res = await request(app)
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'newpassword123' });

    expect(res.status).toBe(400);
  });

  it('sets the password for a valid, unexpired token and clears it after use', async () => {
    const rawToken = 'valid-raw-token';
    const user = await createUserWithResetToken(rawToken, new Date(Date.now() + 60_000));

    const res = await request(app)
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();

    const updated = await User.findById(user._id);
    expect(updated!.passwordHash).toBeTruthy();
    expect(updated!.resetPasswordToken).toBeUndefined();

    // The token is single-use — replaying it must fail.
    const replay = await request(app)
      .post('/api/auth/set-password')
      .send({ token: rawToken, password: 'anotherpassword123' });
    expect(replay.status).toBe(400);
  });
});
