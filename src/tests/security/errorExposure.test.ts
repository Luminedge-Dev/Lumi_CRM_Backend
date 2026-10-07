import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import Appointment from '../../models/Appointment';
import Course from '../../models/Course';
import { publicErrorMessage } from '../../shared/utils/httpError';
import { makeStaff } from '../helpers/testAuth';

// Internal error text (driver errors, connection strings, env names) must never reach clients.

const SECRET_TEXT = 'mongodb+srv://user:p4ss@cluster.example.net/db failed: E11000 duplicate key';
let adminAuth: string;
const admin = () => adminAuth;

beforeEach(async () => {
  adminAuth = (await makeStaff('admin')).auth;
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('500 responses are stable and do not leak internals', () => {
  it('appointments list', async () => {
    jest.spyOn(Appointment, 'find').mockImplementation(() => {
      throw new Error(SECRET_TEXT);
    });
    const res = await request(app).get('/api/appointments').set('Authorization', admin());
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('mongodb');
  });

  it('logs the real error server-side', async () => {
    jest.spyOn(Appointment, 'find').mockImplementation(() => {
      throw new Error(SECRET_TEXT);
    });
    await request(app).get('/api/appointments').set('Authorization', admin());
    expect(console.error).toHaveBeenCalled();
  });

  it('course create hides driver details but keeps the {error} key', async () => {
    jest.spyOn(Course.prototype, 'save').mockRejectedValue(new Error(SECRET_TEXT));
    const res = await request(app).post('/api/courses').set('Authorization', admin()).send({ title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Failed to create course');
    expect(JSON.stringify(res.body)).not.toContain('mongodb');
  });
});

describe('global error handler', () => {
  it('hides 5xx messages and keeps 4xx messages (malformed JSON -> 400)', async () => {
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    expect(bad.body.success).toBe(false);
    expect(bad.body.stack).toBeUndefined();
  });
});

describe('publicErrorMessage', () => {
  it('passes Mongoose validation messages, hides everything else', () => {
    const v = new mongoose.Error.ValidationError();
    v.message = 'Path `title` is required.';
    expect(publicErrorMessage(v)).toBe('Path `title` is required.');
    expect(publicErrorMessage(new Error(SECRET_TEXT))).toBe('Internal server error');
    expect(publicErrorMessage(new Error(SECRET_TEXT), 'Failed to x')).toBe('Failed to x');
    expect(publicErrorMessage('string error')).toBe('Internal server error');
  });
});
