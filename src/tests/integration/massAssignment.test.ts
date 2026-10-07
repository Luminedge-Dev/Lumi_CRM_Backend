import request from 'supertest';
import app from '../../app';
import MockTestPackage from '../../models/MockTestPackage';
import MockTestSchedule from '../../models/MockTestSchedule';
import Exam from '../../models/Exam';
import NewsUpdate from '../../models/NewsUpdate';
import { makeStaff } from '../helpers/testAuth';

// Endpoints that persisted req.body directly. Now: allowed fields are accepted, unknown fields
// are ignored, and server-managed fields (_id, createdAt, updatedAt, createdBy) cannot be set.

const ID = '507f1f77bcf86cd799439099';
const OLD_DATE = '2001-01-01T00:00:00.000Z';
const sameInstant = (a: unknown, b: string) => new Date(a as any).getTime() === new Date(b).getTime();

const pkgBody = { testType: 'IELTS', features: ['a'], pricing: [{ testCount: 1, fee: 10 }] };
const scheduleBody = {
  listNumber: 1, name: 'Sched', testType: 'IELTS', examDate: '2030-01-01', examTime: '10:00',
  totalSeats: 10, availableSeats: 10, status: 'upcoming',
};
const courseBody = { name: 'C', testType: 'IELTS', durationMonths: 2, price: 100 };
const examBody = {
  name: 'E', examType: 'Computer-Based', testType: 'IELTS', examDate: '2030-01-01', examTime: '09:00',
  venue: 'V', registrationDeadline: '2029-12-01', fee: 5, totalSlots: 10, availableSlots: 10,
};

describe('mock-test packages (any staff, incl. BDM)', () => {
  it('create: accepts allowed fields, ignores unknown ones, and cannot set _id/timestamps', async () => {
    const { auth } = await makeStaff('bdm');
    const res = await request(app)
      .post('/api/mock-tests/packages').set('Authorization', auth)
      .send({ ...pkgBody, _id: ID, createdAt: OLD_DATE, updatedAt: OLD_DATE, evil: 'x', $set: { isActive: false } });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ testType: 'IELTS', features: ['a'], isActive: true });
    expect(res.body._id).not.toBe(ID);
    expect(sameInstant(res.body.createdAt, OLD_DATE)).toBe(false);
    expect(res.body.evil).toBeUndefined();
  });

  it('update: accepts allowed fields; _id, createdAt and unknown fields are not applied', async () => {
    const { auth } = await makeStaff('bdm');
    const pkg = await MockTestPackage.create(pkgBody);
    const res = await request(app)
      .patch(`/api/mock-tests/packages/${pkg._id}`).set('Authorization', auth)
      .send({ features: ['b'], isActive: false, createdAt: OLD_DATE, evil: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ features: ['b'], isActive: false });
    const stored: any = await MockTestPackage.findById(pkg._id).lean();
    expect(String(stored._id)).toBe(String(pkg._id));
    expect(sameInstant(stored.createdAt, OLD_DATE)).toBe(false);
    expect(stored.evil).toBeUndefined();
  });
});

describe('mock-test schedules (any staff, incl. BDM)', () => {
  it('create ignores protected/unknown fields', async () => {
    const { auth } = await makeStaff('bdm');
    const res = await request(app)
      .post('/api/mock-tests/schedules').set('Authorization', auth)
      .send({ ...scheduleBody, _id: ID, createdAt: OLD_DATE, evil: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Sched', totalSeats: 10, status: 'upcoming' });
    expect(res.body._id).not.toBe(ID);
    expect(sameInstant(res.body.createdAt, OLD_DATE)).toBe(false);
    expect(res.body.evil).toBeUndefined();
  });

  it('update applies allowed fields only', async () => {
    const { auth } = await makeStaff('bdm');
    const s = await MockTestSchedule.create(scheduleBody);
    const res = await request(app)
      .patch(`/api/mock-tests/schedules/${s._id}`).set('Authorization', auth)
      .send({ name: 'Renamed', availableSeats: 3, createdAt: OLD_DATE, _id: ID });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed', availableSeats: 3 });
    expect(res.body._id).toBe(String(s._id));
    expect(sameInstant(res.body.createdAt, OLD_DATE)).toBe(false);
  });
});

describe('courses (admin only)', () => {
  it('create/update accept allowed fields and ignore protected ones', async () => {
    const { auth } = await makeStaff('admin');
    const created = await request(app).post('/api/courses').set('Authorization', auth)
      .send({ ...courseBody, _id: ID, createdAt: OLD_DATE, evil: 'x' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'C', price: 100 });
    expect(created.body._id).not.toBe(ID);
    expect(created.body.evil).toBeUndefined();

    const updated = await request(app).patch(`/api/courses/${created.body._id}`).set('Authorization', auth)
      .send({ price: 250, createdAt: OLD_DATE, _id: ID });
    expect(updated.status).toBe(200);
    expect(updated.body.price).toBe(250);
    expect(updated.body._id).toBe(created.body._id);
    expect(sameInstant(updated.body.createdAt, OLD_DATE)).toBe(false);
  });

  it('a BDM still cannot write courses', async () => {
    const { auth } = await makeStaff('bdm');
    expect((await request(app).post('/api/courses').set('Authorization', auth).send(courseBody)).status).toBe(403);
  });
});

describe('exams (admin only)', () => {
  it('create/update accept allowed fields and ignore protected ones', async () => {
    const { auth } = await makeStaff('admin');
    const created = await request(app).post('/api/exams').set('Authorization', auth)
      .send({ ...examBody, _id: ID, updatedAt: OLD_DATE, evil: 'x' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'E', fee: 5 });
    expect(created.body._id).not.toBe(ID);
    expect(created.body.evil).toBeUndefined();

    const updated = await request(app).patch(`/api/exams/${created.body._id}`).set('Authorization', auth)
      .send({ fee: 9, isActive: false, _id: ID, createdAt: OLD_DATE });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ fee: 9, isActive: false });
    expect(updated.body._id).toBe(created.body._id);
    expect(await Exam.countDocuments()).toBe(1);
  });
});

describe('news update (admin only)', () => {
  it('cannot reassign createdBy or _id; allowed fields apply', async () => {
    const { user: admin, auth } = await makeStaff('admin');
    const post = await NewsUpdate.create({ title: 'T', content: 'C', category: 'General', createdBy: admin._id });
    const res = await request(app).patch(`/api/admin/news/${post._id}`).set('Authorization', auth)
      .send({ title: 'New title', isPinned: true, createdBy: ID, _id: ID });
    expect(res.status).toBe(200);
    expect(res.body.news).toMatchObject({ title: 'New title', isPinned: true });
    const stored: any = await NewsUpdate.findById(post._id).lean();
    expect(String(stored.createdBy)).toBe(String(admin._id));
  });
});
