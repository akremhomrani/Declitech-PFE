import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { EmotionReport, SessionAlert } from '../models/emotion-report.model';

@Injectable({
  providedIn: 'root'
})
export class EmotionService {
  private apiUrl = `${environment.apiUrl}/api/emotions`;

  constructor(private http: HttpClient) {}

  getAllReports(): Observable<EmotionReport[]> {
    return this.http.get<EmotionReport[]>(this.apiUrl);
  }

  getReportsByStudent(studentLoginIdentity: string): Observable<EmotionReport[]> {
    return this.http.get<EmotionReport[]>(`${this.apiUrl}/student/${studentLoginIdentity}`);
  }

  getReportBySessionId(sessionId: string): Observable<EmotionReport> {
    return this.http.get<EmotionReport>(`${this.apiUrl}/session/${sessionId}`);
  }

  getReportsBySessionCode(sessionCode: string): Observable<EmotionReport[]> {
    return this.http.get<EmotionReport[]>(`${this.apiUrl}/session-code/${sessionCode}`);
  }

  getReportsBySessionId(sessionId: number): Observable<EmotionReport[]> {
    return this.http.get<EmotionReport[]>(`${this.apiUrl}/session/${sessionId}`);
  }

  getReportCountBySessionCode(sessionCode: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count?sessionCode=${sessionCode}`);
  }

  getActiveStudents(): Observable<EmotionReport[]> {
    return this.http.get<EmotionReport[]>(this.apiUrl);
  }

  getReportsByDateRange(startDate: string, endDate: string): Observable<EmotionReport[]> {
    const params = new HttpParams()
      .set('startDate', startDate)
      .set('endDate', endDate);
    return this.http.get<EmotionReport[]>(`${this.apiUrl}/range`, { params });
  }

  updateInstructorNote(reportId: number, note: string): Observable<{ id: number; note: string }> {
    return this.http.patch<{ id: number; note: string }>(
      `${environment.apiUrl}/api/emotions/${reportId}/note`,
      { note }
    );
  }

  getAlertsBySessionAndStudent(sessionId: string, studentLoginIdentity: string): Observable<SessionAlert[]> {
    const encoded = encodeURIComponent(studentLoginIdentity);
    return this.http.get<SessionAlert[]>(
      `${environment.apiUrl}/api/alerts/session/${sessionId}/student/${encoded}`
    );
  }
}
