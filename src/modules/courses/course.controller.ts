import { asyncHandler } from '../../core/http';
import { courseService } from './course.service';
import { parseCourseBody, parseCourseListQuery } from './course.validation';

// `{ error }` on failure; writes answer an unexpected failure with 400, reads and deletes with 500.

export const getCourses = asyncHandler(
  async (req, res) => {
    const { query, sort } = parseCourseListQuery(req.query);
    res.json(await courseService.list(query, sort));
  },
  { fallbackMessage: 'Failed to fetch courses', logLabel: 'Error fetching courses:' },
);

export const getCourse = asyncHandler(
  async (req, res) => {
    res.json(await courseService.get(req.params.id));
  },
  { fallbackMessage: 'Failed to fetch course', logLabel: 'Error fetching course:' },
);

export const createCourse = asyncHandler(
  async (req, res) => {
    res.status(201).json(await courseService.create(parseCourseBody(req.body)));
  },
  { fallbackMessage: 'Failed to create course', fallbackStatus: 400, logLabel: 'Error creating course:' },
);

export const updateCourse = asyncHandler(
  async (req, res) => {
    res.json(await courseService.update(req.params.id, parseCourseBody(req.body)));
  },
  { fallbackMessage: 'Failed to update course', fallbackStatus: 400, logLabel: 'Error updating course:' },
);

export const deleteCourse = asyncHandler(
  async (req, res) => {
    await courseService.delete(req.params.id);
    res.json({ message: 'Course deleted successfully' });
  },
  { fallbackMessage: 'Failed to delete course', logLabel: 'Error deleting course:' },
);
