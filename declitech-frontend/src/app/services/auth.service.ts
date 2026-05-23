import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthProfile, LoginResponse } from '../models/auth.model';
import { UserRole } from '../models/user.model';
import { ApiPaths } from './api-paths';
import { StorageKeys } from './storage-keys';
import { HTTP_WITH_CREDENTIALS } from './http-options';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly profileSubject = new BehaviorSubject<AuthProfile | null>(this.loadProfile());
  readonly profile$ = this.profileSubject.asObservable();

  login(usernameOrEmail: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(ApiPaths.auth.login, { usernameOrEmail, password }, HTTP_WITH_CREDENTIALS)
      .pipe(tap(res => this.persistFromLogin(res)));
  }

  logout(): void {
    this.http.post(ApiPaths.auth.logout, {}, HTTP_WITH_CREDENTIALS).subscribe({
      error: () => {}
    });
    sessionStorage.removeItem(StorageKeys.auth.token);
    sessionStorage.removeItem(StorageKeys.auth.profile);
    this.profileSubject.next(null);
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem(StorageKeys.auth.token);
  }

  fetchMe(): Observable<AuthProfile> {
    return this.http.get<AuthProfile>(ApiPaths.auth.me, HTTP_WITH_CREDENTIALS).pipe(
      tap(profile => this.persistProfile(profile))
    );
  }

  isLoggedIn(): boolean {
    return this.profileSubject.value !== null;
  }

  getProfile(): AuthProfile | null {
    return this.profileSubject.value;
  }

  getRole(): UserRole | null {
    return this.profileSubject.value?.role ?? null;
  }

  isAdmin(): boolean {
    return this.getRole() === 'ADMIN';
  }

  isInstructor(): boolean {
    return this.getRole() === 'INSTRUCTEUR';
  }

  isFreelancer(): boolean {
    return this.getRole() === 'FREELANCER';
  }

  canTeach(): boolean {
    return this.hasRole('INSTRUCTEUR', 'FREELANCER');
  }

  hasRole(...roles: UserRole[]): boolean {
    const current = this.getRole();
    return current !== null && roles.includes(current);
  }

  getUsername(): string | null {
    return this.profileSubject.value?.username ?? null;
  }

  getFirstName(): string | null {
    return this.profileSubject.value?.firstName ?? null;
  }

  getLastName(): string | null {
    return this.profileSubject.value?.lastName ?? null;
  }

  private persistFromLogin(res: LoginResponse): void {
    if (res.accessToken) {
      sessionStorage.setItem(StorageKeys.auth.token, res.accessToken);
    }
    const profile: AuthProfile = {
      id: 0,
      username: res.username,
      email: '',
      firstName: res.firstName,
      lastName: res.lastName,
      role: res.role
    };
    this.persistProfile(profile);
    this.fetchMe().subscribe({ error: () => {} });
  }

  private persistProfile(profile: AuthProfile): void {
    sessionStorage.setItem(StorageKeys.auth.profile, JSON.stringify(profile));
    this.profileSubject.next(profile);
  }

  private loadProfile(): AuthProfile | null {
    const raw = sessionStorage.getItem(StorageKeys.auth.profile);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthProfile;
    } catch {
      return null;
    }
  }
}
