import { Request, Response } from 'express';
import Document from '../models/Document';
import { storeUploadedFile } from '../utils/fileStorage';

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const isStudent = !!(req as any).studentId;
    const studentId = isStudent ? (req as any).studentId : req.body.studentId;
    const { documentType, applicationId } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { fileUrl, fileName } = await storeUploadedFile(req.file);

    const doc = await Document.create({
      studentId,
      applicationId: applicationId || undefined,
      documentType,
      fileName,
      originalName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath: fileUrl,
      uploadedBy: isStudent ? 'student' : 'staff',
      status: 'Uploaded',
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMyDocuments = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).studentId;
    const docs = await Document.find({ studentId }).sort({ createdAt: -1 });
    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getStudentDocuments = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const docs = await Document.find({ studentId }).sort({ createdAt: -1 });
    res.json({ success: true, documents: docs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const requestDocument = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { studentId, documentType, applicationId, requestNote } = req.body;

    const doc = await Document.create({
      studentId,
      applicationId: applicationId || undefined,
      documentType,
      fileName: 'pending',
      uploadedBy: 'staff',
      status: 'Requested',
      requestedBy: userId,
      requestNote,
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const reviewDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;
    const userId = (req as any).userId;

    const doc = await Document.findByIdAndUpdate(
      id,
      { status, reviewNote, reviewedBy: userId },
      { new: true }
    );

    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    res.json({ success: true, document: doc });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};
