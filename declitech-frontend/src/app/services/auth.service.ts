import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginRequest, LoginResponse, UserPayload } from '../models/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/auth`;
  private firstNameKey = 'user_first_name';
  private lastNameKey = 'user_last_name';
  private usernameKey = 'user_username';
  private roleKey = 'user_role';
  private currentUserSubject = new BehaviorSubject<UserPayload | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserInfo();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.storeUserInfo(response);
        this.setCurrentUser(response);
      }),
      catchError(this.handleError)
    );
  }

  refreshToken(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/refresh`, {}, {
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
    sessionStorage.removeItem(this.firstNameKey);
    sessionStorage.removeItem(this.lastNameKey);
    sessionStorage.removeItem(this.usernameKey);
    sessionStorage.removeItem(this.roleKey);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    const username = this.getUsername();
    return username !== null;
  }

  validateToken(): Observable<boolean> {
    return this.http.get<any>(`${this.apiUrl}/validate`, {
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
    return this.http.get<any>(`${this.apiUrl}/validate`, {
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
    return sessionStorage.getItem(this.firstNameKey);
  }

  getLastName(): string | null {
    return sessionStorage.getItem(this.lastNameKey);
  }

  getUsername(): string | null {
    return sessionStorage.getItem(this.usernameKey);
  }

  getRole(): string | null {
    return sessionStorage.getItem(this.roleKey);
  }

  private storeUserInfo(loginResponse: LoginResponse): void {
    if (loginResponse.firstName) {
      sessionStorage.setItem(this.firstNameKey, loginResponse.firstName);
    }
    if (loginResponse.lastName) {
      sessionStorage.setItem(this.lastNameKey, loginResponse.lastName);
    }
    if (loginResponse.username) {
      sessionStorage.setItem(this.usernameKey, loginResponse.username);
    }
    if (loginResponse.role) {
      sessionStorage.setItem(this.roleKey, loginResponse.role);
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
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      errorMessage = error.error.message;
    } else {
      switch (error.status) {
        case 400:
          errorMessage = 'Invalid credentials';
          break;
        case 401:
          errorMessage = 'Unauthorized access';
          break;
        case 403:
          errorMessage = 'Access forbidden';
          break;
        case 404:
          errorMessage = 'Service not found';
          break;
        case 500:
          errorMessage = 'Internal server error';
          break;
        default:
          errorMessage = error.error?.message || `Error: ${error.status}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  }
}