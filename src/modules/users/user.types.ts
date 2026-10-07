export interface ListUsersQuery {
  role?: string;
  limit?: string;
}

export interface ProfileUpdateInput {
  firstName?: unknown;
  lastName?: unknown;
  phone?: unknown;
  department?: unknown;
}
