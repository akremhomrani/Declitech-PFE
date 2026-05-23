export interface SessionHistory {
  id: number;
  sessionCode: string;
  title: string;
  instructorId?: number;
  instructorUsername: string;
  instructorEmail?: string;
  moduleId?: number;
  siteId?: number;
  siteName?: string;
  moduleName?: string;
  moduleCode?: string;
  instructorSite?: string;
  durationHours: number;
  participantCount: number;
  reportCount: number;
  status: string;
  createdAt: string;
  expiresAt: string;
}
