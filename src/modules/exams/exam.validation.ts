import { pickFields } from '../../shared/validators/request';

// Mass-assignment allowlist: _id, createdAt, updatedAt and __v are server-managed.
const EXAM_FIELDS = [
  'name',
  'examType',
  'testType',
  'examDate',
  'examTime',
  'venue',
  'registrationDeadline',
  'fee',
  'currency',
  'totalSlots',
  'availableSlots',
  'isActive',
] as const;

export const parseExamBody = (body: unknown) => pickFields(body, EXAM_FIELDS);

export const parseExamListQuery = (queryString: Record<string, any>) => {
  const { testType, examType, status, sortBy } = queryString;

  const query: Record<string, any> = {};
  if (testType && testType !== 'all') query.testType = testType;
  if (examType && examType !== 'all') query.examType = examType;
  if (status === 'open') query.isActive = true;
  if (status === 'closed') query.isActive = false;

  let sort: Record<string, 1 | -1> = { examDate: 1 };
  if (sortBy === 'date-desc') sort = { examDate: -1 };
  if (sortBy === 'name') sort = { name: 1 };
  if (sortBy === 'fee') sort = { fee: 1 };

  return { query, sort };
};
