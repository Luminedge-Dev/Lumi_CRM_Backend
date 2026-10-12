import { AppError, found } from '../../core/errors';
import { storeUploadedFile } from '../../integrations/storage/fileStorage';
import { applicationRepository } from '../applications/application.repository';
import { studentRepository } from '../students/student.repository';
import { documentRepository } from './document.repository';
import { DocumentRequestInput, UploadInput } from './document.validation';

export const documentService = {
  /** Stores an uploaded file and records it. Everything is validated before storing so a rejected request leaves no orphaned file. */
  async upload({ isStudent, studentId, documentType, applicationId, existingDocId, file }: UploadInput) {
    if (!isStudent && !(await studentRepository.existsById(studentId))) throw new AppError('Student not found', 404);
    if (applicationId && !(await applicationRepository.existsForStudent(applicationId, studentId))) {
      throw new AppError('Application not found for this student', 404);
    }
    // Fulfilling a staff request: it must be this student's and still waiting for a file.
    if (existingDocId && !(await documentRepository.findOpenRequest(existingDocId, studentId))) {
      throw new AppError('Requested document not found or already fulfilled', 404);
    }

    const { fileUrl, fileName } = await storeUploadedFile(file);

    if (existingDocId) {
      // The request keeps its own documentType and staff note; the file and status are filled in.
      const fulfilled = await documentRepository.fulfilRequest(existingDocId, studentId, {
        fileName,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath: fileUrl,
        uploadedBy: isStudent ? 'student' : 'staff',
        status: 'Uploaded',
        ...(applicationId && { applicationId }),
      });
      // Lost a race with a concurrent upload for the same request.
      if (!fulfilled) throw new AppError('Requested document not found or already fulfilled', 409);
      return fulfilled;
    }

    return documentRepository.create({
      studentId,
      applicationId,
      documentType,
      fileName,
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      filePath: fileUrl,
      uploadedBy: isStudent ? 'student' : 'staff',
      status: 'Uploaded',
    });
  },

  listForStudent: (studentId: unknown) => documentRepository.listForStudent(studentId),

  /** Staff ask a student to provide a document: creates a placeholder in 'Requested' status. */
  async request({ studentId, documentType, applicationId, note }: DocumentRequestInput, requestedBy: string) {
    if (!(await studentRepository.existsById(studentId))) throw new AppError('Student not found', 404);
    if (applicationId && !(await applicationRepository.existsForStudent(applicationId, studentId))) {
      throw new AppError('Application not found for this student', 404);
    }

    return documentRepository.create({
      studentId,
      applicationId,
      documentType,
      fileName: 'pending',
      uploadedBy: 'staff',
      status: 'Requested',
      requestedBy,
      requestNote: note,
    });
  },

  async review(id: string, status: string, reviewNote: string | undefined, reviewedBy: string) {
    return found(await documentRepository.review(id, { status, reviewNote, reviewedBy }), 'Document not found');
  },
};
