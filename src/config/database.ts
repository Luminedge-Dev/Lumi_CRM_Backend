import mongoose from 'mongoose';
import { config } from './env';

/** Host part of a connection string, for logs: never the credentials, database name or options. */
const describeTarget = (uri: string): string =>
  /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/i.exec(uri)?.[1] ?? 'configured database';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = config.database.uri;

    console.log(`Connecting to MongoDB host: ${describeTarget(mongoURI)}`);

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      family: 4, // Force IPv4
    });

    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

/** True when Mongoose holds an open connection. */
export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

export const disconnectDB = async (): Promise<void> => {
  await mongoose.connection.close();
};

export default connectDB;
