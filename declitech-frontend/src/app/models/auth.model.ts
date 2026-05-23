import { UserRole } from './user.model';

export interface AuthProfile {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  firstName: string;
  lastName: string;
  username: string;
  role: UserRole;
}
