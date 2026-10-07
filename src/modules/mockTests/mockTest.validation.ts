import { pickFields } from '../../shared/validators/request';

// Mass-assignment allowlists: only the schema's client-editable fields. _id, createdAt, updatedAt
// and __v are server-managed and must never come from the request body.
const MOCK_TEST_PACKAGE_FIELDS = ['testType', 'features', 'pricing', 'isActive'] as const;
const MOCK_TEST_SCHEDULE_FIELDS = [
  'listNumber',
  'name',
  'testType',
  'examDate',
  'examTime',
  'totalSeats',
  'availableSeats',
  'status',
] as const;

export const parsePackageBody = (body: unknown) => pickFields(body, MOCK_TEST_PACKAGE_FIELDS);
export const parseScheduleBody = (body: unknown) => pickFields(body, MOCK_TEST_SCHEDULE_FIELDS);

export const parseScheduleListQuery = (queryString: Record<string, any>) => {
  const { testType, status, sortBy } = queryString;

  const query: Record<string, any> = {};
  if (testType && testType !== 'all') query.testType = testType;
  if (status && status !== 'all') query.status = status;

  let sort: Record<string, 1 | -1> = { examDate: 1 };
  if (sortBy === 'date-desc') sort = { examDate: -1 };
  if (sortBy === 'name') sort = { name: 1 };

  return { query, sort };
};
