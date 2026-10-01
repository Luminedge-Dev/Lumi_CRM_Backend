import { Request, Response } from 'express';
import NewsUpdate from '../models/NewsUpdate';

export const getNews = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    const filter: any = { isActive: true };
    if (category) filter.category = category;

    const news = await NewsUpdate.find(filter)
      .populate('createdBy', 'name')
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50);

    res.json({ success: true, news });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createNews = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { title, content, category, isPinned } = req.body;

    const post = await NewsUpdate.create({ title, content, category, isPinned, createdBy: userId });
    res.status(201).json({ success: true, news: post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateNews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const post = await NewsUpdate.findByIdAndUpdate(id, updates, { new: true });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found' });
    res.json({ success: true, news: post });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteNews = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await NewsUpdate.findByIdAndUpdate(id, { isActive: false });
    res.json({ success: true, message: 'Post archived' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
