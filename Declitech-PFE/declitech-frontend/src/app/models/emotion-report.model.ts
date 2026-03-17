export interface EmotionReport {
  id?: number;
  sessionId: string;
  participantId: string;
  generatedAt: string;
  studentLoginIdentity: string;
  status?: string;
  finalState?: string;
  finalSentence?: string;
  angryMean?: number;
  disgustMean?: number;
  fearMean?: number;
  happyMean?: number;
  sadMean?: number;
  surpriseMean?: number;
  neutralMean?: number;
  dominantEmotion?: string;
  numberOfSamples?: number;
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
  participantId?: string;
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

export interface StudentSession {
  studentLoginIdentity: string;
  sessionId: string;
  participantId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'OFFLINE';
  lastUpdate: string;
  dominantEmotion?: string;
  engagementScore?: number;
  alerts?: string[];
}

export interface SessionStatistics {
  totalStudents: number;
  connectedStudents: number;
  focusedStudents: number;
  distractedStudents: number;
  averageAttention: number;
}
