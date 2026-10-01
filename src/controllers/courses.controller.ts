import { Request, Response } from 'express';
import Course from '../models/Course';

export const getCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testType, isActive, sortBy } = req.query;

    const query: any = {};
    if (testType && testType !== 'all') query.testType = testType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    let sortOption: any = { startDate: -1 };
    if (sortBy === 'name') sortOption = { name: 1 };
    if (sortBy === 'price') sortOption = { price: 1 };

    const courses = await Course.find(query).sort(sortOption);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

export const getCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const course = new Course(req.body);
    await course.save();
    res.status(201).json(course);
  } catch (error: any) {
    res.status(400).json({ error: 'Failed to create course', details: error?.message });
  }
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    res.json(course);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update course' });
  }
};

export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete course' });
  }
};
