import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import Lead from '../../models/Lead';
import Task from '../../models/Task';
import User from '../../models/User';

// Characterization tests for the dashboard API. Structures are snapshotted (keys + value types,
// so time-dependent values don't make them flaky); deterministic numbers are asserted exactly.

const sign = (userId: string, role: string) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

// Collapses a response to its shape: objects keep keys, arrays keep the shape of their first item.
const shapeOf = (v: any): any => {
  if (Array.isArray(v)) return v.length ? [shapeOf(v[0])] : [];
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shapeOf(v[k])]));
  }
  return v === null ? 'null' : typeof v;
};

let admin: any;
let bdm: any;
let adminAuth: string;
let bdmAuth: string;

beforeEach(async () => {
  admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
  bdm = await User.create({ name: 'Bdm One', email: 'bdm@example.com', passwordHash: 'x', role: 'bdm' });
  adminAuth = `Bearer ${sign(String(admin._id), 'admin')}`;
  bdmAuth = `Bearer ${sign(String(bdm._id), 'bdm')}`;

  const mk = (i: number, stage: string, source: string) =>
    Lead.create({
      fullName: `Lead ${i}`,
      phone: `+880170000000${i}`,
      email: `lead${i}@x.com`,
      lifecycleStage: stage,
      source,
      assignedTo: bdm._id,
    });
  const first = await mk(1, 'New Inquiry', 'Facebook');
  await mk(2, 'Contacted', 'Facebook');
  await mk(3, 'Trial Class', 'Google');
  await mk(4, 'Enrolled', 'Google');
  await mk(5, 'Lost', 'Website');
  await Task.create({ title: 'Call lead', description: 'd', dueDate: new Date(Date.now() + 86400000), status: 'pending', priority: 'high', entityType: 'lead', entityId: first._id, assignedTo: bdm._id });
});

const get = (path: string, auth = bdmAuth) => request(app).get(`/api/dashboard${path}`).set('Authorization', auth);

describe('dashboard auth and headers', () => {
  it('requires auth and sends no-store caching headers', async () => {
    expect((await request(app).get('/api/dashboard/bdm/stats')).status).toBe(401);
    const res = await get('/bdm/stats');
    expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
    expect(res.headers.pragma).toBe('no-cache');
  });

  it('admin-only endpoints reject BDMs', async () => {
    for (const p of ['/admin/stats', '/admin/recent-activity', '/admin/top-performers', '/admin/all']) {
      expect((await get(p)).status).toBe(403);
    }
  });
});

describe('BDM dashboard', () => {
  it('stats: exact KPI values', async () => {
    const res = await get('/bdm/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({
      totalLeads: { value: 5, change: 100 },
      converted: { value: 1, change: 100 },
      inProgress: { value: 3, change: 100 },
      target: { value: '20%', change: 100 },
    });
  });

  it.each([
    '/bdm/recent-leads',
    '/bdm/upcoming-tasks',
    '/lead-stage-distribution',
    '/lead-stage-trend',
    '/lead-source-distribution',
    '/conversion-rate-trend',
    '/status-distribution',
    '/bdm/all',
  ])('%s keeps its response shape', async (path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(shapeOf(res.body)).toMatchSnapshot();
  });

  it('stage distribution counts every stage', async () => {
    const res = await get('/lead-stage-distribution');
    expect(JSON.stringify(res.body.data)).toMatchSnapshot();
  });
});

describe('Admin dashboard', () => {
  it.each(['/admin/stats', '/admin/recent-activity', '/admin/top-performers', '/admin/all'])(
    '%s keeps its response shape',
    async (path) => {
      const res = await get(path, adminAuth);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shapeOf(res.body)).toMatchSnapshot();
    },
  );

  it('top performers ranks the BDM with exact counts and a one-decimal conversion string', async () => {
    const res = await get('/admin/top-performers', adminAuth);
    const row = res.body.data.find((r: any) => r.name === 'Bdm One') ?? res.body.data[0];
    expect(row).toBeDefined();
    const { id, ...rest } = row;
    expect(id).toBe(String(bdm._id));
    expect(rest).toEqual({ rank: 1, name: 'Bdm One', totalLeads: 5, convertedLeads: 1, conversionRate: '20.0' });
  });
});
