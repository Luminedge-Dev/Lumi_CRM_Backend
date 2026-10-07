import { asyncHandler, HandlerOptions } from '../../core/http';
import { newsService } from './news.service';
import { parseNewsCreate, parseNewsFilter, parseNewsUpdate } from './news.validation';

// `{ success: false, message }` on failure; a validation failure is a 500 with its text (as before).
const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'news controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

export const getNews = asyncHandler(async (req, res) => {
  res.json({ success: true, news: await newsService.list(parseNewsFilter(req.query)) });
}, opts);

export const createNews = asyncHandler(async (req, res) => {
  const post = await newsService.create(parseNewsCreate(req.body), (req as any).userId);
  res.status(201).json({ success: true, news: post });
}, opts);

export const updateNews = asyncHandler(async (req, res) => {
  res.json({ success: true, news: await newsService.update(req.params.id, parseNewsUpdate(req.body)) });
}, opts);

export const deleteNews = asyncHandler(async (req, res) => {
  await newsService.archive(req.params.id);
  res.json({ success: true, message: 'Post archived' });
}, opts);
