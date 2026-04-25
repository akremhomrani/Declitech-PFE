import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginResponse, UserPayload } from '../models/auth';

interface ValidateTokenResponse {
  valid: boolean;
  role?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private firstNameKey = 'user_first_name';
  private lastNameKey = 'user_last_name';
  private usernameKey = 'user_username';
  private roleKey = 'user_role';
  private readonly POPUP_POLL_INTERVAL_MS = 500;
  private currentUserSubject = new BehaviorSubject<UserPayload | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserInfo();
  }

  initiateSsoLogin(userType: 'student' | 'staff'): Observable<LoginResponse> {
    return new Observable(observer => {
      this.http.get<{ loginUrl: string }>(`${this.apiUrl}/sso/url`, {
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
            observer.error(new Error('Le popup a été bloqué par le navigateur. Autorisez les popups pour ce site.'));
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
              observer.error(new Error(event.data.error || 'Erreur SSO'));
            }
          };

          const pollClosed = setInterval(() => {
            if (popup.closed) { cleanup(); observer.error(new Error('Connexion annulée')); }
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
    return this.http.post<LoginResponse>(`${this.apiUrl}/sso/callback`, { code, state }, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.storeUserInfo(response);
        this.setCurrentUser(response);
      }),
      catchError(this.handleError)
    );
  }

  loginWithIam(login: string, password: string, userType: 'staff' | 'student'): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/sso/login`, { login, password, userType }, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.storeUserInfo(response);
        this.setCurrentUser(response);
      }),
      catchError(this.handleError)
    );
  }

  refreshToken(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/refresh`, {}, {
      withCredentials: true
    }).pipe(
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    this.clearUserData();
    this.http.post(`${this.apiUrl}/logout`, {}, {
      withCredentials: true
    }).subscribe();
  }

  private clearUserData(): void {
    localStorage.removeItem(this.firstNameKey);
    localStorage.removeItem(this.lastNameKey);
    localStorage.removeItem(this.usernameKey);
    localStorage.removeItem(this.roleKey);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    const username = this.getUsername();
    return username !== null;
  }

  validateToken(): Observable<boolean> {
    return this.http.get<ValidateTokenResponse>(`${this.apiUrl}/validate`, {
      withCredentials: true
    }).pipe(
      map(response => response.valid === true),
      catchError(() => {
        this.clearUserData();
        return throwError(() => new Error('Token validation failed'));
      })
    );
  }

  validateTokenWithRole(): Observable<{ valid: boolean; role: string | null }> {
    return this.http.get<ValidateTokenResponse>(`${this.apiUrl}/validate`, {
      withCredentials: true
    }).pipe(
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
    return localStorage.getItem(this.firstNameKey);
  }

  getLastName(): string | null {
    return localStorage.getItem(this.lastNameKey);
  }

  getUsername(): string | null {
    return localStorage.getItem(this.usernameKey);
  }

  getRole(): string | null {
    return localStorage.getItem(this.roleKey);
  }

  private storeUserInfo(loginResponse: LoginResponse): void {
    if (loginResponse.firstName) {
      localStorage.setItem(this.firstNameKey, loginResponse.firstName);
    }
    if (loginResponse.lastName) {
      localStorage.setItem(this.lastNameKey, loginResponse.lastName);
    }
    if (loginResponse.username) {
      localStorage.setItem(this.usernameKey, loginResponse.username);
    }
    if (loginResponse.role) {
      localStorage.setItem(this.roleKey, loginResponse.role);
    }
  }

  private setCurrentUser(response: LoginResponse): void {
    const user: UserPayload = {
      sub: response.username,
      role: response.role,
      exp: 0
    };
    this.currentUserSubject.next(user);
  }

  private loadUserInfo(): void {
    const username = this.getUsername();
    const role = this.getRole();
    if (username && role) {
      const user: UserPayload = {
        sub: username,
        role: role,
        exp: 0
      };
      this.currentUserSubject.next(user);
    }
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage: string;

    if (error.status === 0 || error.error instanceof ProgressEvent) {
      errorMessage = 'Unable to reach the authentication server. Please try again later.';
    } else if (error.error instanceof ErrorEvent) {
      errorMessage = 'A connection error occurred. Please check your network.';
    } else {
      switch (error.status) {
        case 400: errorMessage = 'Invalid credentials.'; break;
        case 401: errorMessage = 'Unauthorized. Please sign in again.'; break;
        case 403: errorMessage = 'Access denied. Contact your administrator.'; break;
        case 404: errorMessage = 'Authentication service unavailable.'; break;
        case 429: errorMessage = 'Too many attempts. Please wait and try again.'; break;
        case 500:
        case 502:
        case 503: errorMessage = 'Server error. Please try again later.'; break;
        default: errorMessage = error.error?.message || 'Authentication failed. Please try again.';
      }
    }

    return throwError(() => new Error(errorMessage));
  }
}