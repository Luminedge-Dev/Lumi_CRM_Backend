import request from 'supertest';
import app from '../../app';
import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import { registerChatHandlers, ChatSocket, ChatServer } from '../../integrations/socket/chat.socket';
import { makeStaff, makeStudent } from '../helpers/testAuth';

// Chat: REST endpoints and Socket.IO handlers share one membership/validation rule set.

const OTHER_ID = '507f1f77bcf86cd799439011';

const makeConversation = async (studentId: string, staffId: string) =>
  Conversation.create({
    participants: [
      { participantId: studentId, participantType: 'student', name: 'Stu', role: 'Student' },
      { participantId: staffId, participantType: 'staff', name: 'Staff Person', role: 'bdm' },
    ],
    title: 'Chat',
  });

describe('REST: conversations', () => {
  it('lists only conversations the caller participates in (student and staff views)', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const other = await makeStaff('bdm');
    await makeConversation(String(stu.student._id), String(bdm.user._id));
    await makeConversation(OTHER_ID, String(other.user._id));

    const student = await request(app).get('/api/conversations/student').set('Authorization', stu.auth);
    expect(student.body.success).toBe(true);
    expect(student.body.conversations).toHaveLength(1);
    const staff = await request(app).get('/api/conversations/staff').set('Authorization', bdm.auth);
    expect(staff.body.conversations).toHaveLength(1);
  });

  it('admin creates conversations (400 on bad data) and lists everything', async () => {
    const admin = await makeStaff('admin');
    const bdm = await makeStaff('bdm');
    expect((await request(app).post('/api/conversations').set('Authorization', bdm.auth).send({})).status).toBe(403);

    const bad = await request(app).post('/api/conversations').set('Authorization', admin.auth).send({ participants: 'nope' });
    expect(bad.status).toBe(400);
    expect(bad.body).toEqual({ success: false, message: 'Invalid conversation data' });

    const ok = await request(app)
      .post('/api/conversations')
      .set('Authorization', admin.auth)
      .send({ participants: [{ participantId: 'a', participantType: 'staff', name: 'A' }], title: 'T' });
    expect(ok.status).toBe(201);
    expect(ok.body.conversation.title).toBe('T');

    const all = await request(app).get('/api/admin/conversations').set('Authorization', admin.auth);
    expect(all.body.conversations).toHaveLength(1);
  });
});

describe('REST: messages', () => {
  it('a participant sends and reads; the sender name comes from the conversation, not the client', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));

    const sent = await request(app)
      .post(`/api/conversations/${conv._id}/messages/student`)
      .set('Authorization', stu.auth)
      .send({ content: 'hello', senderName: 'Spoofed', senderId: OTHER_ID, senderType: 'staff' });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ content: 'hello', senderName: 'Stu', senderId: String(stu.student._id), senderType: 'student' });

    const updated: any = await Conversation.findById(conv._id).lean();
    expect(updated.lastMessage).toBe('hello');

    const read = await request(app).get(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', bdm.auth);
    expect(read.body.messages).toHaveLength(1);
  });

  it('rejects non-participants, bad ids, empty and over-long content', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const outsider = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));

    const denied = await request(app).post(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', outsider.auth).send({ content: 'x' });
    expect(denied.status).toBe(403);
    expect(denied.body).toEqual({ success: false, message: 'You are not a participant of this conversation' });
    expect((await request(app).get(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', outsider.auth)).status).toBe(403);

    expect((await request(app).post('/api/conversations/nope/messages/staff').set('Authorization', bdm.auth).send({ content: 'x' })).body.message).toBe('Invalid conversation id');
    expect((await request(app).post(`/api/conversations/${OTHER_ID}/messages/staff`).set('Authorization', bdm.auth).send({ content: 'x' })).status).toBe(404);
    expect((await request(app).post(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', bdm.auth).send({ content: '   ' })).body.message).toBe('Message content is required');
    expect((await request(app).post(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', bdm.auth).send({ content: 'a'.repeat(5001) })).status).toBe(400);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('an admin may read (not send to) a conversation they are not part of', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const admin = await makeStaff('admin');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));
    expect((await request(app).get(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', admin.auth)).status).toBe(200);
    expect((await request(app).post(`/api/conversations/${conv._id}/messages/staff`).set('Authorization', admin.auth).send({ content: 'x' })).status).toBe(403);
  });

  it('message pages are capped at 100', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));
    await Message.insertMany(
      Array.from({ length: 120 }, (_, i) => ({ conversationId: conv._id, senderType: 'staff', senderId: String(bdm.user._id), senderName: 'S', content: `m${i}` })),
    );
    const res = await request(app).get(`/api/conversations/${conv._id}/messages/staff?limit=1000`).set('Authorization', bdm.auth);
    expect(res.body.messages).toHaveLength(100);
  });
});

describe('Socket.IO handlers (fake socket, no network)', () => {
  type Handler = (...args: any[]) => Promise<void> | void;

  const fakeSocket = () => {
    const handlers = new Map<string, Handler>();
    const emitted: Array<[string, any]> = [];
    const joined: string[] = [];
    const roomEmits: Array<[string, string, any]> = [];
    const socket: ChatSocket = {
      on: (event, listener) => void handlers.set(event, listener),
      join: (room) => void joined.push(room),
      leave: () => undefined,
      emit: (event, payload) => void emitted.push([event, payload]),
      to: (room) => ({ emit: (event, payload) => void roomEmits.push([room, event, payload]) }),
    };
    const serverEmits: Array<[string, string, any]> = [];
    const io: ChatServer = { to: (room) => ({ emit: (event, payload) => void serverEmits.push([room, event, payload]) }) };
    return { handlers, emitted, joined, roomEmits, serverEmits, socket, io };
  };

  it('join-conversation: members join their room, others get a chat-error', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));

    const member = fakeSocket();
    registerChatHandlers(member.socket, member.io, { id: String(bdm.user._id), isStudent: false, role: 'bdm' });
    await member.handlers.get('join-conversation')!(String(conv._id));
    expect(member.joined).toEqual([`conv-${conv._id}`]);

    const outsider = fakeSocket();
    registerChatHandlers(outsider.socket, outsider.io, { id: OTHER_ID, isStudent: false, role: 'bdm' });
    await outsider.handlers.get('join-conversation')!(String(conv._id));
    expect(outsider.joined).toEqual([]);
    expect(outsider.emitted[0]).toEqual(['chat-error', { event: 'join-conversation', message: 'You are not a participant of this conversation' }]);
  });

  it('send-message: stores with the authenticated identity, ignores client senderName, and broadcasts to the room', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));

    const s = fakeSocket();
    registerChatHandlers(s.socket, s.io, { id: String(stu.student._id), isStudent: true, role: 'student' });
    await s.handlers.get('send-message')!({ conversationId: String(conv._id), content: 'hi there', senderName: 'Spoof', senderId: OTHER_ID });

    const stored: any = await Message.findOne().lean();
    expect(stored).toMatchObject({ content: 'hi there', senderName: 'Stu', senderId: String(stu.student._id), senderType: 'student' });
    expect(s.serverEmits).toHaveLength(1);
    expect(s.serverEmits[0][0]).toBe(`conv-${conv._id}`);
    expect(s.serverEmits[0][1]).toBe('new-message');
    expect(((await Conversation.findById(conv._id).lean()) as any).lastMessage).toBe('hi there');
  });

  it('send-message: invalid payloads and non-members produce chat-error and store nothing', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));

    const s = fakeSocket();
    registerChatHandlers(s.socket, s.io, { id: OTHER_ID, isStudent: false, role: 'bdm' });
    await s.handlers.get('send-message')!({ conversationId: String(conv._id), content: 'x' });
    await s.handlers.get('send-message')!('not an object');
    await s.handlers.get('send-message')!({ conversationId: String(conv._id), content: 42 });
    expect(s.emitted.map(([e]) => e)).toEqual(['chat-error', 'chat-error', 'chat-error']);
    expect(await Message.countDocuments()).toBe(0);
    expect(s.serverEmits).toHaveLength(0);
  });

  it('message-read: only members can mark read; it announces to the room', async () => {
    const stu = await makeStudent();
    const bdm = await makeStaff('bdm');
    const conv = await makeConversation(String(stu.student._id), String(bdm.user._id));
    await Message.create({ conversationId: conv._id, senderType: 'student', senderId: String(stu.student._id), senderName: 'Stu', content: 'yo' });

    const s = fakeSocket();
    registerChatHandlers(s.socket, s.io, { id: String(bdm.user._id), isStudent: false, role: 'bdm' });
    await s.handlers.get('message-read')!(String(conv._id));
    expect(((await Message.findOne().lean()) as any).readBy).toEqual([String(bdm.user._id)]);
    expect(s.roomEmits[0]).toEqual([`conv-${conv._id}`, 'messages-read', { conversationId: String(conv._id), userId: String(bdm.user._id) }]);

    const outsider = fakeSocket();
    registerChatHandlers(outsider.socket, outsider.io, { id: OTHER_ID, isStudent: false, role: 'bdm' });
    await outsider.handlers.get('message-read')!(String(conv._id));
    expect(outsider.emitted[0][0]).toBe('chat-error');
    expect(((await Message.findOne().lean()) as any).readBy).toEqual([String(bdm.user._id)]);
  });
});
