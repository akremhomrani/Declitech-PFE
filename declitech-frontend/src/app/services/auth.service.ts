import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';
import { StorageKeys } from './storage-keys';
import { LoggerService } from './logger.service';
import { LoginResponse, UserPayload } from '../models/auth';

interface ValidateTokenResponse {
  valid: boolean;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly logger = inject(LoggerService);

  private readonly POPUP_POLL_INTERVAL_MS = 500;

  private readonly currentUserSubject = new BehaviorSubject<UserPayload | null>(null);
  readonly currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
    this.loadUserInfo();
  }

  initiateSsoLogin(userType: 'student' | 'staff'): Observable<LoginResponse> {
    return new Observable(observer => {
      this.http.get<{ loginUrl: string }>(ApiPaths.auth.ssoUrl, {
        params: { type: userType },
        withCredentials: true
      }).subscribe({
        next: ({ loginUrl }) => {
          const popup = window.open(
            loginUrl,
            'decliiam-sso',
            'width=480,height=600,top=100,left=200,resizable=yes,scrollbars=yes'
          );

          if (!popup) {
            observer.error(new Error('AUTH.ERROR_POPUP_BLOCKED'));
            return;
          }

          const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === 'SSO_CALLBACK') {
              cleanup();
              const { code, state } = event.data;
              this.handleSsoCallback(code, state).subscribe({
                next: (r) => { observer.next(r); observer.complete(); },
                error: (e) => observer.error(e)
              });
            }
            if (event.data?.type === 'SSO_ERROR') {
              cleanup();
              observer.error(new Error(event.data.error || 'AUTH.ERROR_GENERIC'));
            }
          };

          const pollClosed = setInterval(() => {
            if (popup.closed) { cleanup(); observer.error(new Error('AUTH.ERROR_CANCELLED')); }
          }, this.POPUP_POLL_INTERVAL_MS);

          const cleanup = () => {
            clearInterval(pollClosed);
            window.removeEventListener('message', onMessage);
            if (!popup.closed) popup.close();
          };

          window.addEventListener('message', onMessage);
        },
        error: (err) => observer.error(err)
      });
    });
  }

  handleSsoCallback(code: string, state: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(ApiPaths.auth.ssoCallback, { code, state }, HTTP_WITH_CREDENTIALS).pipe(
      tap(response => {
        this.storeUserInfo(response);
        this.setCurrentUser(response);
      }),
      catchError(err => this.handleError(err))
    );
  }

  loginWithIam(login: string, password: string, userType: 'staff' | 'student'): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(ApiPaths.auth.ssoLogin, { login, password, userType }, HTTP_WITH_CREDENTIALS).pipe(
      tap(response => {
        this.storeUserInfo(response);
        this.setCurrentUser(response);
      }),
      catchError(err => this.handleError(err))
    );
  }

  refreshToken(): Observable<void> {
    return this.http.post<void>(ApiPaths.auth.refresh, {}, HTTP_WITH_CREDENTIALS).pipe(
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    this.clearUserData();
    this.http.post(ApiPaths.auth.logout, {}, HTTP_WITH_CREDENTIALS).subscribe({
      next: () => { },
      error: (err) => this.logger.warn('Logout request failed', { err })
    });
  }

  isLoggedIn(): boolean {
    return this.getUsername() !== null;
  }

  validateToken(): Observable<boolean> {
    return this.http.get<ValidateTokenResponse>(ApiPaths.auth.validate, HTTP_WITH_CREDENTIALS).pipe(
      map(response => response.valid === true),
      catchError(() => {
        this.clearUserData();
        return throwError(() => new Error('Token validation failed'));
      })
    );
  }

  validateTokenWithRole(): Observable<{ valid: boolean; role: string | null }> {
    return this.http.get<ValidateTokenResponse>(ApiPaths.auth.validate, HTTP_WITH_CREDENTIALS).pipe(
      map(response => ({
        valid: response.valid === true,
        role: response.role || null
      })),
      catchError(() => {
        this.clearUserData();
        return throwError(() => new Error('Token validation failed'));
      })
    );
  }

  getUser(): UserPayload | null {
    return this.currentUserSubject.value;
  }

  getFirstName(): string | null {
    return localStorage.getItem(StorageKeys.user.firstName);
  }

  getLastName(): string | null {
    return localStorage.getItem(StorageKeys.user.lastName);
  }

  getUsername(): string | null {
    return localStorage.getItem(StorageKeys.user.username);
  }

  getRole(): string | null {
    return localStorage.getItem(StorageKeys.user.role);
  }

  private clearUserData(): void {
    localStorage.removeItem(StorageKeys.user.firstName);
    localStorage.removeItem(StorageKeys.user.lastName);
    localStorage.removeItem(StorageKeys.user.username);
    localStorage.removeItem(StorageKeys.user.role);
    this.currentUserSubject.next(null);
  }

  private storeUserInfo(loginResponse: LoginResponse): void {
    if (loginResponse.firstName) localStorage.setItem(StorageKeys.user.firstName, loginResponse.firstName);
    if (loginResponse.lastName) localStorage.setItem(StorageKeys.user.lastName, loginResponse.lastName);
    if (loginResponse.username) localStorage.setItem(StorageKeys.user.username, loginResponse.username);
    if (loginResponse.role) localStorage.setItem(StorageKeys.user.role, loginResponse.role);
  }

  private setCurrentUser(response: LoginResponse): void {
    this.currentUserSubject.next({
      sub: response.username,
      role: response.role,
      exp: 0
    });
  }

  private loadUserInfo(): void {
    const username = this.getUsername();
    const role = this.getRole();
    if (username && role) {
      this.currentUserSubject.next({ sub: username, role, exp: 0 });
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let key: string;

    if (error.status === 0 || error.error instanceof ProgressEvent) {
      key = 'AUTH.ERROR_UNREACHABLE';
    } else if (error.error instanceof ErrorEvent) {
      key = 'AUTH.ERROR_CONNECTION';
    } else {
      switch (error.status) {
        case 400: key = 'AUTH.ERROR_INVALID'; break;
        case 401: key = 'AUTH.ERROR_UNAUTHORIZED'; break;
        case 403: key = 'AUTH.ERROR_FORBIDDEN'; break;
        case 404: key = 'AUTH.ERROR_SERVICE_UNAVAILABLE'; break;
        case 429: key = 'AUTH.ERROR_TOO_MANY'; break;
        case 500:
        case 502:
        case 503: key = 'AUTH.ERROR_SERVER'; break;
        default: key = 'AUTH.ERROR_GENERIC';
      }
    }

    this.logger.error('Auth error', error, { status: error.status });
    return throwError(() => new Error(error.error?.message || key));
  }
}
