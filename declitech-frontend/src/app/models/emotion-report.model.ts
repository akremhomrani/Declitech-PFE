export interface SessionAlert {
  id?: number;
  sessionId: string;
  studentLoginIdentity: string;
  alertType: string;
  severity: string;
  message: string;
  timestamp: string;
  tabUrl?: string;
  tabTitle?: string;
  switchCount?: number;
}

export interface EmotionReport {
  id?: number;
  sessionId: string;
  sessionCode?: string;
  generatedAt: string;
  studentLoginIdentity: string;
  status?: string;
  finalState?: string;
  finalSentence?: string;
  emotionMeans?: Record<string, number>;
  angryMean?: number;
  disgustMean?: number;
  fearMean?: number;
  happyMean?: number;
  sadMean?: number;
  surpriseMean?: number;
  neutralMean?: number;
  dominantEmotion?: string;
  numberOfSamples?: number;
  instructorNote?: string;
  timeline?: EmotionTimeline[];
  createdAt?: string;
  updatedAt?: string;
}

export interface EmotionTimeline {
  id?: number;
  ts: string;
  status: string;
  dominant?: string;
  probs?: EmotionProbs;
  sessionId?: string;
  studentLoginIdentity?: string;
}

export interface EmotionProbs {
  angry: number;
  disgust: number;
  fear: number;
  happy: number;
  sad: number;
  surprise: number;
  neutral: number;
}

export interface SessionStatistics {
  totalStudents: number;
  connectedStudents: number;
  focusedStudents: number;
  distractedStudents: number;
  averageAttention: number;
}
