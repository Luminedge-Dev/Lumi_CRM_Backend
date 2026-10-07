import request from 'supertest';
import app from '../../app';
import Appointment from '../../models/Appointment';
import { makeStaff } from '../helpers/testAuth';

let staff: string;
const STUDENT = '507f1f77bcf86cd799439022';
const OTHER = '507f1f77bcf86cd799439033';

let appt: any;
beforeEach(async () => {
  staff = (await makeStaff('bdm')).auth;
  appt = await Appointment.create({ studentId: STUDENT, type: 'Counseling', scheduledAt: new Date('2030-01-01'), status: 'Scheduled' });
});

const patch = (id: string, body: object) => request(app).patch(`/api/appointments/${id}`).set('Authorization', staff).send(body);

describe('PATCH /api/appointments/:id', () => {
  it('applies the fields the admin UI sends (status, reschedule)', async () => {
    const res = await patch(appt._id, { status: 'Rescheduled', scheduledAt: '2031-02-02T10:00:00.000Z' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.appointment.status).toBe('Rescheduled');
    expect(new Date(res.body.appointment.scheduledAt).toISOString()).toBe('2031-02-02T10:00:00.000Z');
  });

  it('ignores protected fields (mass assignment): studentId and createdAt cannot be changed', async () => {
    const before = await Appointment.findById(appt._id);
    const res = await patch(appt._id, { status: 'Completed', studentId: OTHER, createdAt: '2000-01-01', _id: OTHER });
    expect(res.status).toBe(200);
    const after = await Appointment.findById(appt._id);
    expect(String(after!.studentId)).toBe(STUDENT);
    expect(after!.createdAt.getTime()).toBe(before!.createdAt.getTime());
    expect(after!.status).toBe('Completed');
  });

  it('rejects an invalid status instead of storing it', async () => {
    const res = await patch(appt._id, { status: 'Bogus' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: 'Invalid appointment data' });
    expect((await Appointment.findById(appt._id))!.status).toBe('Scheduled');
  });

  it('400s on a malformed id and 404s on an unknown one', async () => {
    expect((await patch('not-an-id', { status: 'Completed' })).status).toBe(400);
    const missing = await patch('507f1f77bcf86cd799439099', { status: 'Completed' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, message: 'Appointment not found' });
  });

  it('operator payloads are dropped', async () => {
    const res = await patch(appt._id, { $set: { status: 'Cancelled' }, notes: 'n' });
    expect(res.status).toBe(200);
    const after = await Appointment.findById(appt._id);
    expect(after!.status).toBe('Scheduled');
    expect(after!.notes).toBe('n');
  });
});
