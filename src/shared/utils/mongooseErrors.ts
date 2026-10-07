import mongoose from 'mongoose';

// The only place that knows how Mongoose reports bad caller input, so services and the HTTP layer
// can tell "the caller sent something invalid" from "something broke" without importing Mongoose.

export const isValidationError = (err: unknown): err is mongoose.Error.ValidationError =>
  err instanceof mongoose.Error.ValidationError;

export const isCastError = (err: unknown): err is mongoose.Error.CastError => err instanceof mongoose.Error.CastError;

/** A failed schema validation or a malformed id/value: the caller's mistake. */
export const isInvalidInputError = (err: unknown): boolean => isValidationError(err) || isCastError(err);
