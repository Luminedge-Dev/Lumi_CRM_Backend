import DocumentModel from '../../models/Document';

export const documentRepository = {
  create: (data: Record<string, any>) => DocumentModel.create(data),

  listForStudent: (studentId: unknown) => DocumentModel.find({ studentId }).sort({ createdAt: -1 }),

  review: (id: string, update: Record<string, unknown>) =>
    DocumentModel.findByIdAndUpdate(id, update, { new: true }),

  /** A document request of this student that is still waiting for a file (null otherwise). */
  findOpenRequest: (id: string, studentId: string) =>
    DocumentModel.findOne({ _id: id, studentId, status: { $in: ['Requested', 'Revision Requested'] } }),

  /** Attaches the uploaded file to an open request, only if it is still open (no double fulfilment). */
  fulfilRequest: (id: string, studentId: string, update: Record<string, unknown>) =>
    DocumentModel.findOneAndUpdate(
      { _id: id, studentId, status: { $in: ['Requested', 'Revision Requested'] } },
      update,
      { new: true },
    ),
};
