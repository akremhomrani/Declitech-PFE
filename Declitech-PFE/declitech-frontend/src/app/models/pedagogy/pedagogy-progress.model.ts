export interface PedagogyProgress {
    // Session
    sessionId: string;
    participantId?: string;
    studentLoginIdentity?: string;

    // Site & niveau
    site: string;
    levelName?: string;
    levelNumber?: number;
    courseName?: string;
    lessonNumber?: number;
    activityTitle?: string;
    completed?: boolean;

    // Résultat IA
    score: number;   // 0-100
    correct: boolean;
    feedback: string;
    expectedSolution?: string;
    source?: string;

    timestamp?: string;
}
