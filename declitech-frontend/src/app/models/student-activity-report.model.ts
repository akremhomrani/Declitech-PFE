export interface StudentActivityReport {
  id: number;
  sessionCode: string;
  studentLoginIdentity: string;
  activitiesCount: number;
  totalExecutions: number;
  totalErrors: number;
  difficulty: string;
  workedWell: boolean;
  summary: string;
  details: string;
  generatedAt: string;
}
