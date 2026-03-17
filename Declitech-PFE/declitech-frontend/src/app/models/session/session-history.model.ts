export interface SessionHistory {
  id: number;
  sessionCode: string;
  title: string;
  instructorId: number;
  instructorUsername: string;
  moduleId?: number;
  durationHours: number;
  participantCount: number;
  reportCount: number;
  status: string;
  createdAt: string;
  expiresAt: string;
}
