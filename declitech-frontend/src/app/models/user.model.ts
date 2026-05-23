export type UserRole = 'ADMIN' | 'INSTRUCTEUR' | 'FREELANCER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface ModuleAssignment {
  moduleId: number;
  siteName: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  role: UserRole;
  status: UserStatus;
  moduleIds: number[];
  moduleAssignments: ModuleAssignment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role: UserRole;
  moduleAssignments?: ModuleAssignment[];
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: UserRole;
  status?: UserStatus;
  moduleAssignments?: ModuleAssignment[];
}

export interface PagedUsers {
  content: User[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
