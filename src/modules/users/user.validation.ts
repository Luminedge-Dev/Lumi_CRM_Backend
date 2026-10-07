import { AppError } from '../../core/errors';
import { STAFF_ROLES } from '../../shared/constants/roles';
import { ProfileUpdateInput } from './user.types';

export const parseRoleUpdate = (body: any): string => {
  const { role } = body;
  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    throw AppError.badRequest('Invalid role');
  }
  return role;
};

/** Only these profile fields are client-editable. */
export const parseProfileUpdate = (body: any): ProfileUpdateInput => {
  const { firstName, lastName, phone, department } = body;
  return { firstName, lastName, phone, department };
};
