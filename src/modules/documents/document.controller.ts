import { asyncHandler, HandlerOptions } from '../../core/http';
import { documentService } from './document.service';
import { parseDocumentRequest, parseReview, parseStudentIdParam, parseUpload } from './document.validation';

// `{ success: false, message }` on failure. Everything the caller can get wrong is a 400/404 with
// a specific message; anything else is logged and answered generically.
const opts: HandlerOptions = {
  shape: 'success',
  fallbackMessage: 'Internal server error',
  logLabel: 'document controller error:',
  exposeValidation: true,
  validationStatus: 500,
};

export const uploadDocument = asyncHandler(async (req, res) => {
  const document = await documentService.upload(parseUpload(req));
  res.status(201).json({ success: true, document });
}, opts);

export const getMyDocuments = asyncHandler(async (req, res) => {
  res.json({ success: true, documents: await documentService.listForStudent((req as any).studentId) });
}, opts);

export const getStudentDocuments = asyncHandler(async (req, res) => {
  const studentId = parseStudentIdParam(req.params.studentId);
  res.json({ success: true, documents: await documentService.listForStudent(studentId) });
}, opts);

export const requestDocument = asyncHandler(async (req, res) => {
  const document = await documentService.request(parseDocumentRequest(req.body), (req as any).userId);
  res.status(201).json({ success: true, document });
}, opts);

export const reviewDocument = asyncHandler(async (req, res) => {
  const { id, status, reviewNote } = parseReview(req.params.id, req.body);
  res.json({ success: true, document: await documentService.review(id, status, reviewNote, (req as any).userId) });
}, opts);
