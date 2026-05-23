export type ModuleStatus = 'ACTIVE' | 'INACTIVE';

export interface Module {
  id: number;
  title: string;
  description: string | null;
  status: ModuleStatus;
  sites: string[];
  createdBy: number;
  createdByUsername: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateModuleRequest {
  title: string;
  description?: string;
  sites?: string[];
}

export interface UpdateModuleRequest {
  title?: string;
  description?: string;
  status?: ModuleStatus;
  sites?: string[];
}

export interface PagedModules {
  content: Module[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
