import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

export interface SessionData {
  id?: number;
  code: string;
  title: string;
  duration: number;
  connectedStudents: number;
  startTime: Date;
  expiresAt?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionDataSubject = new BehaviorSubject<SessionData | null>(null);
  public sessionData$: Observable<SessionData | null> = this.sessionDataSubject.asObservable();

  private timerInterval: any;
  private sessionExpirationTimeout: any;
  private elapsedTimeSubject = new BehaviorSubject<string>('0m 0s');
  public elapsedTime$: Observable<string> = this.elapsedTimeSubject.asObservable();

  // Event emitter for session ended
  private sessionEndedSubject = new Subject<{ code: string; reason: string }>();
  public sessionEnded$ = this.sessionEndedSubject.asObservable();

  private apiUrl = 'http://localhost:8084/api/sessions'; // SessionService endpoint

  constructor(private http: HttpClient) {
    // Load session from localStorage on service init
    this.loadSessionFromStorage();
  }

  createSession(title: string, duration: number): void {
    console.log('Creating session:', { title, duration });

    // Convert minutes to hours for API
    const durationHours = duration / 60;

    const request = {
      title,
      durationHours
    };

    console.log('Sending request to backend:', request);

    // Note: JWT token is sent automatically via httpOnly cookie
    // The JwtInterceptor adds withCredentials: true to all requests
    this.http.post<any>(this.apiUrl, request).subscribe({
      next: (response) => {
        console.log('Backend response:', response);
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
        console.log('✅ Session created on backend:', sessionData);
      },
      error: (error) => {
        console.error('❌ Failed to create session on backend:', {
          status: error.status,
          message: error.message,
          error: error.error,
          url: error.url
        });
        
        // Fallback: Create locally if backend fails
        console.log('⚠️ Falling back to local session creation');
        this.createSessionLocally(title, duration);
      }
    });
  }

  private createSessionLocally(title: string, duration: number): void {
    // Fallback: Generate random code if backend fails
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
    
    // Emit session ended event with the session code
    if (currentSession) {
      this.sessionEndedSubject.next({ code: currentSession.code, reason });
      
      // Call backend to end session if it was created on backend
      if (currentSession.id) {
        this.http.post(`${this.apiUrl}/${currentSession.id}/end`, {}).subscribe({
          next: () => console.log('✅ Session ended on backend'),
          error: (err) => console.error('Failed to end session on backend:', err)
        });
      }
    }
    
    this.sessionDataSubject.next(null);
    this.elapsedTimeSubject.next('0m 0s');
    localStorage.removeItem('active_session');
  }

  getCurrentSession(): SessionData | null {
    return this.sessionDataSubject.value;
  }

  getSessionCode(): string {
    return this.sessionDataSubject.value?.code || '';
  }

  getElapsedTime(): string {
    return this.elapsedTimeSubject.value;
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

    // Calculate remaining time in milliseconds
    const durationMs = sessionData.duration * 60 * 1000; // duration is in minutes
    const elapsedMs = new Date().getTime() - new Date(sessionData.startTime).getTime();
    const remainingMs = Math.max(0, durationMs - elapsedMs);

    console.log(`⏱️ Session will auto-end in ${Math.floor(remainingMs / 60000)} minutes`);

    if (remainingMs > 0) {
      this.sessionExpirationTimeout = setTimeout(() => {
        console.log('⏰ Session time expired - auto-ending session');
        this.endSession('expired');
      }, remainingMs);
    } else {
      // Already expired
      console.log('⏰ Session already expired - ending immediately');
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
        
        // Check if session is already expired
        const durationMs = sessionData.duration * 60 * 1000;
        const elapsedMs = new Date().getTime() - sessionData.startTime.getTime();
        
        if (elapsedMs >= durationMs) {
          // Session already expired, clear it
          console.log('⏰ Stored session was expired - clearing');
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
