// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginRequest } from '../models/auth/login-request.model';
import { LoginResponse } from '../models/auth/login-response.model';
import { UserPayload } from '../models/auth/user-payload.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.authApiUrl}/auth`;
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
      withCredentials: true  // Enable sending/receiving cookies
    }).pipe(
      tap(response => {
        // Store only user display info in localStorage
        this.storeUserInfo(response);
        // Set current user from response
        this.setCurrentUser(response);
      }),
      catchError(this.handleError)
    );
  }

  refreshToken(): Observable<any> {
    // Refresh token is sent automatically via httpOnly cookie
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
    // Call backend to clear cookies
    this.http.post(`${this.apiUrl}/logout`, {}, {
      withCredentials: true
    }).subscribe({
      complete: () => {
        this.clearUserData();
      },
      error: () => {
        // Clear data even if backend call fails
        this.clearUserData();
      }
    });
  }

  private clearUserData(): void {
    localStorage.removeItem(this.firstNameKey);
    localStorage.removeItem(this.lastNameKey);
    localStorage.removeItem(this.usernameKey);
    localStorage.removeItem(this.roleKey);
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    // Check if user info exists in localStorage as a quick check
    const username = this.getUsername();
    return username !== null;
  }

  validateToken(): Observable<boolean> {
    // Call backend validate endpoint to check if cookie token is valid
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
      exp: 0  // Not needed since we validate on backend
    };
    this.currentUserSubject.next(user);
  }

  private loadUserInfo(): void {
    // Load user info from localStorage on app startup
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
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
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