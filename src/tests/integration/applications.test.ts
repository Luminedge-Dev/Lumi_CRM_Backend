import request from 'supertest';
import app from '../../app';
import Application from '../../models/Application';
import Milestone from '../../models/Milestone';
import Conversation from '../../models/Conversation';
import Student from '../../models/Student';
import Appointment from '../../models/Appointment';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// Applications, milestones and appointments: the student/staff workflow and its response shapes.

const submitBody = { serviceType: 'Study Abroad', targetCountry: 'Canada', targetCourse: 'MSc' };

describe('student applications', () => {
  it('POST creates a Submitted application with its first history entry; protected fields are ignored', async () => {
    const { student, auth } = await makeStudent();
    const res = await request(app)
      .post('/api/student/applications')
      .set('Authorization', auth)
      .send({ ...submitBody, status: 'Visa Granted', assignedBDM: '507f1f77bcf86cd799439011', studentId: '507f1f77bcf86cd799439022' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const a = res.body.application;
    expect(a).toMatchObject({ serviceType: 'Study Abroad', status: 'Submitted', studentId: String(student._id) });
    expect(a.assignedBDM).toBeUndefined();
    expect(a.stageHistory).toHaveLength(1);
    expect(a.stageHistory[0]).toMatchObject({ status: 'Submitted', changedBy: String(student._id) });
  });

  it('POST with a missing required field is a 500 {success:false,message} carrying the validation text', async () => {
    const { auth } = await makeStudent();
    const res = await request(app).post('/api/student/applications').set('Authorization', auth).send({});
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/serviceType/);
  });

  it('GET returns only the caller\'s applications', async () => {
    const mine = await makeStudent();
    const other = await makeStudent();
    await Application.create({ studentId: mine.student._id, serviceType: 'Visa' });
    await Application.create({ studentId: other.student._id, serviceType: 'Visa' });
    const res = await request(app).get('/api/student/applications').set('Authorization', mine.auth);
    expect(res.body.applications).toHaveLength(1);
  });
});

describe('staff applications', () => {
  it('GET /applications is admin-only, filterable and paged', async () => {
    const { student } = await makeStudent();
    await Application.create({ studentId: student._id, serviceType: 'Visa', status: 'Submitted' });
    await Application.create({ studentId: student._id, serviceType: 'Career', status: 'Under Review' });
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');

    expect((await request(app).get('/api/applications').set('Authorization', bdm.auth)).status).toBe(403);

    const all = await request(app).get('/api/applications').set('Authorization', admin.auth);
    expect(all.body).toMatchObject({ success: true, total: 2, page: 1 });
    const filtered = await request(app).get('/api/applications?status=Under%20Review').set('Authorization', admin.auth);
    expect(filtered.body.total).toBe(1);
    const paged = await request(app).get('/api/applications?limit=1&page=2').set('Authorization', admin.auth);
    expect(paged.body.applications).toHaveLength(1);
    expect(paged.body.page).toBe(2);
  });

  it('GET /applications/my returns only applications assigned to the caller', async () => {
    const { student } = await makeStudent();
    const me = await makeStaff('bdm');
    const other = await makeStaff('bdm');
    await Application.create({ studentId: student._id, serviceType: 'Visa', assignedBDM: me.user._id });
    await Application.create({ studentId: student._id, serviceType: 'Visa', assignedBDM: other.user._id });
    const res = await request(app).get('/api/applications/my').set('Authorization', me.auth);
    expect(res.body.applications).toHaveLength(1);
  });

  it('GET /applications/:id returns the populated application or 404 {success:false,message:"Not found"}', async () => {
    const { student } = await makeStudent();
    const a = await Application.create({ studentId: student._id, serviceType: 'Visa' });
    const { auth } = await makeStaff('bdm');
    const ok = await request(app).get(`/api/applications/${a._id}`).set('Authorization', auth);
    expect(ok.body.application.studentId).toMatchObject({ email: student.email });
    const missing = await request(app).get('/api/applications/507f1f77bcf86cd799439011').set('Authorization', auth);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, message: 'Not found' });
  });

  it('PATCH /:id/status records the change in the history', async () => {
    const { student } = await makeStudent();
    const a = await Application.create({ studentId: student._id, serviceType: 'Visa', stageHistory: [] });
    const { user, auth } = await makeStaff('bdm');
    const res = await request(app).patch(`/api/applications/${a._id}/status`).set('Authorization', auth).send({ status: 'Under Review', note: 'checking' });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('Under Review');
    expect(res.body.application.stageHistory[0]).toMatchObject({ status: 'Under Review', note: 'checking', changedBy: String(user._id) });
    const missing = await request(app).patch('/api/applications/507f1f77bcf86cd799439011/status').set('Authorization', auth).send({ status: 'Accepted' });
    expect(missing.body).toEqual({ success: false, message: 'Application not found' });
  });
});

describe('PATCH /api/applications/:id/assign', () => {
  it('assigns the BDM, creates the milestone checklist once, and opens one student-BDM conversation', async () => {
    const { student } = await makeStudent({ name: 'Stu Dent' });
    const a = await Application.create({ studentId: student._id, serviceType: 'Study Abroad' });
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');

    const first = await request(app).patch(`/api/applications/${a._id}/assign`).set('Authorization', admin.auth).send({ assignedBDM: String(bdm.user._id) });
    expect(first.status).toBe(200);
    expect(first.body.application.assignedBDM).toBe(String(bdm.user._id));

    expect((await Student.findById(student._id))!.assignedBDM).toEqual(bdm.user._id);

    const milestones = await Milestone.find({ applicationId: a._id }).sort({ order: 1 });
    expect(milestones.length).toBeGreaterThan(3);
    expect(milestones[0]).toMatchObject({ title: 'BDM Assigned', status: 'In Progress', order: 1 });
    expect(milestones.slice(1).every((m) => m.status === 'Pending')).toBe(true);

    const conversations = await Conversation.find({ applicationId: a._id });
    expect(conversations).toHaveLength(1);
    expect(conversations[0].participants.map((p) => p.participantId).sort()).toEqual([String(student._id), String(bdm.user._id)].sort());

    // assigning again must not duplicate milestones or the conversation
    await request(app).patch(`/api/applications/${a._id}/assign`).set('Authorization', admin.auth).send({ assignedBDM: String(bdm.user._id) });
    expect(await Milestone.countDocuments({ applicationId: a._id })).toBe(milestones.length);
    expect(await Conversation.countDocuments({ applicationId: a._id })).toBe(1);
  });

  it('is admin-only and 404s an unknown application', async () => {
    const bdm = await makeStaff('bdm');
    const denied = await request(app).patch('/api/applications/507f1f77bcf86cd799439011/assign').set('Authorization', bdm.auth).send({});
    expect(denied.status).toBe(403);
    const admin = await makeStaff('admin');
    const missing = await request(app).patch('/api/applications/507f1f77bcf86cd799439011/assign').set('Authorization', admin.auth).send({});
    expect(missing.body).toEqual({ success: false, message: 'Application not found' });
  });
});

describe('milestones', () => {
  it('student reads their own; staff read any student\'s and update status/notes', async () => {
    const { student, auth } = await makeStudent();
    const application = await Application.create({ studentId: student._id, serviceType: 'Visa' });
    const m = await Milestone.create({
      studentId: student._id,
      applicationId: application._id,
      serviceType: 'Visa',
      title: 'Step',
      order: 1,
      status: 'Pending',
    });
    const mine = await request(app).get('/api/student/milestones').set('Authorization', auth);
    expect(mine.body.milestones).toHaveLength(1);

    const staff = await makeStaff('bdm');
    const list = await request(app).get(`/api/milestones/${student._id}`).set('Authorization', staff.auth);
    expect(list.body.milestones).toHaveLength(1);

    const upd = await request(app).patch(`/api/milestones/${m._id}`).set('Authorization', staff.auth).send({ status: 'Completed', notes: 'done' });
    expect(upd.body.milestone).toMatchObject({ status: 'Completed', notes: 'done', updatedBy: String(staff.user._id) });
    expect(upd.body.milestone.completedAt).toBeTruthy();

    const missing = await request(app).patch('/api/milestones/507f1f77bcf86cd799439011').set('Authorization', staff.auth).send({ status: 'Completed' });
    expect(missing.body).toEqual({ success: false, message: 'Milestone not found' });
  });
});

describe('appointments', () => {
  it('student requests and lists; protected fields cannot be set; staff can filter and update', async () => {
    const { student, auth } = await makeStudent();
    const res = await request(app)
      .post('/api/student/appointments')
      .set('Authorization', auth)
      .send({ type: 'Counseling', scheduledAt: '2030-01-01T10:00:00Z', notes: 'hi', status: 'Completed', staffId: '507f1f77bcf86cd799439011' });
    expect(res.status).toBe(201);
    expect(res.body.appointment).toMatchObject({ type: 'Counseling', status: 'Scheduled', studentId: String(student._id) });
    expect(res.body.appointment.staffId).toBeUndefined();

    expect((await request(app).get('/api/student/appointments').set('Authorization', auth)).body.appointments).toHaveLength(1);

    const staff = await makeStaff('bdm');
    expect((await request(app).get('/api/appointments?status=Completed').set('Authorization', staff.auth)).body.appointments).toHaveLength(0);
    const upd = await request(app).patch(`/api/appointments/${res.body.appointment._id}`).set('Authorization', staff.auth).send({ status: 'Completed', studentId: '507f1f77bcf86cd799439011' });
    expect(upd.body.appointment.status).toBe('Completed');
    expect(String((await Appointment.findById(res.body.appointment._id))!.studentId)).toBe(String(student._id));
  });

  it('a missing required field on request is a 500 with the validation text; a bad update is a 400', async () => {
    const { auth } = await makeStudent();
    const bad = await request(app).post('/api/student/appointments').set('Authorization', auth).send({});
    expect(bad.status).toBe(500);
    expect(bad.body.success).toBe(false);

    const staff = await makeStaff('admin');
    const invalid = await request(app).patch('/api/appointments/not-an-id').set('Authorization', staff.auth).send({ status: 'Completed' });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toEqual({ success: false, message: 'Invalid appointment data' });
  });
});
