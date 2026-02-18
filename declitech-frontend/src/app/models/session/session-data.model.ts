export interface SessionData {
  id?: number;
  code: string;
  title: string;
  duration: number;
  connectedStudents: number;
  startTime: Date;
  expiresAt?: string;
  isActive?: boolean;
}
