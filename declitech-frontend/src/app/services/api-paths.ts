import { environment } from '../../environments/environment';

const base = environment.apiUrl;

export const ApiPaths = {
  auth: {
    ssoUrl: `${base}/api/auth/sso/url`,
    ssoCallback: `${base}/api/auth/sso/callback`,
    ssoLogin: `${base}/api/auth/sso/login`,
    refresh: `${base}/api/auth/refresh`,
    logout: `${base}/api/auth/logout`,
    validate: `${base}/api/auth/validate`
  },
  sessions: {
    root: `${base}/api/sessions`,
    active: `${base}/api/sessions/active`,
    history: `${base}/api/sessions/history/paginated`,
    byId: (id: number): string => `${base}/api/sessions/${id}`,
    end: (id: number): string => `${base}/api/sessions/${id}/end`
  },
  emotions: {
    root: `${base}/api/emotions`,
    bySessionCode: (code: string): string => `${base}/api/emotions/session-code/${code}`,
    bySessionId: (id: number | string): string => `${base}/api/emotions/session/${id}`,
    countBySessionCode: (code: string): string => `${base}/api/emotions/count?sessionCode=${code}`,
    note: (reportId: number): string => `${base}/api/emotions/${reportId}/note`
  },
  alerts: {
    sessionStudent: (sessionId: string, studentLoginIdentity: string): string =>
      `${base}/api/alerts/session/${sessionId}/student/${encodeURIComponent(studentLoginIdentity)}`,
    stream: (sessionId: string): string => `${base}/api/alerts/stream?sessionId=${sessionId}`
  },
  reports: {
    trackBySessionCode: (code: string): string => `${base}/api/reports/track/session/${code}`
  },
  iam: {
    sites: `${base}/api/iam/sites`
  }
} as const;
