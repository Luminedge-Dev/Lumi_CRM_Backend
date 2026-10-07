import { AppError } from '../../core/errors';
import { pickFields } from '../../shared/validators/request';

// Fields a student may set when requesting an appointment (the rest is staff/system controlled).
const REQUEST_FIELDS = ['type', 'scheduledAt', 'durationMinutes', 'notes'] as const;

// Only these fields may be changed by staff; studentId and system fields are not writable.
const UPDATABLE_APPOINTMENT_FIELDS = [
  'status',
  'scheduledAt',
  'staffId',
  'staffType',
  'notes',
  'meetingLink',
  'durationMinutes',
  'type',
] as const;

export const parseAppointmentRequest = (body: unknown) => pickFields(body, REQUEST_FIELDS);

const MAX_MEETING_LINK_LENGTH = 2000;

/** The student portal renders meetingLink as a clickable link, so only http(s) URLs are stored (no javascript: etc.). */
const isSafeMeetingLink = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.length > MAX_MEETING_LINK_LENGTH) return false;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

export const parseAppointmentUpdate = (body: unknown) => {
  const updates = pickFields(body, UPDATABLE_APPOINTMENT_FIELDS);
  // Empty clears the link; anything else must be a web URL.
  if (updates.meetingLink !== undefined && updates.meetingLink !== null && updates.meetingLink !== '') {
    if (!isSafeMeetingLink(updates.meetingLink)) throw AppError.badRequest('Invalid meetingLink: must be an http(s) URL');
    updates.meetingLink = (updates.meetingLink as string).trim();
  }
  return updates;
};

export const parseStatusFilter = (query: Record<string, any>): Record<string, any> => {
  const filter: Record<string, any> = {};
  if (query.status) filter.status = query.status;
  return filter;
};
