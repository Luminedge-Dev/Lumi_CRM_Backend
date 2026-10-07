import { Request } from 'express';
import { AppError } from '../../core/errors';
import type { DocumentStatus, DocumentType } from '../../models/Document';
import { isObjectId } from '../../shared/validators/request';

// Mirrors the enums in models/Document.ts so bad input is a 400 instead of a Mongoose error.
export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'Passport', 'National ID', 'Birth Certificate', 'Transcript', 'Certificate',
  'Recommendation Letter', 'SOP', 'LOR', 'CV', 'Bank Statement', 'Sponsor Documents',
  'Visa Form', 'Medical Report', 'Police Clearance', 'Other',
];
export const DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  'Requested', 'Uploaded', 'Under Review', 'Approved', 'Rejected', 'Revision Requested',
];

const MAX_NOTE_LENGTH = 2000;

const isDocumentType = (value: unknown): value is DocumentType =>
  typeof value === 'string' && (DOCUMENT_TYPES as readonly string[]).includes(value);

const isDocumentStatus = (value: unknown): value is DocumentStatus =>
  typeof value === 'string' && (DOCUMENT_STATUSES as readonly string[]).includes(value);

const optionalNote = (value: unknown): string | undefined | null =>
  value === undefined || value === null || value === ''
    ? undefined
    : typeof value === 'string' && value.length <= MAX_NOTE_LENGTH
      ? value
      : null; // null = invalid

/** Empty/missing is allowed (legacy clients send ''). Returns null when present but not an ObjectId. */
const optionalObjectId = (value: unknown): string | undefined | null => {
  if (value === undefined || value === null || value === '') return undefined;
  return isObjectId(value) ? value : null;
};

export interface UploadInput {
  isStudent: boolean;
  studentId: string;
  documentType: DocumentType;
  applicationId?: string;
  /** The open document request this upload fulfils (the student portal sends it). */
  existingDocId?: string;
  file: Express.Multer.File;
}

/** Upload by a student (own account) or staff (on behalf of `studentId`), in the original check order. */
export const parseUpload = (req: Request): UploadInput => {
  const isStudent = !!(req as any).studentId;
  const studentId = isStudent ? (req as any).studentId : req.body?.studentId;
  const { documentType } = req.body ?? {};

  if (!req.file) throw AppError.badRequest('No file uploaded');
  if (!isObjectId(String(studentId))) throw AppError.badRequest('Invalid studentId');
  if (!isDocumentType(documentType)) throw AppError.badRequest('Invalid documentType');
  const applicationId = optionalObjectId(req.body?.applicationId);
  if (applicationId === null) throw AppError.badRequest('Invalid applicationId');
  const existingDocId = optionalObjectId(req.body?.existingDocId);
  if (existingDocId === null) throw AppError.badRequest('Invalid existingDocId');

  return { isStudent, studentId, documentType, applicationId, existingDocId, file: req.file };
};

export const parseStudentIdParam = (studentId: string): string => {
  if (!isObjectId(studentId)) throw AppError.badRequest('Invalid studentId');
  return studentId;
};

export interface DocumentRequestInput {
  studentId: string;
  documentType: DocumentType;
  applicationId?: string;
  note?: string;
}

export const parseDocumentRequest = (body: any): DocumentRequestInput => {
  const { studentId, documentType, requestNote } = body ?? {};

  if (!isObjectId(studentId)) throw AppError.badRequest('Invalid studentId');
  if (!isDocumentType(documentType)) throw AppError.badRequest('Invalid documentType');
  const applicationId = optionalObjectId(body?.applicationId);
  if (applicationId === null) throw AppError.badRequest('Invalid applicationId');
  const note = optionalNote(requestNote);
  if (note === null) throw AppError.badRequest('Invalid requestNote');

  return { studentId, documentType, applicationId, note };
};

export const parseReview = (id: string, body: any): { id: string; status: DocumentStatus; reviewNote?: string } => {
  const { status } = body ?? {};

  if (!isObjectId(id)) throw AppError.badRequest('Invalid document id');
  if (!isDocumentStatus(status)) throw AppError.badRequest('Invalid status');
  const reviewNote = optionalNote(body?.reviewNote);
  if (reviewNote === null) throw AppError.badRequest('Invalid reviewNote');

  return { id, status, reviewNote };
};
