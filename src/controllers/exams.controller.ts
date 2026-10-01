import { Request, Response } from 'express';
import Exam from '../models/Exam';

export const getExams = async (req: Request, res: Response): Promise<void> => {
  try {
    const { testType, examType, status, sortBy } = req.query;

    const query: any = {};
    if (testType && testType !== 'all') query.testType = testType;
    if (examType && examType !== 'all') query.examType = examType;
    if (status === 'open') query.isActive = true;
    if (status === 'closed') query.isActive = false;

    let sortOption: any = { examDate: 1 };
    if (sortBy === 'date-desc') sortOption = { examDate: -1 };
    if (sortBy === 'name') sortOption = { name: 1 };
    if (sortBy === 'fee') sortOption = { fee: 1 };

    const exams = await Exam.find(query).sort(sortOption);
    res.json(exams);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
};

export const getExam = async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json(exam);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch exam' });
  }
};

export const createExam = async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = new Exam(req.body);
    await exam.save();
    res.status(201).json(exam);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create exam' });
  }
};

export const updateExam = async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json(exam);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update exam' });
  }
};

export const deleteExam = async (req: Request, res: Response): Promise<void> => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }
    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete exam' });
  }
};
