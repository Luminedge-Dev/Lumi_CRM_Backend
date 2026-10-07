import request from 'supertest';
import app from '../../app';
import Lead from '../../models/Lead';
import { makeStaff } from '../helpers/testAuth';

// Lead create/update/import must never echo raw driver/internal error text to the client.
// Everything runs against the isolated in-memory database; failures are injected with mocks.

const INTERNAL = 'MongoServerError: connection to cluster0-shard-00-00.secret.mongodb.net:27017 at /srv/app/dist/x.js failed';

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/leads', () => {
  const body = { fullName: 'New Lead', phone: '+8801711111111', email: 'new@example.com', source: 'Facebook' };

  it('an unexpected error returns 500 with a generic message only', async () => {
    const { auth } = await makeStaff('bdm');
    jest.spyOn(Lead.prototype, 'save').mockRejectedValue(new Error(INTERNAL));
    const res = await request(app).post('/api/leads').set('Authorization', auth).send(body);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to create lead' });
    expect(JSON.stringify(res.body)).not.toContain('cluster0');
  });

  it('a Mongoose validation failure is still a 400 {error} about the caller input', async () => {
    const { auth } = await makeStaff('bdm');
    const res = await request(app).post('/api/leads').set('Authorization', auth).send({ ...body, source: 'not-a-real-source' });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error).not.toMatch(/\/|stack|node_modules/);
  });
});

describe('PATCH /api/leads/:id', () => {
  it('an unexpected error returns 500 with a generic message only', async () => {
    const { auth } = await makeStaff('admin');
    const lead = await Lead.create({ fullName: 'L', phone: '+8801700000001', email: 'l@x.com' });
    jest.spyOn(Lead, 'findByIdAndUpdate').mockImplementation((() => {
      throw new Error(INTERNAL);
    }) as any);
    const res = await request(app).patch(`/api/leads/${lead._id}`).set('Authorization', auth).send({ notes: 'x' });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to update lead' });
  });
});

describe('POST /api/leads/import', () => {
  it('per-row failures report a safe message, not the raw error text', async () => {
    const { auth } = await makeStaff('admin');
    jest.spyOn(Lead.prototype, 'save').mockRejectedValue(new Error(INTERNAL));
    const res = await request(app)
      .post('/api/leads/import').set('Authorization', auth)
      .send({ leads: [{ email: 'fresh@x.com', phone: '+8801744444444', fullName: 'Fresh' }] });
    expect(res.status).toBe(200);
    expect(res.body.failed).toBe(1);
    expect(JSON.stringify(res.body)).not.toContain('cluster0');
    expect(JSON.stringify(res.body)).not.toContain('/srv/app');
    expect(res.body.errors).toEqual([expect.stringContaining('could not be imported')]);
  });
});
