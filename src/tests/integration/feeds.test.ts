import request from 'supertest';
import app from '../../app';
import Notification from '../../models/Notification';
import NewsUpdate from '../../models/NewsUpdate';
import Lead from '../../models/Lead';
import Task from '../../models/Task';
import User from '../../models/User';
import { makeStaff } from '../helpers/testAuth';

// Notifications, news, activities and reports: response shapes and scoping.

describe('notifications', () => {
  it('lists the caller\'s notifications with an unread count; unreadOnly filters', async () => {
    const me = await makeStaff('bdm');
    const other = await makeStaff('bdm');
    await Notification.create({ recipient: me.user._id, title: 'a', message: 'm', isRead: true });
    await Notification.create({ recipient: me.user._id, title: 'b', message: 'm' });
    await Notification.create({ recipient: other.user._id, title: 'c', message: 'm' });

    const all = await request(app).get('/api/notifications').set('Authorization', me.auth);
    expect(all.body.success).toBe(true);
    expect(all.body.data).toHaveLength(2);
    expect(all.body.meta).toEqual({ unreadCount: 1 });
    const unread = await request(app).get('/api/notifications?unreadOnly=true').set('Authorization', me.auth);
    expect(unread.body.data.map((n: any) => n.title)).toEqual(['b']);
  });

  it('marks one notification read (only the owner\'s) and all as read without touching others', async () => {
    const me = await makeStaff('bdm');
    const other = await makeStaff('bdm');
    const mine = await Notification.create({ recipient: me.user._id, title: 'a', message: 'm' });
    const theirs = await Notification.create({ recipient: other.user._id, title: 'b', message: 'm' });

    expect((await request(app).put(`/api/notifications/${theirs._id}/read`).set('Authorization', me.auth)).body).toEqual({ success: false, message: 'Notification not found' });
    const ok = await request(app).put(`/api/notifications/${mine._id}/read`).set('Authorization', me.auth);
    expect(ok.body.data.isRead).toBe(true);

    await Notification.create({ recipient: me.user._id, title: 'c', message: 'm' });
    const all = await request(app).put('/api/notifications/read-all').set('Authorization', me.auth);
    expect(all.body).toEqual({ success: true, message: 'All notifications marked as read' });
    expect(await Notification.countDocuments({ recipient: me.user._id, isRead: false })).toBe(0);
    expect(((await Notification.findById(theirs._id).lean()) as any).isRead).toBe(false);
  });

  it('creating a lead notifies the admins (end-to-end fan-out)', async () => {
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');
    await request(app).post('/api/leads').set('Authorization', bdm.auth).send({ fullName: 'Fan Out', phone: '+8801733333333', source: 'Facebook' });
    const notes = await Notification.find({ recipient: admin.user._id });
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('New Lead Added');
    expect(await Notification.countDocuments({ recipient: bdm.user._id })).toBe(0);
  });
});

describe('news', () => {
  it('public feed shows active posts, pinned first, filterable by category', async () => {
    const admin = await makeStaff('admin');
    await NewsUpdate.create({ title: 'old', content: 'c', createdBy: admin.user._id });
    await NewsUpdate.create({ title: 'pinned', content: 'c', isPinned: true, category: 'Visa', createdBy: admin.user._id });
    await NewsUpdate.create({ title: 'archived', content: 'c', isActive: false, createdBy: admin.user._id });

    const feed = await request(app).get('/api/news');
    expect(feed.body.success).toBe(true);
    expect(feed.body.news.map((n: any) => n.title)).toEqual(['pinned', 'old']);
    expect(feed.body.news[0].createdBy).toMatchObject({ name: admin.user.name });
    expect((await request(app).get('/api/news?category=Visa')).body.news).toHaveLength(1);
  });

  it('admin creates, edits and archives; a BDM cannot', async () => {
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');
    expect((await request(app).post('/api/admin/news').set('Authorization', bdm.auth).send({})).status).toBe(403);

    const created = await request(app).post('/api/admin/news').set('Authorization', admin.auth).send({ title: 'T', content: 'C', category: 'Event', createdBy: String(bdm.user._id) });
    expect(created.status).toBe(201);
    expect(created.body.news.createdBy).toBe(String(admin.user._id));

    const id = created.body.news._id;
    expect((await request(app).patch(`/api/admin/news/${id}`).set('Authorization', admin.auth).send({ title: 'T2' })).body.news.title).toBe('T2');
    expect((await request(app).patch('/api/admin/news/507f1f77bcf86cd799439011').set('Authorization', admin.auth).send({})).body).toEqual({ success: false, message: 'Post not found' });
    expect((await request(app).delete(`/api/admin/news/${id}`).set('Authorization', admin.auth)).body).toEqual({ success: true, message: 'Post archived' });
    expect(((await NewsUpdate.findById(id).lean()) as any).isActive).toBe(false);
  });

  it('a missing title is a 500 with the validation text', async () => {
    const admin = await makeStaff('admin');
    const res = await request(app).post('/api/admin/news').set('Authorization', admin.auth).send({});
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/title/);
  });
});

describe('activities', () => {
  it('builds the feed from leads: created, converted and classified follow-ups, plus today\'s stats', async () => {
    const { user: bdm, auth } = await makeStaff('bdm');
    await Lead.create({
      fullName: 'Active Lead', phone: '+8801744444444', email: 'al@x.com', lifecycleStage: 'Enrolled', assignedTo: bdm._id,
      followUps: [
        { date: new Date(), note: 'Phone call about fees', createdAt: new Date() },
        { date: new Date(), note: 'Sent an email', createdAt: new Date() },
        { date: new Date(), note: 'Visited', createdAt: new Date() },
      ],
    });

    const res = await request(app).get('/api/activities').set('Authorization', auth);
    expect(res.status).toBe(200);
    const types = res.body.activities.map((a: any) => a.actionType).sort();
    expect(types).toEqual(['call', 'email', 'follow_up', 'lead_converted', 'lead_created']);
    expect(res.body.activities.every((a: any) => a.userName === bdm.name && a.leadName === 'Active Lead')).toBe(true);
    expect(res.body.stats).toEqual({ todayActivities: 5, callsToday: 1, emailsToday: 1, conversionsToday: 1 });

    const onlyCalls = await request(app).get('/api/activities?type=call').set('Authorization', auth);
    expect(onlyCalls.body.activities).toHaveLength(1);
  });
});

describe('reports', () => {
  it('BDM report: per-BDM counts, conversion rate and summary for the window', async () => {
    const admin = await makeStaff('admin');
    const bdm = await User.create({ name: 'Report Bdm', email: 'rb@example.com', passwordHash: 'x', role: 'bdm' });
    await Lead.create({ fullName: 'L1', phone: '+8801755555551', email: 'r1@x.com', assignedTo: bdm._id, lifecycleStage: 'Enrolled', followUps: [{ date: new Date(), note: 'call him' }] });
    await Lead.create({ fullName: 'L2', phone: '+8801755555552', email: 'r2@x.com', assignedTo: bdm._id });

    const res = await request(app).get('/api/reports/bdm?range=this_month').set('Authorization', admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.performances).toHaveLength(1);
    expect(res.body.performances[0]).toMatchObject({ name: 'Report Bdm', leadsAssigned: 2, leadsConverted: 1, conversionRate: 50, totalCalls: 1, revenue: 0 });
    expect(res.body.summary).toMatchObject({ totalBDMs: 1, totalLeadsAssigned: 2, convertedLeads: 1, overallConversionRate: 50, activeLeads: 1, avgResponseTime: 'N/A' });
    expect((await request(app).get(`/api/reports/bdm?bdm=${admin.user._id}`).set('Authorization', admin.auth)).body.performances).toEqual([]);
  });

  it('task status requires bdmId and returns that BDM\'s tasks for the day', async () => {
    const { user: bdm, auth } = await makeStaff('bdm');
    const missing = await request(app).get('/api/reports/task-status').set('Authorization', auth);
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: 'BDM ID is required' });

    const lead = await Lead.create({ fullName: 'T', phone: '+8801766666666', email: 't@x.com' });
    await Task.create({ title: 'Today', entityType: 'lead', entityId: lead._id, assignedTo: bdm._id, dueDate: new Date() });
    await Task.create({ title: 'Other day', entityType: 'lead', entityId: lead._id, assignedTo: bdm._id, dueDate: new Date('2001-01-01'), createdAt: new Date('2001-01-01') });
    const res = await request(app).get(`/api/reports/task-status?bdmId=${bdm._id}`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.map((t: any) => t.title)).toContain('Today');
  });
});
