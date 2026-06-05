export type RecommendationSource = 'EVIDENCE' | 'SIMILARITY';

export interface InstructorRecommendation {
  instructorUsername: string;
  fullName: string;
  score: number;
  confidence: number;
  sampleSize: number;
  workedWellRate: number;
  avgEngagement: number;
  avgErrors: number;
  source: RecommendationSource;
  alreadyAssigned: boolean;
  reason: string;
  topSignals: string[];
}

export interface ModuleRecommendations {
  moduleId: number;
  moduleTitle: string;
  siteName: string | null;
  sessionsCount: number;
  studentsCount: number;
  coldStart: boolean;
  recommendations: InstructorRecommendation[];
}

export interface ModuleSummary {
  moduleId: number;
  moduleTitle: string;
  siteName: string | null;
  sessionsCount: number;
  studentsCount: number;
  unassigned: boolean;
  coldStart: boolean;
  topInstructorUsername: string | null;
  topInstructorName: string | null;
  topScore: number;
  topConfidence: number;
  source: RecommendationSource;
}

export interface RecommendationOverview {
  computedAt: string;
  totalModules: number;
  modulesCovered: number;
  activeInstructors: number;
  strongFitInstructors: number;
  avgWorkedWellRate: number;
  modulesNeedingAttention: number;
  modules: ModuleSummary[];
}
