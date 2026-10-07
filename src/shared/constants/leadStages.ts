// Lifecycle stages of a lead, in pipeline order. Stored as strings on Lead.lifecycleStage.
export const LEAD_STAGES = ['New Inquiry', 'Contacted', 'Trial Class', 'Enrolled', 'Lost'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const isLeadStage = (value: unknown): value is LeadStage => LEAD_STAGES.includes(value as LeadStage);
