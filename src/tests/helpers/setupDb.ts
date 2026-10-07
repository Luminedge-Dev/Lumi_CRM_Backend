import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// SAFETY LOCK: no test may send real email. Plain functions (not jest.fn) so restoreAllMocks cannot
// strip them; a test that wants to assert on sends mocks nodemailer itself, which overrides this.
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: async () => ({ messageId: 'test' }) }),
}));

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // SAFETY LOCK: refuse to run any test (they all write) unless connected to the local
  // in-memory server. Never print the URI.
  const { host } = mongoose.connection;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    await mongoose.disconnect();
    throw new Error('Tests must only run against the in-memory MongoDB server');
  }
});

// SAFETY LOCK: no test may reach the network (Google, the schedules proxy, the socket bridge...).
// A test that needs fetch must mock it itself, which overrides this default.
beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation(() => {
    throw new Error('Unmocked network call in test: mock global.fetch explicitly');
  });
});

afterEach(async () => {
  jest.restoreAllMocks();
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
