// Credential fields that must never be serialized into an API response, however a document
// reaches res.json (direct, populate, toJSON of a parent...). The schemas keep these fields
// readable in code (login compares passwordHash), so protection is applied at serialization.
export const SENSITIVE_AUTH_FIELDS = ['passwordHash', 'resetPasswordToken', 'resetPasswordExpires'] as const;

// Mongoose `.select()` exclusion-projection string equivalent to SENSITIVE_AUTH_FIELDS, e.g.
// '-passwordHash -resetPasswordToken -resetPasswordExpires'. Kept derived so the two never drift.
export const SENSITIVE_AUTH_FIELDS_PROJECTION = SENSITIVE_AUTH_FIELDS.map((field) => `-${field}`).join(' ');

export const stripSensitiveAuthFields = (_doc: unknown, ret: Record<string, unknown>): Record<string, unknown> => {
  for (const field of SENSITIVE_AUTH_FIELDS) delete ret[field];
  return ret;
};
