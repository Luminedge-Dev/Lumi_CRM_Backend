import request from 'supertest';
import app from '../../app';
import Document from '../../models/Document';
import Application from '../../models/Application';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// No test writes real files: storage returns a fake blob URL.
jest.mock('../../integrations/storage/fileStorage', () => ({
  storeUploadedFile: jest.fn(async (f: { originalname: string }) => ({
    fileUrl: `https://blob.test/${f.originalname}`,
    fileName: `stored-${f.originalname}`,
  })),
}));

const ID = '507f1f77bcf86cd799439011';

describe('documents API validation and authorization', () => {
  it('rejects malformed ids and enums with 400', async () => {
    const { auth } = await makeStaff('admin');
    expect((await request(app).get('/api/documents/not-an-id').set('Authorization', auth)).status).toBe(400);
    expect((await request(app).patch('/api/documents/not-an-id/review').set('Authorization', auth).send({ status: 'Approved' })).status).toBe(400);
    expect((await request(app).patch(`/api/documents/${ID}/review`).set('Authorization', auth).send({ status: 'Hacked' })).status).toBe(400);
    expect((await request(app).patch(`/api/documents/${ID}/review`).set('Authorization', auth).send({ status: { $ne: 'x' } })).status).toBe(400);
    expect((await request(app).post('/api/documents/request').set('Authorization', auth).send({ studentId: 'x', documentType: 'CV' })).status).toBe(400);
  });

  it('request: 404 for unknown student, 201 for a real one', async () => {
    const { auth } = await makeStaff('bdm');
    const { student } = await makeStudent();
    expect((await request(app).post('/api/documents/request').set('Authorization', auth).send({ studentId: ID, documentType: 'CV' })).status).toBe(404);
    const ok = await request(app).post('/api/documents/request').set('Authorization', auth).send({ studentId: String(student._id), documentType: 'CV', requestNote: 'please' });
    expect(ok.status).toBe(201);
    expect(ok.body.document.status).toBe('Requested');
  });

  it('review updates status for a valid request', async () => {
    const { auth } = await makeStaff('admin');
    const { student } = await makeStudent();
    const doc = await Document.create({ studentId: student._id, documentType: 'CV', fileName: 'x', status: 'Uploaded' });
    const res = await request(app).patch(`/api/documents/${doc._id}/review`).set('Authorization', auth).send({ status: 'Approved', reviewNote: 'ok' });
    expect(res.status).toBe(200);
    expect(res.body.document.status).toBe('Approved');
  });

  it("a student cannot attach another student's application to an upload", async () => {
    const owner = await makeStudent();
    const attacker = await makeStudent();
    const app1 = await Application.create({ studentId: owner.student._id, serviceType: 'Language Prep' });
    const res = await request(app)
      .post('/api/student/documents/upload')
      .set('Authorization', attacker.auth)
      .field('documentType', 'CV')
      .field('applicationId', String(app1._id))
      .attach('file', Buffer.from('hello'), 'a.pdf');
    expect(res.status).toBe(404);
    expect(await Document.countDocuments()).toBe(0);
  });

  it('student upload rejects an invalid applicationId before storing anything', async () => {
    const { auth } = await makeStudent();
    const res = await request(app)
      .post('/api/student/documents/upload')
      .set('Authorization', auth)
      .field('documentType', 'CV')
      .field('applicationId', 'nope')
      .attach('file', Buffer.from('hello'), 'a.pdf');
    expect(res.status).toBe(400);
  });
});

describe('fulfilling a document request (existingDocId)', () => {
  const upload = (auth: string, fields: Record<string, string>) => {
    let req = request(app).post('/api/student/documents/upload').set('Authorization', auth);
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return req.attach('file', Buffer.from('%PDF-1.4'), { filename: 'passport.pdf', contentType: 'application/pdf' });
  };

  it('updates the open request in place instead of creating a second document', async () => {
    const { student, auth } = await makeStudent();
    const reqDoc = await Document.create({ studentId: student._id, documentType: 'Passport', fileName: 'pending', status: 'Requested', requestNote: 'please' });
    const res = await upload(auth, { documentType: 'Passport', existingDocId: String(reqDoc._id) });
    expect(res.status).toBe(201);
    expect(String(res.body.document._id)).toBe(String(reqDoc._id));
    expect(await Document.countDocuments()).toBe(1);
    const stored: any = await Document.findById(reqDoc._id).lean();
    expect(stored).toMatchObject({ status: 'Uploaded', uploadedBy: 'student', originalName: 'passport.pdf', filePath: 'https://blob.test/passport.pdf', requestNote: 'please' });
  });

  it("refuses another student's request, an already-fulfilled one, and a malformed id, without storing", async () => {
    const owner = await makeStudent();
    const other = await makeStudent();
    const open = await Document.create({ studentId: owner.student._id, documentType: 'Passport', fileName: 'pending', status: 'Requested' });
    const done = await Document.create({ studentId: other.student._id, documentType: 'CV', fileName: 'x', status: 'Approved' });
    expect((await upload(other.auth, { documentType: 'Passport', existingDocId: String(open._id) })).status).toBe(404);
    expect((await upload(other.auth, { documentType: 'CV', existingDocId: String(done._id) })).status).toBe(404);
    expect((await upload(other.auth, { documentType: 'CV', existingDocId: 'nope' })).status).toBe(400);
    expect(((await Document.findById(open._id)) as any).status).toBe('Requested');
    expect(await Document.countDocuments()).toBe(2);
  });

  it('still creates a new document when no request is referenced', async () => {
    const { auth } = await makeStudent();
    const res = await upload(auth, { documentType: 'CV' });
    expect(res.status).toBe(201);
    expect(res.body.document.status).toBe('Uploaded');
  });
});
