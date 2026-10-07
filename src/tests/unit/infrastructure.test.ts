import request from 'supertest';
import express from 'express';
import nodemailer from 'nodemailer';
import app from '../../app';
import { config, assertRequiredConfig } from '../../config';
import { AppError, ErrorCodes } from '../../core/errors';
import { asyncHandler } from '../../core/http';
import { sendMail, frontendBaseUrl } from '../../integrations/mail/mail.service';
import { staffPasswordResetEmail, staffPasswordSetupEmail, studentPasswordResetEmail } from '../../integrations/mail/mail.templates';
import { startKeepAliveJob } from '../../jobs/keepAlive.job';
import { checkFollowUpsDueToday } from '../../jobs/followUpReminder.job';
import { storeUploadedFile } from '../../integrations/storage/fileStorage';
import Lead from '../../models/Lead';
import Notification from '../../models/Notification';
import { makeStaff } from '../helpers/testAuth';

// Configuration, error model, mail, jobs, storage and the app-level error/guard middleware.
// Everything is mocked or in-memory: no SMTP, no network, no production database.

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

describe('config', () => {
  it('reads environment variables lazily', async () => {
    await withEnv({ GOOGLE_CLIENT_ID: 'client-123' }, () => expect(config.google.clientId).toBe('client-123'));
    await withEnv({ GOOGLE_CLIENT_ID: '' }, () => expect(config.google.clientId).toBeUndefined());
  });

  it('JWT secret is required', async () => {
    expect(config.jwt.secret).toBe('test-jwt-secret');
    await withEnv({ JWT_SECRET: undefined }, () => {
      expect(() => config.jwt.secret).toThrow('JWT_SECRET environment variable is not set');
      expect(() => assertRequiredConfig()).toThrow();
    });
  });

  it('production must name its database; non-production may fall back to a local one', async () => {
    await withEnv({ NODE_ENV: 'production', MONGODB_URI: undefined }, () => {
      expect(() => config.database.uri).toThrow('MONGODB_URI environment variable is not set');
    });
    await withEnv({ NODE_ENV: 'development', MONGODB_URI: undefined }, () => {
      expect(config.database.uri).toMatch(/^mongodb:\/\/localhost/);
    });
  });

  it('parses the CORS origin list and SMTP settings', async () => {
    await withEnv({ ALLOWED_ORIGINS: 'https://a.example.com/, https://b.example.com', SMTP_PORT: '2525', SMTP_SECURE: 'true' }, () => {
      expect([...config.cors.origins]).toEqual(['https://a.example.com', 'https://b.example.com']);
      expect(config.smtp.port).toBe(2525);
      expect(config.smtp.secure).toBe(true);
    });
    await withEnv({ ALLOWED_ORIGINS: undefined, SMTP_PORT: undefined, SMTP_SECURE: undefined }, () => {
      expect([...config.cors.origins]).toEqual(['http://localhost:3000', 'http://localhost:3001']);
      expect(config.smtp.port).toBe(587);
      expect(config.smtp.secure).toBe(false);
    });
  });
});

describe('AppError and asyncHandler', () => {
  const mount = (handler: express.RequestHandler) => {
    const a = express();
    a.get('/x', handler);
    return a;
  };

  it('AppError carries status, code and extra fields', () => {
    const e = AppError.conflict('taken', { details: 'd' });
    expect([e.status, e.code, e.message, e.extra]).toEqual([409, ErrorCodes.CONFLICT, 'taken', { details: 'd' }]);
    expect(AppError.notFound('n').status).toBe(404);
    expect(AppError.forbidden('f').status).toBe(403);
  });

  it('renders an AppError in each established body shape', async () => {
    const boom = async () => {
      throw AppError.notFound('Nope');
    };
    expect((await request(mount(asyncHandler(boom))).get('/x')).body).toEqual({ error: 'Nope' });
    expect((await request(mount(asyncHandler(boom, { shape: 'message' }))).get('/x')).body).toEqual({ message: 'Nope' });
    expect((await request(mount(asyncHandler(boom, { shape: 'success' }))).get('/x')).body).toEqual({ success: false, message: 'Nope' });
  });

  it('never echoes the text of an unexpected error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(
      mount(
        asyncHandler(
          async () => {
            throw new Error('MongoServerError: auth failed for user admin at /srv/app/db.js');
          },
          { fallbackMessage: 'Failed to do it', fallbackStatus: 400 },
        ),
      ),
    ).get('/x');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Failed to do it' });
  });
});

describe('app-level middleware', () => {
  it('malformed JSON is a 400 with a client-safe message and no stack', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"broken');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.stack).toBeUndefined();
  });

  it('unknown routes are 404 with the route in the message', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: 'Route GET /api/does-not-exist not found' });
  });

  it('health check and the Socket.IO short-circuit work without a database round trip', async () => {
    expect((await request(app).get('/api/health')).body).toEqual({ status: 'OK', message: 'CRM API is running' });
    expect((await request(app).get('/socket.io/?EIO=4')).status).toBe(404);
  });

  it('a disallowed CORS origin is rejected', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(403);
  });

  it('upload filter refuses unsupported file types as a 400 with the (authored) reason, not a 5xx', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { auth } = await makeStaff('bdm');
    const res = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', auth)
      .field('studentId', '507f1f77bcf86cd799439011')
      .field('documentType', 'Passport')
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Only PDF, JPG, PNG, DOC, DOCX files are allowed' });
  });
});

describe('socket bridge endpoint', () => {
  const post = (secret?: string) => {
    const r = request(app).post('/api/internal/socket/notifications');
    return (secret ? r.set('x-socket-server-secret', secret) : r).send({ recipientId: 'u1', notification: { title: 't' } });
  };

  it('503 when no bridge secret is configured', async () => {
    await withEnv({ SOCKET_SERVER_SECRET: '' }, async () => {
      expect((await post('anything')).status).toBe(503);
    });
  });

  it('403 for a missing or wrong secret, 400 for a missing payload, 200 for the right secret', async () => {
    await withEnv({ SOCKET_SERVER_SECRET: 'bridge-secret' }, async () => {
      expect((await post()).status).toBe(403);
      expect((await post('wrong-secret!')).status).toBe(403);
      expect((await post('x')).status).toBe(403);
      const noPayload = await request(app).post('/api/internal/socket/notifications').set('x-socket-server-secret', 'bridge-secret').send({});
      expect(noPayload.status).toBe(400);
      const ok = await post('bridge-secret');
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ success: true });
    });
  });
});

describe('mail integration (nodemailer is mocked)', () => {
  it('builds the transport from configuration and sends with the configured From address', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({});
    const createTransport = jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);

    await withEnv(
      { SMTP_HOST: 'smtp.example.test', SMTP_PORT: '2525', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASS: 'p', SMTP_FROM: 'crm@example.test' },
      async () => {
        await sendMail({ to: 'a@b.c', subject: 's', html: '<p>h</p>' });
      },
    );
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.test',
      port: 2525,
      secure: true,
      auth: { user: 'u', pass: 'p' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    expect(sendMailMock).toHaveBeenCalledWith({ from: 'crm@example.test', to: 'a@b.c', subject: 's', html: '<p>h</p>' });
  });

  it('falls back to the default From address and the local frontend URL', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({});
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);
    await withEnv({ SMTP_FROM: '', FRONTEND_URL: '' }, async () => {
      await sendMail({ to: 'a@b.c', subject: 's', html: 'h' });
      expect(frontendBaseUrl()).toBe('http://localhost:3000');
    });
    expect(sendMailMock.mock.calls[0][0].from).toBe('noreply@luminedge.com');
  });

  it('templates carry the recipient, name and link', () => {
    const url = 'https://app.example.com/reset?token=abc';
    for (const msg of [staffPasswordSetupEmail('x@y.z', 'Rahim', url), staffPasswordResetEmail('x@y.z', 'Rahim', url), studentPasswordResetEmail('x@y.z', 'Rahim', url)]) {
      expect(msg.to).toBe('x@y.z');
      expect(msg.html).toContain('Rahim');
      expect(msg.html).toContain(url);
    }
    expect(staffPasswordResetEmail('a', 'b', 'c').subject).toBe('Password Reset Request - Luminedge CRM');
  });

  it('forgot-password sends exactly one reset email through the mail integration', async () => {
    const sendMailMock = jest.fn().mockResolvedValue({});
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);
    const { user } = await makeStaff('bdm');
    const res = await request(app).post('/api/auth/forget-password').send({ email: user.email });
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0]).toMatchObject({ to: user.email, subject: 'Password Reset Request - Luminedge CRM' });
  });
});

describe('jobs', () => {
  it('keep-alive does nothing outside production or without a public URL', async () => {
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    await withEnv({ NODE_ENV: 'test', RENDER_EXTERNAL_URL: 'https://x.example.com' }, () => expect(startKeepAliveJob()).toBeUndefined());
    await withEnv({ NODE_ENV: 'production', RENDER_EXTERNAL_URL: '' }, () => expect(startKeepAliveJob()).toBeUndefined());
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('keep-alive schedules a ping in production when a public URL is set', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    let timer: NodeJS.Timeout | undefined;
    await withEnv({ NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://x.example.com' }, () => {
      timer = startKeepAliveJob();
    });
    expect(timer).toBeDefined();
    clearInterval(timer);
  });

  it('follow-up reminder notifies the assigned BDM and the admins for follow-ups due today only', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');
    const now = new Date();
    const inThreeDays = new Date(now.getTime() + 3 * 86400_000);
    await Lead.create({ fullName: 'Due Today', phone: '+8801777777771', email: 'd1@x.com', assignedTo: bdm.user._id, followUps: [{ date: now, note: 'n', nextFollowUpDate: now }] });
    await Lead.create({ fullName: 'Later', phone: '+8801777777772', email: 'd2@x.com', assignedTo: bdm.user._id, followUps: [{ date: now, note: 'n', nextFollowUpDate: inThreeDays }] });
    await Lead.create({ fullName: 'Unassigned', phone: '+8801777777773', email: 'd3@x.com', followUps: [{ date: now, note: 'n', nextFollowUpDate: now }] });

    await checkFollowUpsDueToday();

    const bdmNotes = await Notification.find({ recipient: bdm.user._id });
    expect(bdmNotes).toHaveLength(1);
    expect(bdmNotes[0].message).toContain('Due Today');
    const adminNotes = await Notification.find({ recipient: admin.user._id });
    expect(adminNotes).toHaveLength(1);
    expect(adminNotes[0].message).toContain(bdm.user.name);
  });
});

describe('file storage', () => {
  it('refuses to write to disk in production when no blob token is configured', async () => {
    await withEnv({ NODE_ENV: 'production', BLOB_READ_WRITE_TOKEN: '' }, async () => {
      await expect(storeUploadedFile({ originalname: 'a.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf' } as any)).rejects.toThrow(
        'File uploads are unavailable',
      );
    });
  });
});
