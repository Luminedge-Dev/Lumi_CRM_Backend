import { StaffRole } from '../../shared/constants/roles';

export interface RegisterInput {
  name: any;
  email: any;
  password: any;
  role: StaffRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface StaffSessionUser {
  id: unknown;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface StaffSession {
  accessToken: string;
  user: StaffSessionUser;
}

export type LoginResult =
  | ({ kind: 'session' } & StaffSession)
  | { kind: 'password-setup-required'; email: string };

export type CheckUserResult = { exists: false } | { exists: true; type: 'staff' | 'student' };
