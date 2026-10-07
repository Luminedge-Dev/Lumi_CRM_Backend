export interface CreateEditRequestInput {
  leadId: string;
  section: unknown;
  payload: Record<string, any>;
  note: unknown;
}

export interface EditRequestActor {
  userId?: string;
  role?: string;
}

export type ReviewDecision = 'approved' | 'rejected';
