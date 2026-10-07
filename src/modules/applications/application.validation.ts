import { parsePagination, pickFields } from '../../shared/validators/request';

// Request parsing for the application endpoints. Only these fields can be set by a student;
// status, assignedBDM and stageHistory are controlled by the server and staff routes.

const SUBMIT_FIELDS = [
  'serviceType',
  'serviceDetail',
  'targetCountry',
  'targetUniversity',
  'targetCourse',
  'preferredIntake',
] as const;

export const parseSubmitApplication = (body: unknown) => pickFields(body, SUBMIT_FIELDS);

/** Admin list filters and paging, exactly as the admin screen sends them. */
export const parseApplicationListQuery = (query: Record<string, any>) => {
  const { status, serviceType } = query;
  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  if (serviceType) filter.serviceType = serviceType;
  // parsePagination clamps NaN/negative/huge values, so an invalid page/limit falls back to page 1
  // instead of crashing the query with Mongoose .skip(NaN)/.limit(NaN).
  const { page, limit } = parsePagination(query, { defaultLimit: 20 });
  return { filter, page, limit };
};

export const parseAssign = (body: any): { assignedBDM: any } => ({ assignedBDM: body.assignedBDM });

export const parseStatusUpdate = (body: any): { status: any; note: any } => {
  const { status, note } = body;
  return { status, note };
};
