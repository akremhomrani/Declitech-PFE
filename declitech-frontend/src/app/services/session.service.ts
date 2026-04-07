import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { SessionData, SessionHistory, PagedSessionResponse } from '../models/session';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionDataSubject = new BehaviorSubject<SessionData | null>(null);
  public sessionData$: Observable<SessionData | null> = this.sessionDataSubject.asObservable();

  private timerInterval?: ReturnType<typeof setInterval>;
  private sessionExpirationTimeout?: ReturnType<typeof setTimeout>;
  private elapsedTimeSubject = new BehaviorSubject<string>('0m 0s');
  public elapsedTime$: Observable<string> = this.elapsedTimeSubject.asObservable();

  private sessionEndedSubject = new Subject<{ code: string; reason: string }>();
  public sessionEnded$ = this.sessionEndedSubject.asObservable();

  private apiUrl = `${environment.apiUrl}/api/sessions`;

  constructor(private http: HttpClient) {
    this.loadSessionFromStorage();
  }

  createSession(title: string, duration: number, moduleId?: number): void {
    const durationHours = duration / 60;
    const request: any = { title, durationHours };
    
    if (moduleId) {
      request.moduleId = moduleId;
    }

    this.http.post<any>(this.apiUrl, request, { withCredentials: true }).subscribe({
      next: (response) => {
        const sessionData: SessionData = {
          id: response.id,
          code: response.sessionCode,
          title: response.title,
          duration,
          connectedStudents: response.participantCount || 0,
          startTime: new Date(),
          expiresAt: response.expiresAt,
          isActive: response.isActive
        };

        this.sessionDataSubject.next(sessionData);
        this.saveSessionToStorage(sessionData);
        this.startTimer(sessionData.startTime);
        this.startSessionExpirationTimer(sessionData);
      },
      error: () => {
        this.createSessionLocally(title, duration);
      }
    });
  }

  private createSessionLocally(title: string, duration: number): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const sessionData: SessionData = {
      code,
      title,
      duration,
      connectedStudents: 0,
      startTime: new Date()
    };

    this.sessionDataSubject.next(sessionData);
    this.saveSessionToStorage(sessionData);
    this.startTimer(sessionData.startTime);
    this.startSessionExpirationTimer(sessionData);
  }

  endSession(reason: string = 'manual'): void {
    const currentSession = this.sessionDataSubject.value;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    if (this.sessionExpirationTimeout) {
      clearTimeout(this.sessionExpirationTimeout);
    }
    
    if (currentSession) {
      this.sessionEndedSubject.next({ code: currentSession.code, reason });

      if (currentSession.id) {
        this.http.post(`${this.apiUrl}/${currentSession.id}/end`, {}, { withCredentials: true }).subscribe({
          next: () => {},
          error: () => {}
        });
      }
    }
    
    this.sessionDataSubject.next(null);
    this.elapsedTimeSubject.next('0m 0s');
    localStorage.removeItem('active_session');
  }

  getAllActiveSessions(): Observable<SessionHistory[]> {
    return this.http.get<SessionHistory[]>(`${this.apiUrl}/active`, { withCredentials: true });
  }

  getCurrentSession(): SessionData | null {
    return this.sessionDataSubject.value;
  }

  getSessionCode(): string {
    return this.sessionDataSubject.value?.code || '';
  }

  getSessionById(id: number): Observable<SessionHistory> {
    return this.http.get<SessionHistory>(`${this.apiUrl}/${id}`);
  }

  getElapsedTime(): string {
    return this.elapsedTimeSubject.value;
  }

  getSessionHistory(page: number = 0, size: number = 10): Observable<PagedSessionResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PagedSessionResponse>(`${this.apiUrl}/history/paginated`, { params });
  }

  filterSessionHistory(filters: any, page: number = 0, size: number = 10): Observable<PagedSessionResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters.search) params = params.set('search', filters.search);
    if (filters.title) params = params.set('title', filters.title);
    if (filters.sessionCode) params = params.set('sessionCode', filters.sessionCode);
    if (filters.instructorUsername) params = params.set('instructorUsername', filters.instructorUsername);
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get<PagedSessionResponse>(`${this.apiUrl}/history/paginated`, { params });
  }

  private startTimer(startTime: Date): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }

    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - startTime.getTime()) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      this.elapsedTimeSubject.next(`${minutes}m ${seconds}s`);
    }, 1000);
  }

  private startSessionExpirationTimer(sessionData: SessionData): void {
    if (this.sessionExpirationTimeout) {
      clearTimeout(this.sessionExpirationTimeout);
    }

    const durationMs = sessionData.duration * 60 * 1000;
    const elapsedMs = new Date().getTime() - new Date(sessionData.startTime).getTime();
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    if (remainingMs > 0) {
      this.sessionExpirationTimeout = setTimeout(() => {
        this.endSession('expired');
      }, remainingMs);
    } else {
      this.endSession('expired');
    }
  }

  private saveSessionToStorage(sessionData: SessionData): void {
    localStorage.setItem('active_session', JSON.stringify(sessionData));
  }

  private loadSessionFromStorage(): void {
    const stored = localStorage.getItem('active_session');
    if (stored) {
      try {
        const sessionData: SessionData = JSON.parse(stored);
        sessionData.startTime = new Date(sessionData.startTime);
        
        const durationMs = sessionData.duration * 60 * 1000;
        const elapsedMs = new Date().getTime() - sessionData.startTime.getTime();
        
        if (elapsedMs >= durationMs) {
          localStorage.removeItem('active_session');
          return;
        }
        
        this.sessionDataSubject.next(sessionData);
        this.startTimer(sessionData.startTime);
        this.startSessionExpirationTimer(sessionData);
      } catch (e) {
        localStorage.removeItem('active_session');
      }
    }
  }
}
