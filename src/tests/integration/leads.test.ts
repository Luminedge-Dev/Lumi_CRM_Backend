import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import Lead from '../../models/Lead';
import User from '../../models/User';

// Characterization tests: they pin the CURRENT behaviour and response shapes of the leads API
// (the frontend depends on the exact keys) so the service-layer refactor can't change them.

const sign = (userId: string, role: string) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

let admin: any;
let bdm: any;
let adminAuth: string;
let bdmAuth: string;

beforeEach(async () => {
  admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
  bdm = await User.create({ name: 'Bdm One', email: 'bdm@example.com', passwordHash: 'x', role: 'bdm' });
  adminAuth = `Bearer ${sign(String(admin._id), 'admin')}`;
  bdmAuth = `Bearer ${sign(String(bdm._id), 'bdm')}`;
});

const seed = (over: Record<string, unknown> = {}) =>
  Lead.create({ fullName: 'Lead', phone: `+88017${Math.floor(10000000 + Math.random() * 89999999)}`, email: `l${Math.random()}@x.com`, ...over });

describe('GET /api/leads', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/leads')).status).toBe(401);
  });

  it('returns the paginated shape', async () => {
    await seed({ fullName: 'A' });
    await seed({ fullName: 'B' });
    const res = await request(app).get('/api/leads?limit=1').set('Authorization', bdmAuth);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['leads', 'limit', 'page', 'total', 'totalPages']);
    expect(res.body).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect(res.body.leads).toHaveLength(1);
  });

  it('caps limit at 500 and defaults page/limit', async () => {
    const res = await request(app).get('/api/leads?limit=99999&page=-3').set('Authorization', adminAuth);
    expect(res.body).toMatchObject({ page: 1, limit: 500 });
  });
});

describe('POST /api/leads', () => {
  const body = { fullName: 'New Lead', phone: '+8801711111111', email: 'new@example.com', source: 'Facebook', serviceInterest: ['IELTS Reg'] };

  it('creates a lead with defaults and returns it populated', async () => {
    const res = await request(app).post('/api/leads').set('Authorization', bdmAuth).send({ ...body, assignedTo: String(bdm._id) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fullName: 'New Lead', lifecycleStage: 'New Inquiry', source: 'Facebook' });
    expect(res.body.assignedTo).toMatchObject({ name: 'Bdm One', email: 'bdm@example.com' });
  });

  it('rejects a duplicate phone with 409 and an {error} body', async () => {
    await seed({ phone: body.phone });
    const res = await request(app).post('/api/leads').set('Authorization', bdmAuth).send(body);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'This number already exists. Already used, try with another number.' });
  });
});

describe('GET /api/leads/:id', () => {
  it('returns a bare lead object with follow-ups newest first', async () => {
    const lead = await seed({
      followUps: [
        { note: 'old', createdAt: new Date('2024-01-01') },
        { note: 'new', createdAt: new Date('2025-01-01') },
      ],
    });
    const res = await request(app).get(`/api/leads/${lead._id}`).set('Authorization', bdmAuth);
    expect(res.status).toBe(200);
    expect(res.body.followUps.map((f: any) => f.note)).toEqual(['new', 'old']);
  });

  it('404s with {error} for an unknown id', async () => {
    const res = await request(app).get('/api/leads/507f1f77bcf86cd799439011').set('Authorization', bdmAuth);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Lead not found' });
  });
});

describe('GET /api/leads/stage-counts and /stats', () => {
  it('returns a bare record with all five stages', async () => {
    await seed({ lifecycleStage: 'Contacted' });
    await seed({ lifecycleStage: 'Contacted' });
    await seed({ lifecycleStage: 'Lost' });
    const res = await request(app).get('/api/leads/stage-counts').set('Authorization', bdmAuth);
    expect(res.body).toEqual({ 'New Inquiry': 0, Contacted: 2, 'Trial Class': 0, Enrolled: 0, Lost: 1 });
  });

  it('returns total, newToday and byStage', async () => {
    await seed({ lifecycleStage: 'Enrolled' });
    const res = await request(app).get('/api/leads/stats').set('Authorization', bdmAuth);
    expect(res.body).toEqual({ total: 1, newToday: 1, byStage: { Enrolled: 1 } });
  });
});

describe('POST /api/leads/import', () => {
  it('is admin-only', async () => {
    const res = await request(app).post('/api/leads/import').set('Authorization', bdmAuth).send({ leads: [] });
    expect(res.status).toBe(403);
  });

  it('400s with {error} when leads is not an array', async () => {
    const res = await request(app).post('/api/leads/import').set('Authorization', adminAuth).send({ leads: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid leads data. Expected array of leads.' });
  });

  it('inserts new rows, updates existing by email, and reports skips', async () => {
    await seed({ email: 'exists@x.com', phone: '+8801722222222', fullName: 'Old Name', notes: 'keep' });
    await seed({ phone: '+8801733333333', email: 'taken@x.com' });

    const res = await request(app)
      .post('/api/leads/import')
      .set('Authorization', adminAuth)
      .send({
        leads: [
          { email: 'fresh@x.com', phone: '+8801744444444', fullName: 'Fresh' },
          { email: 'EXISTS@x.com', fullName: 'Updated Name' },
          { fullName: 'No email', phone: '+8801755555555' },
          { email: 'dupe-phone@x.com', phone: '+8801733333333' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(res.body.failed).toBe(2);
    expect(res.body.errors).toEqual(
      expect.arrayContaining(['Row skipped: missing email', expect.stringContaining('phone already exists')]),
    );

    const updated = await Lead.findOne({ email: 'exists@x.com' });
    expect(updated).toMatchObject({ fullName: 'Updated Name', notes: 'keep' });
    expect(await Lead.exists({ email: 'fresh@x.com' })).toBeTruthy();
  });
});
