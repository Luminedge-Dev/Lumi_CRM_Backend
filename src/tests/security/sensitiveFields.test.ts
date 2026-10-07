import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import User from '../../models/User';
import Student from '../../models/Student';
import Task from '../../models/Task';

// Credential fields must never reach an API response, however the user document is serialized.

const FORBIDDEN = ['passwordHash', 'resetPasswordToken', 'resetPasswordExpires'];
const auth = (userId: string, role: string) => `Bearer ${jwt.sign({ userId, role }, process.env.JWT_SECRET as string)}`;
const body = (res: request.Response) => JSON.stringify(res.body);
const expectClean = (res: request.Response) => {
  for (const f of FORBIDDEN) expect(body(res)).not.toContain(f);
  expect(body(res)).not.toContain('SECRET-HASH-VALUE');
  expect(body(res)).not.toContain('SECRET-RESET-VALUE');
};

let assignee: any;
let bdm: any;
let task: any;

beforeEach(async () => {
  assignee = await User.create({
    name: 'Assignee',
    email: 'assignee@example.com',
    passwordHash: 'SECRET-HASH-VALUE',
    resetPasswordToken: 'SECRET-RESET-VALUE',
    resetPasswordExpires: new Date(Date.now() + 3600_000),
    role: 'bdm',
  });
  bdm = await User.create({ name: 'Other Bdm', email: 'other@example.com', passwordHash: 'x', role: 'bdm' });
  task = await Task.create({ title: 'T', entityType: 'lead', entityId: assignee._id, assignedTo: assignee._id, completedBy: assignee._id });
});

describe('task responses never expose credential fields', () => {
  it('GET /api/tasks', async () => {
    const res = await request(app).get('/api/tasks').set('Authorization', auth(String(bdm._id), 'bdm'));
    expect(res.status).toBe(200);
    expect(res.body[0].assignedTo).toMatchObject({ name: 'Assignee', email: 'assignee@example.com' });
    expectClean(res);
  });

  it('GET /api/tasks/:id', async () => {
    const res = await request(app).get(`/api/tasks/${task._id}`).set('Authorization', auth(String(bdm._id), 'bdm'));
    expect(res.status).toBe(200);
    expectClean(res);
  });

  it('PATCH /api/tasks/:id', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${task._id}`)
      .set('Authorization', auth(String(bdm._id), 'bdm'))
      .send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Renamed');
    expectClean(res);
  });
});

describe('serialization strips credentials at the schema level', () => {
  it('User.toJSON and Student.toJSON drop credential fields but keep normal ones', async () => {
    const json = assignee.toJSON();
    for (const f of FORBIDDEN) expect(json).not.toHaveProperty(f);
    expect(json.email).toBe('assignee@example.com');

    const student = await Student.create({
      name: 'S', email: 's@example.com', passwordHash: 'SECRET-HASH-VALUE', resetPasswordToken: 'SECRET-RESET-VALUE',
    });
    const sj = student.toJSON();
    for (const f of FORBIDDEN) expect(sj).not.toHaveProperty(f);
    expect(sj.email).toBe('s@example.com');
  });

  it('the values are still readable in code, so login keeps working', async () => {
    const stored = await User.findOne({ email: 'assignee@example.com' });
    expect(stored!.passwordHash).toBe('SECRET-HASH-VALUE');
    expect(stored!.resetPasswordToken).toBe('SECRET-RESET-VALUE');
  });
});

describe('user and student endpoints never expose credential fields', () => {
  it('GET /api/auth/users, /api/auth/profile, /api/leads/bdms', async () => {
    const a = auth(String(assignee._id), 'bdm');
    const admin = await User.create({ name: 'Adm', email: 'adm@example.com', passwordHash: 'x', role: 'admin' });
    const adminAuth = auth(String(admin._id), 'admin');
    for (const [path, header] of [['/api/auth/users', adminAuth], ['/api/auth/profile', a], ['/api/leads/bdms', adminAuth]]) {
      const res = await request(app).get(path).set('Authorization', header);
      expect(res.status).toBe(200);
      expectClean(res);
    }
  });

  it('GET /api/student/students and /api/student/profile', async () => {
    const admin = await User.create({ name: 'Adm', email: 'adm2@example.com', passwordHash: 'x', role: 'admin' });
    const student = await Student.create({
      name: 'S', email: 'stu@example.com', passwordHash: 'SECRET-HASH-VALUE', resetPasswordToken: 'SECRET-RESET-VALUE',
      resetPasswordExpires: new Date(Date.now() + 3600_000),
    });
    const list = await request(app).get('/api/student/students').set('Authorization', auth(String(admin._id), 'admin'));
    expect(list.status).toBe(200);
    expectClean(list);

    const sToken = jwt.sign({ studentId: String(student._id), role: 'student' }, process.env.JWT_SECRET as string);
    const profile = await request(app).get('/api/student/profile').set('Authorization', `Bearer ${sToken}`);
    expect(profile.status).toBe(200);
    expectClean(profile);
  });

  it('there is no resetPasswordTokenHash field in either schema (nothing to leak)', () => {
    expect(User.schema.path('resetPasswordTokenHash')).toBeUndefined();
    expect(Student.schema.path('resetPasswordTokenHash')).toBeUndefined();
  });
});
