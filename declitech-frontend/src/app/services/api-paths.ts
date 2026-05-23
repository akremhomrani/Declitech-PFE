import { environment } from '../../environments/environment';

const base = environment.apiUrl;

export const ApiPaths = {
  auth: {
    login: `${base}/api/auth/login`,
    logout: `${base}/api/auth/logout`,
    refresh: `${base}/api/auth/refresh`,
    me: `${base}/api/users/me`
  },
  users: {
    root: `${base}/api/users`,
    byId: (id: number): string => `${base}/api/users/${id}`,
    password: (id: number): string => `${base}/api/users/${id}/password`
  },
  modules: {
    root: `${base}/api/modules`,
    paged: `${base}/api/modules/paged`,
    me: `${base}/api/modules/me`,
    byId: (id: number): string => `${base}/api/modules/${id}`
  },
  sessions: {
    root: `${base}/api/sessions`,
    active: `${base}/api/sessions/active`,
    history: `${base}/api/sessions/history/paginated`,
    byId: (id: number): string => `${base}/api/sessions/${id}`,
    end: (id: number): string => `${base}/api/sessions/${id}/end`
  },
  emotions: {
    bySessionCode: (code: string): string => `${base}/api/emotions/session-code/${code}`,
    countBySessionCode: (code: string): string => `${base}/api/emotions/count?sessionCode=${code}`,
    note: (reportId: number): string => `${base}/api/emotions/${reportId}/note`
  },
  alerts: {
    session: (sessionId: string): string => `${base}/api/alerts/session/${sessionId}`,
    sessionStudent: (sessionId: string, studentLoginIdentity: string): string =>
      `${base}/api/alerts/session/${sessionId}/student/${encodeURIComponent(studentLoginIdentity)}`,
    stream: (sessionId: string): string => `${base}/api/alerts/stream?sessionId=${sessionId}`
  },
  reports: {
    trackBySessionCode: (code: string): string => `${base}/api/reports/track/session/${code}`
  }
} as const;
