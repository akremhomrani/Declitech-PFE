import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';
import { EmotionReport, SessionAlert } from '../models/emotion-report.model';

@Injectable({ providedIn: 'root' })
export class EmotionService {
  private readonly http = inject(HttpClient);

  getReportsBySessionCode(sessionCode: string): Observable<EmotionReport[]> {
    return this.http.get<EmotionReport[]>(ApiPaths.emotions.bySessionCode(sessionCode), HTTP_WITH_CREDENTIALS);
  }

  getReportCountBySessionCode(sessionCode: string): Observable<number> {
    return this.http.get<number>(ApiPaths.emotions.countBySessionCode(sessionCode), HTTP_WITH_CREDENTIALS);
  }

  updateInstructorNote(reportId: number, note: string): Observable<{ id: number; note: string }> {
    return this.http.patch<{ id: number; note: string }>(
      ApiPaths.emotions.note(reportId),
      { note },
      HTTP_WITH_CREDENTIALS
    );
  }

  getAlertsBySessionAndStudent(sessionId: string, studentLoginIdentity: string): Observable<SessionAlert[]> {
    return this.http.get<SessionAlert[]>(
      ApiPaths.alerts.sessionStudent(sessionId, studentLoginIdentity),
      HTTP_WITH_CREDENTIALS
    );
  }
}
