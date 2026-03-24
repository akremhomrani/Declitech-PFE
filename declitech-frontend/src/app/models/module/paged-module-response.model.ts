import { Module } from './module.model';

export interface PagedModuleResponse {
  modules: Module[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
