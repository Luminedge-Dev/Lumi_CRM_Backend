// Display constants for the dashboard charts. The order of each list is the order the UI renders.

/** Every lead source the Lead model accepts (including social channels). */
export const SOURCES = ['Education Team', 'Phone Call', 'Previous', 'Facebook', 'WhatsApp', 'Google', 'Walk-in', 'Event', 'Reference', 'Others', 'Website'];

export const SOURCE_COLORS = ['#7C3AED', '#F59E0B', '#60A5FA', '#3B82F6', '#22C55E', '#EF4444', '#15803D', '#6B7280', '#A855F7', '#94A3B8', '#EC4899'];

export const COURSE_LABELS = [
  'IELTS Reg', 'PTE Reg', 'TOEFL Reg', 'GRE Reg', 'Duolingo Reg',
  'IELTS Premium', 'IELTS Crash', 'IELTS Intense', 'IELTS 1 Module', 'IELTS 1-on-1', 'IELTS Mock Tests',
  'PTE Premium', 'PTE Crash', 'PTE Intense', 'PTE 1 Module', 'PTE 1-on-1', 'PTE Mock Tests',
  'TOEFL Premium', 'TOEFL Crash', 'TOEFL 1 Module', 'TOEFL 1-on-1', 'TOEFL Mock Tests',
  'GRE Premium', 'GRE Quant', 'GRE Verbal', 'GRE 1-on-1', 'GRE Mock Tests', 'GRE Portal',
  'Basic English', 'Spoken', 'Service Charge', 'SSC English', 'Study Abroad', 'Others',
];

export const COURSE_COLORS = [
  '#64748B', '#64748B', '#64748B', '#64748B', '#64748B',
  '#EF4444', '#F87171', '#DC2626', '#FCA5A5', '#FF6B6B', '#B91C1C',
  '#A855F7', '#C084FC', '#9333EA', '#D8B4FE', '#7E22CE', '#6B21A8',
  '#3B82F6', '#60A5FA', '#2563EB', '#93C5FD', '#1D4ED8',
  '#22C55E', '#4ADE80', '#16A34A', '#86EFAC', '#15803D', '#166534',
  '#F97316', '#FB923C', '#94A3B8', '#FDBA74', '#0D9488', '#78716C',
];

/** Lead stages shown as colour-coded status chips. */
export const STATUS_COLORS = [
  { label: 'New Inquiry', stage: 'New Inquiry', color: '#3B82F6' },
  { label: 'Contacted', stage: 'Contacted', color: '#F59E0B' },
  { label: 'Trial Class', stage: 'Trial Class', color: '#22C55E' },
  { label: 'Enrolled', stage: 'Enrolled', color: '#06B6D4' },
  { label: 'Lost', stage: 'Lost', color: '#EF4444' },
];

/** Stages that count as "in progress" (not yet enrolled or lost). */
export const IN_PROGRESS_STAGES = ['New Inquiry', 'Contacted', 'Trial Class'];
