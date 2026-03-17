import { SessionHistory } from './session-history.model';

export interface PagedSessionResponse {
  sessions: SessionHistory[];
  currentPage: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
