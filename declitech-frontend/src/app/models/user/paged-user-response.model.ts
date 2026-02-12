import { User } from './user.model';

export interface PagedUserResponse {
  users: User[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}
