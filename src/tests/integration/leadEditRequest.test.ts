import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import Lead from '../../models/Lead';
import User from '../../models/User';
import LeadEditRequest from '../../models/LeadEditRequest';
import Notification from '../../models/Notification';

// Characterization tests for the BDM -> admin edit-request workflow (response keys are `{error}`).

const sign = (userId: string, role: string) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

let admin: any;
let bdm: any;
let otherBdm: any;
let lead: any;
const auth = (u: any, role: string) => `Bearer ${sign(String(u._id), role)}`;

beforeEach(async () => {
  admin = await User.create({ name: 'Admin', email: 'admin@example.com', passwordHash: 'x', role: 'admin' });
  bdm = await User.create({ name: 'Bdm One', email: 'bdm@example.com', passwordHash: 'x', role: 'bdm' });
  otherBdm = await User.create({ name: 'Bdm Two', email: 'bdm2@example.com', passwordHash: 'x', role: 'bdm' });
  lead = await Lead.create({ fullName: 'Lead', phone: '+8801711111111', email: 'lead@x.com', assignedTo: bdm._id });
});

const submit = (who: any, role: string, body: any, leadId = lead._id) =>
  request(app).post(`/api/leads/${leadId}/edit-requests`).set('Authorization', auth(who, role)).send(body);

describe('POST /api/leads/:leadId/edit-requests', () => {
  it('creates a pending request for the assigned BDM and notifies admins', async () => {
    const res = await submit(bdm, 'bdm', { section: 'stage', payload: { lifecycleStage: 'Contacted' } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, message: 'Request sent to admin for approval' });
    expect(res.body.request).toMatchObject({ status: 'pending', section: 'stage', requestedByName: 'Bdm One' });
    expect(typeof res.body.summary).toBe('string');
    expect(await Notification.findOne({ title: 'Lead Edit Request' })).not.toBeNull();
  });

  it('403s a BDM who is not assigned to the lead', async () => {
    const res = await submit(otherBdm, 'bdm', { section: 'stage', payload: { lifecycleStage: 'Lost' } });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'You are not assigned to this lead' });
  });

  it('validates the payload', async () => {
    expect((await submit(bdm, 'bdm', { section: 'general' })).body).toEqual({ error: 'Request payload is required' });
    expect((await submit(bdm, 'bdm', { section: 'follow-up', payload: {} })).body).toEqual({ error: 'Follow-up note is required' });
    expect((await submit(bdm, 'bdm', { section: 'stage', payload: {} })).body).toEqual({ error: 'Lifecycle stage is required' });
  });

  it('404s for an unknown lead', async () => {
    const res = await submit(admin, 'admin', { payload: { notes: 'x' } }, '507f1f77bcf86cd799439011' as any);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Lead not found' });
  });
});

describe('GET /api/lead-edit-requests', () => {
  it('scopes BDMs to their own requests; admins see all', async () => {
    await LeadEditRequest.create({ leadId: lead._id, section: 'stage', payload: { lifecycleStage: 'Contacted' }, requestedBy: bdm._id });
    await LeadEditRequest.create({ leadId: lead._id, section: 'stage', payload: { lifecycleStage: 'Lost' }, requestedBy: otherBdm._id });

    const mine = await request(app).get('/api/lead-edit-requests').set('Authorization', auth(bdm, 'bdm'));
    expect(mine.body.success).toBe(true);
    expect(mine.body.requests).toHaveLength(1);

    const all = await request(app).get('/api/lead-edit-requests').set('Authorization', auth(admin, 'admin'));
    expect(all.body.requests).toHaveLength(2);
  });
});

describe('PATCH /api/lead-edit-requests/:id/approve|reject', () => {
  const makeRequest = (section: string, payload: any) =>
    LeadEditRequest.create({ leadId: lead._id, section, payload, requestedBy: bdm._id, status: 'pending' });

  it('is admin-only', async () => {
    const r = await makeRequest('stage', { lifecycleStage: 'Contacted' });
    const res = await request(app).patch(`/api/lead-edit-requests/${r._id}/approve`).set('Authorization', auth(bdm, 'bdm'));
    expect(res.status).toBe(403);
  });

  it('approve applies a stage change to the lead and notifies the requester', async () => {
    const r = await makeRequest('stage', { lifecycleStage: 'Contacted' });
    const res = await request(app)
      .patch(`/api/lead-edit-requests/${r._id}/approve`)
      .set('Authorization', auth(admin, 'admin'))
      .send({ reviewNote: 'ok' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.request).toMatchObject({ status: 'approved', reviewNote: 'ok' });
    expect((await Lead.findById(lead._id))!.lifecycleStage).toBe('Contacted');
    const note = await Notification.findOne({ title: 'Lead Edit Request Approved' });
    expect(note).not.toBeNull();
  });

  it('approve of a follow-up pushes it onto the lead', async () => {
    const r = await makeRequest('follow-up', { note: 'called them' });
    const res = await request(app).patch(`/api/lead-edit-requests/${r._id}/approve`).set('Authorization', auth(admin, 'admin'));
    expect(res.status).toBe(200);
    expect((await Lead.findById(lead._id))!.followUps.map((f) => f.note)).toEqual(['called them']);
  });

  it('reject leaves the lead untouched', async () => {
    const r = await makeRequest('stage', { lifecycleStage: 'Lost' });
    const res = await request(app).patch(`/api/lead-edit-requests/${r._id}/reject`).set('Authorization', auth(admin, 'admin'));
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe('rejected');
    expect((await Lead.findById(lead._id))!.lifecycleStage).toBe('New Inquiry');
    expect(await Notification.findOne({ title: 'Lead Edit Request Rejected' })).not.toBeNull();
  });

  it('refuses to review twice and 404s unknown ids', async () => {
    const r = await makeRequest('stage', { lifecycleStage: 'Contacted' });
    await request(app).patch(`/api/lead-edit-requests/${r._id}/reject`).set('Authorization', auth(admin, 'admin'));
    const again = await request(app).patch(`/api/lead-edit-requests/${r._id}/approve`).set('Authorization', auth(admin, 'admin'));
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ error: 'Request has already been reviewed' });

    const missing = await request(app).patch('/api/lead-edit-requests/507f1f77bcf86cd799439011/approve').set('Authorization', auth(admin, 'admin'));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'Request not found' });
  });
});
