import request from 'supertest';
import app from '../../app';
import Course from '../../models/Course';
import Exam from '../../models/Exam';
import MockTestPackage from '../../models/MockTestPackage';
import MockTestSchedule from '../../models/MockTestSchedule';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// Courses, exams, mock tests, mock-test packages and schedules: filters, sorts, CRUD shapes.

const ID = '507f1f77bcf86cd799439011';

describe('courses', () => {
  const course = (over: Record<string, unknown> = {}) => ({ name: 'C', testType: 'IELTS', durationMonths: 2, price: 100, ...over });

  it('lists with filters and sorts; any signed-in user (incl. a student) may read', async () => {
    await Course.create(course({ name: 'B', price: 300, testType: 'PTE' }));
    await Course.create(course({ name: 'A', price: 200, isActive: false }));
    const stu = await makeStudent();

    const all = await request(app).get('/api/courses').set('Authorization', stu.auth);
    expect(all.status).toBe(200);
    expect(all.body).toHaveLength(2);
    expect((await request(app).get('/api/courses?testType=PTE').set('Authorization', stu.auth)).body).toHaveLength(1);
    expect((await request(app).get('/api/courses?isActive=false').set('Authorization', stu.auth)).body.map((c: any) => c.name)).toEqual(['A']);
    expect((await request(app).get('/api/courses?sortBy=name').set('Authorization', stu.auth)).body.map((c: any) => c.name)).toEqual(['A', 'B']);
    expect((await request(app).get('/api/courses?sortBy=price').set('Authorization', stu.auth)).body.map((c: any) => c.price)).toEqual([200, 300]);
  });

  it('admin CRUD with the documented status codes and messages', async () => {
    const admin = await makeStaff('admin');
    const created = await request(app).post('/api/courses').set('Authorization', admin.auth).send(course());
    expect(created.status).toBe(201);
    const id = created.body._id;

    expect((await request(app).get(`/api/courses/${id}`).set('Authorization', admin.auth)).body.name).toBe('C');
    expect((await request(app).patch(`/api/courses/${id}`).set('Authorization', admin.auth).send({ price: 5 })).body.price).toBe(5);
    expect((await request(app).get(`/api/courses/${ID}`).set('Authorization', admin.auth)).body).toEqual({ error: 'Course not found' });
    expect((await request(app).delete(`/api/courses/${id}`).set('Authorization', admin.auth)).body).toEqual({ message: 'Course deleted successfully' });
    expect(await Course.countDocuments()).toBe(0);
  });

  it('create failure is 400 with a safe reason; the response never carries raw error text', async () => {
    const admin = await makeStaff('admin');
    const res = await request(app).post('/api/courses').set('Authorization', admin.auth).send({ name: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Failed to create course');
    expect(typeof res.body.details).toBe('string');
  });
});

describe('exams', () => {
  const exam = (over: Record<string, unknown> = {}) => ({
    name: 'E', examType: 'Computer-Based', testType: 'IELTS', examDate: '2030-01-01', examTime: '09:00',
    venue: 'V', registrationDeadline: '2029-12-01', fee: 5, totalSlots: 10, availableSlots: 10, ...over,
  });

  it('filters by type/status and sorts', async () => {
    await Exam.create(exam({ name: 'B', fee: 9 }));
    await Exam.create(exam({ name: 'A', fee: 3, isActive: false, examType: 'Paper-Based' }));
    const { auth } = await makeStaff('bdm');

    expect((await request(app).get('/api/exams?status=open').set('Authorization', auth)).body.map((e: any) => e.name)).toEqual(['B']);
    expect((await request(app).get('/api/exams?status=closed').set('Authorization', auth)).body.map((e: any) => e.name)).toEqual(['A']);
    expect((await request(app).get('/api/exams?examType=Paper-Based').set('Authorization', auth)).body).toHaveLength(1);
    expect((await request(app).get('/api/exams?sortBy=fee').set('Authorization', auth)).body.map((e: any) => e.fee)).toEqual([3, 9]);
  });

  it('admin-only writes; 404 messages', async () => {
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');
    expect((await request(app).post('/api/exams').set('Authorization', bdm.auth).send(exam())).status).toBe(403);
    const created = await request(app).post('/api/exams').set('Authorization', admin.auth).send(exam());
    expect(created.status).toBe(201);
    expect((await request(app).patch(`/api/exams/${ID}`).set('Authorization', admin.auth).send({ fee: 1 })).body).toEqual({ error: 'Exam not found' });
    expect((await request(app).delete(`/api/exams/${created.body._id}`).set('Authorization', admin.auth)).body).toEqual({ message: 'Exam deleted successfully' });
    expect((await request(app).post('/api/exams').set('Authorization', admin.auth).send({})).body).toEqual({ error: 'Failed to create exam' });
  });
});

describe('mock tests (/api/mock-tests)', () => {
  it('packages: list only active, CRUD by id', async () => {
    const { auth } = await makeStaff('bdm');
    await MockTestPackage.create({ testType: 'PTE', features: [], pricing: [], isActive: false });
    const created = await request(app).post('/api/mock-tests/packages').set('Authorization', auth).send({ testType: 'IELTS', features: ['f'], pricing: [{ testCount: 1, fee: 5 }] });
    expect(created.status).toBe(201);
    expect((await request(app).get('/api/mock-tests/packages').set('Authorization', auth)).body).toHaveLength(1);
    expect((await request(app).get(`/api/mock-tests/packages/${ID}`).set('Authorization', auth)).body).toEqual({ error: 'Mock test package not found' });
    expect((await request(app).delete(`/api/mock-tests/packages/${created.body._id}`).set('Authorization', auth)).body).toEqual({ message: 'Mock test package deleted successfully' });
    expect((await request(app).post('/api/mock-tests/packages').set('Authorization', auth).send({})).status).toBe(400);
  });

  it('schedules: filters, sorts and CRUD', async () => {
    const { auth } = await makeStaff('bdm');
    const mk = (over: Record<string, unknown>) =>
      MockTestSchedule.create({ listNumber: 1, name: 'S', testType: 'IELTS', examDate: '2030-01-01', examTime: '10:00', totalSeats: 5, availableSeats: 5, ...over });
    await mk({ name: 'B', examDate: '2030-02-01' });
    await mk({ name: 'A', examDate: '2030-03-01', testType: 'PTE', status: 'completed' });

    expect((await request(app).get('/api/mock-tests/schedules').set('Authorization', auth)).body.map((s: any) => s.name)).toEqual(['B', 'A']);
    expect((await request(app).get('/api/mock-tests/schedules?sortBy=date-desc').set('Authorization', auth)).body.map((s: any) => s.name)).toEqual(['A', 'B']);
    expect((await request(app).get('/api/mock-tests/schedules?sortBy=name').set('Authorization', auth)).body.map((s: any) => s.name)).toEqual(['A', 'B']);
    expect((await request(app).get('/api/mock-tests/schedules?testType=PTE').set('Authorization', auth)).body).toHaveLength(1);
    expect((await request(app).get('/api/mock-tests/schedules?status=completed').set('Authorization', auth)).body).toHaveLength(1);
    expect((await request(app).get(`/api/mock-tests/schedules/${ID}`).set('Authorization', auth)).body).toEqual({ error: 'Mock test schedule not found' });
  });
});

describe('mock test packages by type (/api/mock-test-packages)', () => {
  it('seed creates the four defaults once and never overwrites', async () => {
    const { auth } = await makeStaff('bdm');
    await MockTestPackage.create({ testType: 'IELTS', features: ['custom'], pricing: [{ testCount: 1, fee: 1 }] });

    const first = await request(app).post('/api/mock-test-packages/seed').set('Authorization', auth);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ message: 'Packages seeded successfully', created: 3, existing: 1, total: 4 });
    expect(((await MockTestPackage.findOne({ testType: 'IELTS' }).lean()) as any).features).toEqual(['custom']);

    const second = await request(app).post('/api/mock-test-packages/seed').set('Authorization', auth);
    expect(second.body).toMatchObject({ created: 0, existing: 4 });
    const pte: any = await MockTestPackage.findOne({ testType: 'PTE' }).lean();
    expect(pte.pricing.map((p: any) => [p.testCount, p.fee])).toEqual([[1, 1750], [3, 3500], [5, 5000]]);
  });

  it('CRUD by test type with {message} bodies; delete is a soft delete', async () => {
    const { auth } = await makeStaff('bdm');
    const body = { testType: 'GRE', features: ['f'], pricing: [{ testCount: 1, fee: 5 }] };
    expect((await request(app).post('/api/mock-test-packages').set('Authorization', auth).send(body)).status).toBe(201);
    expect((await request(app).post('/api/mock-test-packages').set('Authorization', auth).send(body)).body).toEqual({ message: 'Package for this test type already exists' });
    expect((await request(app).put('/api/mock-test-packages/GRE').set('Authorization', auth).send({ features: ['g'], pricing: [] })).body.features).toEqual(['g']);
    expect((await request(app).get('/api/mock-test-packages/TOEFL').set('Authorization', auth)).body).toEqual({ message: 'Package not found' });
    expect((await request(app).delete('/api/mock-test-packages/GRE').set('Authorization', auth)).body).toEqual({ message: 'Package deleted successfully' });
    expect(((await MockTestPackage.findOne({ testType: 'GRE' }).lean()) as any).isActive).toBe(false);
    expect((await request(app).get('/api/mock-test-packages').set('Authorization', auth)).body).toEqual([]);
  });
});

describe('GET /api/schedules (external feed proxy; fetch is mocked)', () => {
  it('passes the feed through, relays an upstream status, and answers 503 when unreachable', async () => {
    const { auth } = await makeStaff('bdm');
    const fetchMock = jest.spyOn(global, 'fetch');

    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [1] }) } as Response);
    expect((await request(app).get('/api/schedules').set('Authorization', auth)).body).toEqual({ data: [1] });

    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) } as Response);
    const upstream = await request(app).get('/api/schedules').set('Authorization', auth);
    expect(upstream.status).toBe(502);
    expect(upstream.body).toEqual({ success: false, message: 'Failed to fetch schedules from Luminedge API' });

    // An upstream auth failure must not reach the caller as a 401 (it would look like an expired session).
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) } as Response);
    const upstreamAuth = await request(app).get('/api/schedules').set('Authorization', auth);
    expect(upstreamAuth.status).toBe(502);
    expect(upstreamAuth.body).toEqual({ success: false, message: 'Failed to fetch schedules from Luminedge API' });

    fetchMock.mockRejectedValueOnce(new Error('connect ECONNREFUSED secret.internal:443'));
    const down = await request(app).get('/api/schedules').set('Authorization', auth);
    expect(down.status).toBe(503);
    expect(down.body).toEqual({ success: false, message: 'Luminedge API is currently unavailable' });
  });
});
