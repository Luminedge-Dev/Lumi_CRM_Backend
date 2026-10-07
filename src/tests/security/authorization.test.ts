import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Notification from '../../models/Notification';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// Student JWTs are signed with the same secret as staff JWTs. Routes that only run
// authenticateToken (no role check) used to accept them. Staff-only routes must reject students
// while legitimate staff and student access keeps working.

const ID = '507f1f77bcf86cd799439011';

type Route = [method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string];

const STAFF_ONLY: Route[] = [
  ['get', '/api/appointments'],
  ['patch', `/api/appointments/${ID}`],
  ['get', `/api/documents/${ID}`],
  ['post', '/api/documents/request'],
  ['patch', `/api/documents/${ID}/review`],
  ['post', '/api/documents/upload'],
  ['get', `/api/milestones/${ID}`],
  ['patch', `/api/milestones/${ID}`],
  ['get', '/api/conversations/staff'],
  ['get', `/api/conversations/${ID}/messages/staff`],
  ['post', `/api/conversations/${ID}/messages/staff`],
  ['post', '/api/conversations'],
  ['get', '/api/admin/conversations'],
  ['get', '/api/applications/my'],
  ['get', `/api/applications/${ID}`],
  ['get', '/api/mock-tests/packages'],
  ['post', '/api/mock-tests/packages'],
  ['patch', `/api/mock-tests/packages/${ID}`],
  ['delete', `/api/mock-tests/packages/${ID}`],
  ['get', '/api/mock-tests/schedules'],
  ['post', '/api/mock-tests/schedules'],
  ['get', '/api/mock-test-packages'],
  ['post', '/api/mock-test-packages'],
  ['post', '/api/mock-test-packages/seed'],
  ['put', '/api/mock-test-packages/IELTS'],
  ['delete', '/api/mock-test-packages/IELTS'],
  ['get', '/api/schedules'],
  ['get', '/api/dashboard/bdm/stats'],
  ['get', '/api/dashboard/bdm/all'],
  ['get', '/api/dashboard/lead-stage-distribution'],
];

// Listed above because students must be rejected, but BDMs are rejected too (authorizeRoles('admin')).
const ADMIN_ONLY_PATHS = ['/api/conversations', '/api/admin/conversations'];

// GET /api/schedules proxies an external server. Tests must never reach the network.
beforeEach(() => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
});
afterEach(() => jest.restoreAllMocks());

const call = (method: Route[0], path: string, auth: string) => (request(app) as any)[method](path).set('Authorization', auth).send({});

describe('student tokens are rejected by staff-only routes', () => {
  it.each(STAFF_ONLY)('%s %s -> 403 for a student token', async (method, path) => {
    const { auth } = await makeStudent();
    const res = await call(method, path, auth);
    expect(res.status).toBe(403);
  });
});

describe('staff are not locked out', () => {
  it.each(['admin', 'bdm'] as const)('%s passes the role gate on staff routes (not 401/403)', async (role) => {
    const { auth } = await makeStaff(role);
    for (const [method, path] of STAFF_ONLY) {
      const res = await call(method, path, auth);
      if (role === 'bdm' && ADMIN_ONLY_PATHS.includes(path)) {
        expect(res.status).toBe(403);
      } else {
        expect([401, 403]).not.toContain(res.status);
      }
    }
  });
});

describe('student routes still work for students and not for staff', () => {
  it('student-only routes accept a student token', async () => {
    const { auth } = await makeStudent();
    for (const path of ['/api/student/milestones', '/api/student/appointments', '/api/student/documents', '/api/student/applications', '/api/conversations/student']) {
      const res = await request(app).get(path).set('Authorization', auth);
      expect(res.status).toBe(200);
    }
  });

  it('student-only routes reject a staff token', async () => {
    const { auth } = await makeStaff('admin');
    const res = await request(app).get('/api/student/milestones').set('Authorization', auth);
    expect(res.status).toBe(403);
  });
});

describe('notifications are staff-only and scoped to the caller', () => {
  it('a student token is rejected and never sees staff notifications', async () => {
    const { user: admin } = await makeStaff('admin');
    await Notification.create({ recipient: admin._id, title: 'secret', message: 'm', type: 'info' });

    const { auth } = await makeStudent();
    const res = await request(app).get('/api/notifications').set('Authorization', auth);
    expect(res.status).toBe(403);
    expect(res.body.data).toBeUndefined();
  });

  it('a student token cannot mark other users notifications as read', async () => {
    const { user: admin } = await makeStaff('admin');
    await Notification.create({ recipient: admin._id, title: 't', message: 'm', type: 'info' });

    const { auth } = await makeStudent();
    expect((await request(app).put('/api/notifications/read-all').set('Authorization', auth)).status).toBe(403);
    expect(await Notification.countDocuments({ isRead: false })).toBe(1);
  });
});

describe('/api/auth self-service routes are staff-only (students use /api/student/profile)', () => {
  const ROUTES: Route[] = [
    ['get', '/api/auth/profile'],
    ['put', '/api/auth/profile'],
    ['post', '/api/auth/change-password'],
    ['get', '/api/auth/stats'],
  ];

  it.each(ROUTES)('%s %s -> 403 for a student token', async (method, path) => {
    const { auth } = await makeStudent();
    expect((await call(method, path, auth)).status).toBe(403);
  });

  it.each(['admin', 'bdm'] as const)('%s still reaches the profile, stats and notification routes', async (role) => {
    const { auth } = await makeStaff(role);
    expect((await request(app).get('/api/auth/profile').set('Authorization', auth)).status).toBe(200);
    expect((await request(app).get('/api/auth/stats').set('Authorization', auth)).status).toBe(200);
    expect((await request(app).get('/api/notifications').set('Authorization', auth)).status).toBe(200);
  });
});

describe('an old token stops working when the account state changes', () => {
  it('deactivated staff are refused immediately (token unchanged)', async () => {
    const { user, auth } = await makeStaff('bdm');
    expect((await request(app).get('/api/leads').set('Authorization', auth)).status).toBe(200);

    await User.updateOne({ _id: user._id }, { isActive: false });
    const res = await request(app).get('/api/leads').set('Authorization', auth);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Account is inactive' });
  });

  it('a deleted staff account is refused', async () => {
    const { user, auth } = await makeStaff('bdm');
    await User.deleteOne({ _id: user._id });
    const res = await request(app).get('/api/leads').set('Authorization', auth);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Account no longer exists' });
  });

  it('a demoted admin loses admin rights immediately', async () => {
    const { user, auth } = await makeStaff('admin');
    expect((await request(app).get('/api/dashboard/admin/stats').set('Authorization', auth)).status).toBe(200);

    await User.updateOne({ _id: user._id }, { role: 'bdm' });
    expect((await request(app).get('/api/dashboard/admin/stats').set('Authorization', auth)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/bdm/stats').set('Authorization', auth)).status).toBe(200);
  });

  it('a promoted user is not stuck with the old token role either', async () => {
    const { user, auth } = await makeStaff('bdm');
    expect((await request(app).get('/api/dashboard/admin/stats').set('Authorization', auth)).status).toBe(403);
    await User.updateOne({ _id: user._id }, { role: 'admin' });
    expect((await request(app).get('/api/dashboard/admin/stats').set('Authorization', auth)).status).toBe(200);
  });

  it('legacy accounts without an isActive field stay active', async () => {
    const { user, auth } = await makeStaff('bdm');
    await User.collection.updateOne({ _id: user._id }, { $unset: { isActive: '' } });
    expect((await request(app).get('/api/leads').set('Authorization', auth)).status).toBe(200);
  });

  it('deactivated students are refused on student and shared routes', async () => {
    const { student, auth } = await makeStudent();
    expect((await request(app).get('/api/student/milestones').set('Authorization', auth)).status).toBe(200);

    student.isActive = false;
    await student.save();
    const own = await request(app).get('/api/student/milestones').set('Authorization', auth);
    expect(own.status).toBe(403);
    expect(own.body).toEqual({ error: 'Account is inactive' });
    expect((await request(app).get('/api/notifications').set('Authorization', auth)).status).toBe(403);
  });

  it('a token for an account that never existed is refused', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign({ userId: ID, role: 'admin' }, process.env.JWT_SECRET as string);
    const res = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('a token missing both userId and studentId is refused', async () => {
    const jwt = await import('jsonwebtoken');
    const token = jwt.default.sign({ role: 'admin' }, process.env.JWT_SECRET as string);
    const res = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
