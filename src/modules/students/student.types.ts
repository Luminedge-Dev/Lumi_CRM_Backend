export interface StudentRegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface StudentSessionUser {
  id: unknown;
  name: string;
  email: string;
  role: 'student';
  avatarUrl?: string;
  hasLinkedLead?: boolean;
}

export interface StudentSession {
  accessToken: string;
  student: StudentSessionUser;
}

export interface StudentProfileInput {
  name?: any;
  phone?: any;
  address?: any;
}
