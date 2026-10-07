export interface FollowUpInput {
  date?: unknown;
  note?: unknown;
  nextFollowUpDate?: unknown;
}

/** Fields a client may send when creating or editing a lead (nothing else is ever persisted). */
export interface LeadWriteInput {
  fullName?: any;
  email?: any;
  phone?: any;
  whom?: any;
  source?: any;
  serviceInterest?: any;
  assignedTo?: any;
  notes?: any;
  followUps?: any;
  lifecycleStage?: any;
}

export interface LeadActor {
  userId?: string;
  role?: string;
}

export type FollowUpDueStatus = 'overdue' | 'today' | 'upcoming';

export interface ImportSummary {
  imported: number;
  failed: number;
  errors: string[];
}
