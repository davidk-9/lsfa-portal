export type Role = 'SUPER_USER' | 'ADMIN' | 'TRAINER' | 'STUDENT';

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  role: Role;
  axcelerateContactId: string | null;
  impersonating: number | null;
  impersonatingName: string | null;
  impersonatingAxcelerateContactId: string | null;
}

export interface ImpersonationInfo {
  id: number;
  name: string;
  axcelerateContactId: string | null;
}
