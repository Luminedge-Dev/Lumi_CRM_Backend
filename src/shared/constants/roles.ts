export const STAFF_ROLES = ['admin', 'bdm'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: unknown): role is StaffRole => STAFF_ROLES.includes(role as StaffRole);

/** Legacy sub-roles (senior-bdm, junior-bdm, ...) act as 'bdm'; only 'admin' is admin. */
export const toStaffRole = (role: unknown): StaffRole => (role === 'admin' ? 'admin' : 'bdm');
