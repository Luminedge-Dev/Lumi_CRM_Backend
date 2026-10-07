import { AppError } from './AppError';

/** Returns `doc` if truthy, otherwise throws AppError.notFound(message). */
export const found = <T>(doc: T | null | undefined, message: string): T => {
  if (!doc) throw AppError.notFound(message);
  return doc;
};
