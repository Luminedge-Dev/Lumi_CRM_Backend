import request from 'supertest';
import app from '../../app';
import Appointment from '../../models/Appointment';
import { makeStaff } from '../helpers/testAuth';

let admin: string;
const ID = '507f1f77bcf86cd799439011';

beforeEach(async () => {
  admin = (await makeStaff('admin')).auth;
  const base = { studentId: ID, type: 'Counseling', scheduledAt: new Date('2030-01-01'), durationMinutes: 30 };
  await Appointment.create({ ...base, status: 'Scheduled' });
  await Appointment.create({ ...base, status: 'Completed' });
});

describe('NoSQL operator injection is neutralised', () => {
  it('a normal filter still works', async () => {
    const res = await request(app).get('/api/appointments?status=Scheduled').set('Authorization', admin);
    expect(res.body.appointments).toHaveLength(1);
  });

  it('a query operator is not honoured: ?status[$ne]=Scheduled does NOT return "everything except Scheduled"', async () => {
    const res = await request(app).get('/api/appointments?status[$ne]=Scheduled').set('Authorization', admin);
    expect(res.status).toBe(200);
    // field dropped -> unfiltered list (2), not the operator result (1 Completed)
    expect(res.body.appointments).toHaveLength(2);
  });

  it('operator objects in a JSON body are dropped: login treats {"email":{"$ne":null}} as missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $gt: '' } });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Email and password are required' });
  });

  it('nested and array operators are removed, ordinary data is untouched', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.com', password: 'pw', extra: { deep: [{ $where: 'x' }, { keep: 1 }] } });
    // reaches the controller normally (unknown user), proving the body was not rejected wholesale
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Invalid credentials' });
  });
});
