import { pickFields } from '../../shared/validators/request';

// Mass-assignment allowlist: _id, createdAt, updatedAt and __v are server-managed.
const COURSE_FIELDS = [
  'name',
  'testType',
  'description',
  'durationMonths',
  'enrolledCount',
  'capacity',
  'startDate',
  'price',
  'currency',
  'instructor',
  'schedule',
  'syllabus',
  'isActive',
] as const;

export const parseCourseBody = (body: unknown) => pickFields(body, COURSE_FIELDS);

/** Builds the list filter and sort from the query string, exactly as the course screens send it. */
export const parseCourseListQuery = (queryString: Record<string, any>) => {
  const { testType, isActive, sortBy } = queryString;

  const query: Record<string, any> = {};
  if (testType && testType !== 'all') query.testType = testType;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  let sort: Record<string, 1 | -1> = { startDate: -1 };
  if (sortBy === 'name') sort = { name: 1 };
  if (sortBy === 'price') sort = { price: 1 };

  return { query, sort };
};
