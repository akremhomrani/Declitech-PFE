export interface Alert {
  sessionId: string;
  studentLoginIdentity?: string;
  alertType: 'TAB_SWITCH' | 'MULTIPLE_SWITCHES' | 'OFF_PLATFORM' | 'INACTIVITY' | 'LOW_ENGAGEMENT' | 'DISTRACTION' | 'FOCUS_LOSS' | 'ALERT_RESOLVED' | 'MOUSE_INACTIVITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
