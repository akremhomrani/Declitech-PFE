import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';
import { StorageKeys } from './storage-keys';
import { LoggerService } from './logger.service';
import { SessionData, SessionHistory, PagedSessionResponse } from '../models/session';

interface CreateSessionRequest {
  title: string;
  durationHours: number;
  moduleId?: number;
}

interface CreateSessionResponse {
  id: number;
  sessionCode: string;
  title: string;
  participantCount?: number;
  expiresAt?: string;
  isActive?: boolean;
}

export interface SessionFilters {
  search?: string;
  title?: string;
  sessionCode?: string;
  status?: string;
  instructorUsername?: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private readonly TIMER_INTERVAL_MS = 1_000;
  private readonly SECONDS_PER_MINUTE = 60;
  private readonly MS_PER_SECOND = 1_000;

  private readonly sessionDataSubject = new BehaviorSubject<SessionData | null>(null);
  readonly sessionData$: Observable<SessionData | null> = this.sessionDataSubject.asObservable();

  private readonly elapsedTimeSubject = new BehaviorSubject<string>('0m 0s');
  readonly elapsedTime$: Observable<string> = this.elapsedTimeSubject.asObservable();

  private readonly sessionEndedSubject = new Subject<{ code: string; reason: string }>();
  readonly sessionEnded$ = this.sessionEndedSubject.asObservable();

  private timerInterval?: ReturnType<typeof setInterval>;
  private sessionExpirationTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    this.loadSessionFromStorage();
  }

  createSession(title: string, duration: number, moduleId?: number): void {
    const durationHours = duration / this.SECONDS_PER_MINUTE;
    const request: CreateSessionRequest = { title, durationHours };
    if (moduleId) request.moduleId = moduleId;

    this.http.post<CreateSessionResponse>(ApiPaths.sessions.root, request, HTTP_WITH_CREDENTIALS).subscribe({
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
        this.activateSession(sessionData);
      },
      error: (err) => {
        this.logger.warn('Falling back to local session creation', { err });
        this.createSessionLocally(title, duration);
      }
    });
  }

  joinByCode(code: string, title: string = 'Joined session', durationMinutes: number = 90): void {
    const trimmed = (code || '').trim().toUpperCase();
    if (!trimmed) return;

    const current = this.sessionDataSubject.value;
    if (current && current.code === trimmed) return;

    this.activateSession({
      code: trimmed,
      title,
      duration: durationMinutes,
      connectedStudents: 0,
      startTime: new Date()
    });
  }

  endSession(reason: string = 'manual'): void {
    const currentSession = this.sessionDataSubject.value;
    this.clearTimers();

    if (currentSession) {
      this.sessionEndedSubject.next({ code: currentSession.code, reason });
      if (currentSession.id) {
        this.http.post(ApiPaths.sessions.end(currentSession.id), {}, HTTP_WITH_CREDENTIALS).subscribe({
          next: () => { },
          error: (err) => this.logger.warn('Failed to end session on backend', { err, sessionId: currentSession.id })
        });
      }
    }

    this.sessionDataSubject.next(null);
    this.elapsedTimeSubject.next('0m 0s');
    localStorage.removeItem(StorageKeys.session.active);
  }

  getAllActiveSessions(): Observable<SessionHistory[]> {
    return this.http.get<SessionHistory[]>(ApiPaths.sessions.active, HTTP_WITH_CREDENTIALS);
  }

  getCurrentSession(): SessionData | null {
    return this.sessionDataSubject.value;
  }

  getSessionCode(): string {
    return this.sessionDataSubject.value?.code || '';
  }

  getSessionById(id: number): Observable<SessionHistory> {
    return this.http.get<SessionHistory>(ApiPaths.sessions.byId(id), HTTP_WITH_CREDENTIALS);
  }

  getElapsedTime(): string {
    return this.elapsedTimeSubject.value;
  }

  getSessionHistory(page: number = 0, size: number = 10): Observable<PagedSessionResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedSessionResponse>(ApiPaths.sessions.history, { params, ...HTTP_WITH_CREDENTIALS });
  }

  filterSessionHistory(filters: SessionFilters, page: number = 0, size: number = 10): Observable<PagedSessionResponse> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.title) params = params.set('title', filters.title);
    if (filters.sessionCode) params = params.set('sessionCode', filters.sessionCode);
    if (filters.instructorUsername) params = params.set('instructorUsername', filters.instructorUsername);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<PagedSessionResponse>(ApiPaths.sessions.history, { params, ...HTTP_WITH_CREDENTIALS });
  }

  private createSessionLocally(title: string, duration: number): void {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.activateSession({
      code,
      title,
      duration,
      connectedStudents: 0,
      startTime: new Date()
    });
  }

  private activateSession(sessionData: SessionData): void {
    this.sessionDataSubject.next(sessionData);
    this.saveSessionToStorage(sessionData);
    this.startTimer(sessionData.startTime);
    this.startSessionExpirationTimer(sessionData);
  }

  private clearTimers(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.sessionExpirationTimeout) clearTimeout(this.sessionExpirationTimeout);
    this.timerInterval = undefined;
    this.sessionExpirationTimeout = undefined;
  }

  private startTimer(startTime: Date): void {
    this.clearTimers();
    this.timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / this.MS_PER_SECOND);
      const minutes = Math.floor(elapsed / this.SECONDS_PER_MINUTE);
      const seconds = elapsed % this.SECONDS_PER_MINUTE;
      this.elapsedTimeSubject.next(`${minutes}m ${seconds}s`);
    }, this.TIMER_INTERVAL_MS);
  }

  private startSessionExpirationTimer(sessionData: SessionData): void {
    if (this.sessionExpirationTimeout) clearTimeout(this.sessionExpirationTimeout);

    const durationMs = sessionData.duration * this.SECONDS_PER_MINUTE * this.MS_PER_SECOND;
    const elapsedMs = Date.now() - new Date(sessionData.startTime).getTime();
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    if (remainingMs > 0) {
      this.sessionExpirationTimeout = setTimeout(() => this.endSession('expired'), remainingMs);
    } else {
      this.endSession('expired');
    }
  }

  private saveSessionToStorage(sessionData: SessionData): void {
    localStorage.setItem(StorageKeys.session.active, JSON.stringify(sessionData));
  }

  private loadSessionFromStorage(): void {
    const stored = localStorage.getItem(StorageKeys.session.active);
    if (!stored) return;

    try {
      const sessionData: SessionData = JSON.parse(stored);
      sessionData.startTime = new Date(sessionData.startTime);

      const durationMs = sessionData.duration * this.SECONDS_PER_MINUTE * this.MS_PER_SECOND;
      const elapsedMs = Date.now() - sessionData.startTime.getTime();

      if (elapsedMs >= durationMs) {
        localStorage.removeItem(StorageKeys.session.active);
        return;
      }

      this.sessionDataSubject.next(sessionData);
      this.startTimer(sessionData.startTime);
      this.startSessionExpirationTimer(sessionData);
    } catch (err) {
      this.logger.warn('Failed to restore stored session', { err });
      localStorage.removeItem(StorageKeys.session.active);
    }
  }
}
