import { asyncHandler } from '../../core/http';
import { examService } from './exam.service';
import { parseExamBody, parseExamListQuery } from './exam.validation';

// `{ error }` on failure; writes answer an unexpected failure with 400, reads and deletes with 500.

export const getExams = asyncHandler(
  async (req, res) => {
    const { query, sort } = parseExamListQuery(req.query);
    res.json(await examService.list(query, sort));
  },
  { fallbackMessage: 'Failed to fetch exams', logLabel: 'Error fetching exams:' },
);

export const getExam = asyncHandler(
  async (req, res) => {
    res.json(await examService.get(req.params.id));
  },
  { fallbackMessage: 'Failed to fetch exam', logLabel: 'Error fetching exam:' },
);

export const createExam = asyncHandler(
  async (req, res) => {
    res.status(201).json(await examService.create(parseExamBody(req.body)));
  },
  { fallbackMessage: 'Failed to create exam', fallbackStatus: 400, logLabel: 'Error creating exam:' },
);

export const updateExam = asyncHandler(
  async (req, res) => {
    res.json(await examService.update(req.params.id, parseExamBody(req.body)));
  },
  { fallbackMessage: 'Failed to update exam', fallbackStatus: 400, logLabel: 'Error updating exam:' },
);

export const deleteExam = asyncHandler(
  async (req, res) => {
    await examService.delete(req.params.id);
    res.json({ message: 'Exam deleted successfully' });
  },
  { fallbackMessage: 'Failed to delete exam', logLabel: 'Error deleting exam:' },
);
