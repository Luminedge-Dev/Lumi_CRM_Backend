import User, { IUser } from '../../models/User';
import { SENSITIVE_AUTH_FIELDS_PROJECTION as PUBLIC_USER_FIELDS } from '../../shared/utils/sensitiveFields';

// All database access for staff accounts (the `users` collection). Queries are unchanged from
// the controllers they were extracted from.

export const userRepository = {
  findByEmail: (email: string) => User.findOne({ email }),

  findById: (id: unknown) => User.findById(id),

  /** Profile read: everything except the password hash (toJSON also strips reset-token fields). */
  findProfileById: (id: unknown) => User.findById(id).select('-passwordHash'),

  /** Minimal record the auth middleware needs on every request. */
  findAuthState: (id: unknown) => User.findById(id).select('role isActive').lean(),

  /** The user holding an unexpired password-reset token (token is stored hashed). */
  findByValidResetToken: (tokenHash: string) =>
    User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }),

  existsStaffByEmail: (email: string, roles: readonly string[]) =>
    User.findOne({ email, role: { $in: roles } }).select('_id'),

  create: async (data: Partial<IUser>): Promise<IUser> => {
    const user = new User(data);
    await user.save();
    return user;
  },

  save: (user: IUser) => user.save(),

  setResetToken: (id: unknown, tokenHash: string, expires: Date) =>
    User.findByIdAndUpdate(id, { resetPasswordToken: tokenHash, resetPasswordExpires: expires }),

  listActive: async (filter: Record<string, unknown>, limit?: number): Promise<IUser[]> => {
    let query = User.find({ isActive: true, ...filter }).select(PUBLIC_USER_FIELDS);
    if (limit !== undefined) query = query.limit(limit);
    return query.sort({ createdAt: -1 });
  },

  updateRole: (id: string, role: string) =>
    User.findByIdAndUpdate(id, { role }, { new: true }).select('-passwordHash'),

  deactivate: (id: string) => User.findByIdAndUpdate(id, { isActive: false }, { new: true }).select('-passwordHash'),

  updateProfile: (id: unknown, data: Record<string, unknown>) =>
    User.findByIdAndUpdate(id, data, { new: true }).select(PUBLIC_USER_FIELDS),

  /** Ids of active users holding any of the given roles (notification fan-out). */
  findActiveIdsByRoles: (roles: string[], excludeUserId?: string) => {
    const filter: Record<string, unknown> = { role: { $in: roles }, isActive: true };
    if (excludeUserId) filter._id = { $ne: excludeUserId };
    return User.find(filter).select('_id');
  },

  /** Everyone who can be assigned leads (includes legacy sub-roles and admins). */
  listAssignable: () =>
    User.find({ role: { $in: ['bdm', 'senior-bdm', 'junior-bdm', 'admin'] }, isActive: true }).select('_id name email role'),

  listActiveBdmNames: () => User.find({ role: 'bdm', isActive: true }).select('_id name').lean(),

  /** Active BDMs for the performance report (optionally narrowed by the caller's filter). */
  listBdmsForReport: (filter: Record<string, unknown>) =>
    User.find({ isActive: true, role: { $in: ['bdm'] }, ...filter }).select('_id name firstName lastName role'),

  findNameAndRoleById: (id: unknown) => User.findById(id).select('name role'),

  findNameById: (id: unknown) => User.findById(id).select('name'),

  /** Used when a student registers: drops a stray non-staff record that squats on the email. */
  deleteNonStaffByEmail: (email: string, staffRoles: readonly string[]) =>
    User.deleteOne({ email, role: { $nin: staffRoles } }),
};
