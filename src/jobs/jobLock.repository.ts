import mongoose from 'mongoose';

// Run-once coordination for scheduled jobs when more than one API instance shares the database.
// One small document per job records the last slot (e.g. "2026-10-06T09") that was claimed.
// Relies only on the default unique _id index: no index is created.

const COLLECTION = 'job_locks';

interface JobLockDoc {
  _id: string;
  lastSlot: string;
  claimedAt: Date;
}

const DUPLICATE_KEY = 11000;

export const jobLockRepository = {
  /**
   * True for exactly one caller per (job, slot) across every instance. The update only matches
   * while the stored slot differs; if another instance already claimed this slot the filter
   * misses, the upsert's insert collides on _id, and this caller gets false.
   */
  async claimSlot(job: string, slot: string): Promise<boolean> {
    try {
      await mongoose.connection
        .collection<JobLockDoc>(COLLECTION)
        .updateOne({ _id: job, lastSlot: { $ne: slot } }, { $set: { lastSlot: slot, claimedAt: new Date() } }, { upsert: true });
      return true;
    } catch (err) {
      if ((err as { code?: number })?.code === DUPLICATE_KEY) return false;
      throw err;
    }
  },
};
