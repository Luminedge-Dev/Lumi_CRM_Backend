import path from 'path';
import fs from 'fs';
import { put } from '@vercel/blob';

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export interface StoredFile {
  // Absolute URL (Vercel Blob) or relative API path (local disk) — frontend
  // already handles both via `filePath.startsWith('http') ? filePath : API_URL + filePath`.
  fileUrl: string;
  fileName: string;
}

// Vercel's serverless filesystem is read-only outside /tmp, and /tmp is wiped
// between invocations/instances, so local disk is not durable in production.
// Vercel Blob (BLOB_READ_WRITE_TOKEN) gives every uploaded document a stable,
// publicly fetchable URL that survives across instances and deploys.
export async function storeUploadedFile(file: Express.Multer.File): Promise<StoredFile> {
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `${Date.now()}-${safeName}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(fileName, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    return { fileUrl: blob.url, fileName };
  }

  if (process.env.NODE_ENV === 'production') {
    // No durable storage configured — fail loudly instead of attempting to
    // write to the read-only production filesystem (process.cwd() is read-only
    // on Vercel outside /tmp, which itself isn't shared across instances).
    throw new Error('File uploads are unavailable: BLOB_READ_WRITE_TOKEN is not configured');
  }

  // Local dev fallback — no Blob token configured, write to disk and serve via /uploads.
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, fileName), file.buffer);
  return { fileUrl: `/uploads/${fileName}`, fileName };
}
