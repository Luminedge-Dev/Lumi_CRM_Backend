import request from 'supertest';
import app from '../../app';
import Task from '../../models/Task';
import { makeStaff, makeStudent } from '../helpers/testAuth';

const ID = '507f1f77bcf86cd799439011';

describe('tasks API hardening', () => {
  it('rejects students on every task route', async () => {
    const { auth } = await makeStudent();
    const res = await request(app).get('/api/tasks').set('Authorization', auth);
    expect(res.status).toBe(403);
  });

  it('ignores server-controlled and unknown fields on create', async () => {
    const { user, auth } = await makeStaff('bdm');
    const res = await request(app)
      .post('/api/tasks')
      .set('Authorization', auth)
      .send({
        title: 'Call lead',
        entityType: 'lead',
        entityId: ID,
        assignedTo: String(user._id),
        completedBy: ID,
        completedAt: '2020-01-01',
        isAdmin: true,
      });
    expect(res.status).toBe(201);
    const saved = await Task.findById(res.body._id).lean();
    expect(saved?.completedBy).toBeUndefined();
    expect(saved?.completedAt).toBeUndefined();
    expect((saved as any).isAdmin).toBeUndefined();
  });

  it('rejects malformed ids with 400 instead of a cast error', async () => {
    const { auth } = await makeStaff('admin');
    expect((await request(app).get('/api/tasks/not-an-id').set('Authorization', auth)).status).toBe(400);
    expect((await request(app).patch('/api/tasks/not-an-id').set('Authorization', auth).send({})).status).toBe(400);
    expect((await request(app).delete('/api/tasks/not-an-id').set('Authorization', auth)).status).toBe(400);
    const bad = await request(app)
      .post('/api/tasks')
      .set('Authorization', auth)
      .send({ title: 't', entityType: 'lead', entityId: 'x', assignedTo: ID });
    expect(bad.status).toBe(400);
  });

  it('sets completedBy/completedAt from the session, not the body', async () => {
    const { user, auth } = await makeStaff('bdm');
    const task = await Task.create({ title: 't', entityType: 'lead', entityId: ID, assignedTo: user._id });
    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Authorization', auth)
      .send({ status: 'completed', completedBy: ID, completedAt: '2001-01-01' });
    expect(res.status).toBe(200);
    const saved = await Task.findById(task._id).lean();
    expect(String(saved?.completedBy)).toBe(String(user._id));
    expect(saved!.completedAt!.getFullYear()).toBeGreaterThan(2020);
  });
});
