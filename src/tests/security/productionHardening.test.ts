import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { put } from '@vercel/blob';
import app from '../../app';
import { warnMissingProductionConfig } from '../../config';
import { frontendBaseUrl, sendMail } from '../../integrations/mail/mail.service';
import { storeUploadedFile } from '../../integrations/storage/fileStorage';
import { runFollowUpReminder, runSlot } from '../../jobs/followUpReminder.job';
import { sanitizeInput } from '../../middleware/security/sanitizeInput.middleware';
import { ACCOUNT_LOOKUP_PATHS, AUTH_LIMITED_PATHS, SIGN_IN_LIMITED_PATHS } from '../../middleware/security/rateLimit.middleware';
import Appointment from '../../models/Appointment';
import Lead from '../../models/Lead';
import Notification from '../../models/Notification';
import Student from '../../models/Student';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// Production-hardening behaviour: CORS, JWT algorithm pinning, rate-limit coverage, upload errors,
// blob URLs, meeting links, mail configuration, input validation, prototype-pollution keys and the
// follow-up job lock. In-memory database, mocked mail/blob, no network.

jest.mock('@vercel/blob', () => ({ put: jest.fn() }));

const withEnv = async (vars: Record<string, string | undefined>, fn: () => Promise<void> | void) => {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

const origin = (o: string) => request(app).get('/api/health').set('Origin', o);

describe('CORS', () => {
  it('trusts an unlisted localhost origin outside production only', async () => {
    await withEnv({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'https://crm.example.com', FRONTEND_URL: '' }, async () => {
      expect((await origin('http://localhost:3000')).status).toBe(200);
    });
    await withEnv({ NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://crm.example.com', FRONTEND_URL: '' }, async () => {
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const res = await origin('http://localhost:3000');
      expect(res.status).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  it('accepts configured origins in production, including an explicitly listed localhost', async () => {
    await withEnv(
      { NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://crm.example.com,http://localhost:3000', FRONTEND_URL: 'https://app.example.com' },
      async () => {
        for (const o of ['https://crm.example.com', 'http://localhost:3000', 'https://app.example.com']) {
          const res = await origin(o);
          expect(res.status).toBe(200);
          expect(res.headers['access-control-allow-origin']).toBe(o);
        }
      },
    );
  });
});

describe('JWT verification', () => {
  it('rejects a token signed with another algorithm, even with the right secret', async () => {
    const { user } = await makeStaff('admin');
    const token = jwt.sign({ userId: String(user._id), role: 'admin' }, process.env.JWT_SECRET as string, { algorithm: 'HS512' });
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('rate-limit coverage', () => {
  it('guards every credential endpoint, including student and Google sign-in', () => {
    expect(AUTH_LIMITED_PATHS).toEqual(expect.arrayContaining(['/api/auth/login', '/api/student/auth/register']));
    expect(SIGN_IN_LIMITED_PATHS).toEqual(['/api/auth/google', '/api/student/auth/login', '/api/student/auth/google']);
    expect(ACCOUNT_LOOKUP_PATHS).toContain('/api/auth/check-user');
  });
});

describe('document uploads', () => {
  it('answers a disallowed file type with 400 and the reason, not a generic 500', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { auth } = await makeStudent();
    const res = await request(app)
      .post('/api/student/documents/upload')
      .set('Authorization', auth)
      .field('documentType', 'Passport')
      .attach('file', Buffer.from('MZ'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Only PDF, JPG, PNG, DOC, DOCX files are allowed');
  });

  it('answers an oversized file with 400', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { auth } = await makeStudent();
    const res = await request(app)
      .post('/api/student/documents/upload')
      .set('Authorization', auth)
      .field('documentType', 'Passport')
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('File too large');
  });

  it('stores blobs under an unguessable (random-suffixed) URL', async () => {
    (put as jest.Mock).mockResolvedValue({ url: 'https://blob.example/x-abc123.pdf' });
    await withEnv({ BLOB_READ_WRITE_TOKEN: 'blob-token' }, async () => {
      const stored = await storeUploadedFile({ originalname: 'passport.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf' } as any);
      expect(stored.fileUrl).toBe('https://blob.example/x-abc123.pdf');
    });
    expect((put as jest.Mock).mock.calls[0][2]).toMatchObject({ access: 'public', addRandomSuffix: true });
  });
});

describe('appointment meeting links', () => {
  const create = async () =>
    Appointment.create({ studentId: (await makeStudent()).student._id, type: 'Counseling', scheduledAt: new Date('2030-01-01') });

  it.each(['javascript:alert(document.cookie)', 'data:text/html,<script>alert(1)</script>', 'not a url', 'zoom.us/j/1'])(
    'rejects %s',
    async (meetingLink) => {
      const { auth } = await makeStaff('bdm');
      const appt = await create();
      const res = await request(app).patch(`/api/appointments/${appt._id}`).set('Authorization', auth).send({ meetingLink });
      expect(res.status).toBe(400);
      expect(((await Appointment.findById(appt._id)) as any).meetingLink).toBeUndefined();
    },
  );

  it('accepts an https link and lets staff clear it', async () => {
    const { auth } = await makeStaff('bdm');
    const appt = await create();
    const ok = await request(app)
      .patch(`/api/appointments/${appt._id}`)
      .set('Authorization', auth)
      .send({ meetingLink: ' https://meet.example.com/abc ' });
    expect(ok.status).toBe(200);
    expect(ok.body.appointment.meetingLink).toBe('https://meet.example.com/abc');
    const cleared = await request(app).patch(`/api/appointments/${appt._id}`).set('Authorization', auth).send({ meetingLink: '' });
    expect(cleared.status).toBe(200);
  });
});

describe('mail configuration', () => {
  it('applies bounded SMTP timeouts', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}) } as any);
    await withEnv({ SMTP_HOST: 'smtp.example.test' }, () => sendMail({ to: 'a@b.c', subject: 's', html: 'h' }));
    expect(createTransport.mock.calls[0][0]).toMatchObject({ connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  });

  it('only authenticates when SMTP_USER is set (an empty auth object breaks open relays)', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}) } as any);
    await withEnv({ SMTP_HOST: 'relay.example.test', SMTP_USER: '', SMTP_PASS: '' }, () => sendMail({ to: 'a@b.c', subject: 's', html: 'h' }));
    expect(createTransport.mock.calls[0][0]).not.toHaveProperty('auth');
  });

  it('refuses to send in production without SMTP_HOST instead of silently targeting localhost', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport');
    await withEnv({ NODE_ENV: 'production', SMTP_HOST: '' }, async () => {
      await expect(sendMail({ to: 'a@b.c', subject: 's', html: 'h' })).rejects.toThrow('SMTP_HOST is not set');
    });
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('never builds email links on localhost in production', async () => {
    await withEnv({ NODE_ENV: 'production', FRONTEND_URL: '' }, () => {
      expect(() => frontendBaseUrl()).toThrow('FRONTEND_URL is not set');
    });
    await withEnv({ NODE_ENV: 'production', FRONTEND_URL: 'https://crm.example.com/' }, () => {
      expect(frontendBaseUrl()).toBe('https://crm.example.com');
    });
  });

  it('student forgot-password still answers generically when links cannot be built', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({});
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { student } = await makeStudent();
    await withEnv({ NODE_ENV: 'production', FRONTEND_URL: '', SMTP_HOST: 'smtp.example.test' }, async () => {
      const res = await request(app).post('/api/student/auth/forgot-password').send({ email: student.email });
      expect(res.status).toBe(200);
    });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('warns about missing production variables by name only, and never outside production', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await withEnv({ NODE_ENV: 'test', FRONTEND_URL: '' }, () => warnMissingProductionConfig());
    expect(warn).not.toHaveBeenCalled();
    await withEnv({ NODE_ENV: 'production', FRONTEND_URL: '', SMTP_HOST: 'smtp.secret-host.example' }, () => warnMissingProductionConfig());
    const printed = warn.mock.calls.flat().join('\n');
    expect(printed).toContain('FRONTEND_URL is not set');
    expect(printed).not.toContain('SMTP_HOST');
    expect(printed).not.toContain('secret-host');
  });
});

describe('credential input validation', () => {
  it('student login without an email is a 400 and issues no token', async () => {
    await Student.create({ name: 'First', email: 'first@example.com', passwordHash: await bcrypt.hash('secret1', 4) });
    const res = await request(app).post('/api/student/auth/login').send({ password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.accessToken).toBeUndefined();
  });

  it('student forgot-password without an email sends nothing', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({});
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);
    await makeStudent();
    const res = await request(app).post('/api/student/auth/forgot-password').send({});
    expect(res.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(await Student.countDocuments({ resetPasswordToken: { $exists: true } })).toBe(0);
  });

  it('staff endpoints reject non-string credentials and short passwords with 400', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: ['a@b.c'], password: 'x' })).status).toBe(400);
    expect((await request(app).post('/api/auth/forget-password').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 't', password: '123' })).status).toBe(400);
    const { auth } = await makeStaff('admin');
    const reg = await request(app).post('/api/auth/register').set('Authorization', auth).send({ name: 'N', email: 'n@example.com', role: 'bdm' });
    expect(reg.status).toBe(400);
  });
});

describe('error logging', () => {
  it('never writes a malformed request body (which may hold a password) to the logs', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('Content-Type', 'application/json')
      .send('{"token":"t","password":"Sup3rSecretPw!"');
    expect(res.status).toBe(400);
    expect(res.body.message).not.toMatch(/stack/i);
    const logged = [...warn.mock.calls, ...error.mock.calls].map((c) => c.map(String).join(' ')).join('\n');
    expect(logged).toContain('[400] POST /api/auth/reset-password: entity.parse.failed');
    expect(logged).not.toContain('Sup3rSecretPw');
    expect(error).not.toHaveBeenCalled();
  });
});

describe('prototype-pollution keys', () => {
  it('are removed from bodies before any handler sees them', async () => {
    const echo = express();
    echo.use(express.json());
    echo.use(sanitizeInput);
    echo.post('/', (req, res) => res.json({ keys: Object.keys(req.body), nested: Object.keys(req.body.nested ?? {}) }));
    const res = await request(echo)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"polluted":true},"constructor":{"prototype":{"x":1}},"nested":{"__proto__":{"y":1},"ok":1},"a":1}');
    expect(res.body.keys.sort()).toEqual(['a', 'nested']);
    expect(res.body.nested).toEqual(['ok']);
    expect(({} as any).polluted).toBeUndefined();
  });
});

describe('follow-up reminder job', () => {
  it('names each run by its Asia/Dhaka date and hour', () => {
    expect(runSlot(new Date('2026-10-06T03:00:00Z'))).toBe('2026-10-06T09');
    expect(runSlot(new Date('2026-10-06T19:30:00Z'))).toBe('2026-10-07T01');
  });

  it('runs once per slot across instances and never overlaps', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bdm = await makeStaff('bdm');
    const now = new Date();
    await Lead.create({ fullName: 'Due', phone: '+8801777777779', email: 'due@x.com', assignedTo: bdm.user._id, followUps: [{ date: now, note: 'n', nextFollowUpDate: now }] });

    const at = new Date('2026-10-06T03:00:00Z');
    // Two firings at once (overlap, or two instances on the same tick): exactly one does the work.
    const results = await Promise.all([runFollowUpReminder(at), runFollowUpReminder(at)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    // The same slot again later (another instance whose clock fired late): skipped.
    expect(await runFollowUpReminder(at)).toBe(false);
    expect(await Notification.countDocuments({ recipient: bdm.user._id })).toBe(1);
    // The next slot runs.
    expect(await runFollowUpReminder(new Date('2026-10-06T07:00:00Z'))).toBe(true);
    expect(await Notification.countDocuments({ recipient: bdm.user._id })).toBe(2);
  });
});

// Kept last: it exhausts the in-memory limiter for this file's app instance.
describe('student login rate limiting', () => {
  it('limits repeated student sign-in attempts', async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (await request(app).post('/api/student/auth/login').send({ email: 'nobody@example.com', password: 'wrong-pass' })).status;
    }
    expect(last).toBe(429);
  });
});
