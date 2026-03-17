import { SessionInfo } from './session-info.model';

export interface Module {
  id: number;
  title: string;
  description: string;
  status: string;
  sites: string[];
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
  sessionCount?: number;
  sessions?: SessionInfo[];
  createdByUsername?: string;
  createdByEmail?: string;
}
