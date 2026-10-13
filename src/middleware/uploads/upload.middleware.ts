import multer from 'multer';

// Buffered in memory so the controller can hand it to storeUploadedFile(), which
// persists to Vercel Blob in production or local disk in dev. See utils/fileStorage.ts.
const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // 400 so the error handler shows the caller this message instead of a generic 500.
    const err: Error & { status?: number } = new Error('Only PDF, JPG, PNG, DOC, DOCX files are allowed');
    err.status = 400;
    cb(err);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});
