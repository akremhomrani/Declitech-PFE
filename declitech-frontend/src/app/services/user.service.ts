import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateUserRequest, PagedUsers, UpdateUserRequest, User } from '../models/user.model';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  list(page = 0, size = 20): Observable<PagedUsers> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedUsers>(ApiPaths.users.root, { ...HTTP_WITH_CREDENTIALS, params });
  }

  me(): Observable<User> {
    return this.http.get<User>(ApiPaths.auth.me, HTTP_WITH_CREDENTIALS);
  }

  getById(id: number): Observable<User> {
    return this.http.get<User>(ApiPaths.users.byId(id), HTTP_WITH_CREDENTIALS);
  }

  create(request: CreateUserRequest): Observable<User> {
    return this.http.post<User>(ApiPaths.users.root, request, HTTP_WITH_CREDENTIALS);
  }

  update(id: number, request: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(ApiPaths.users.byId(id), request, HTTP_WITH_CREDENTIALS);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(ApiPaths.users.byId(id), HTTP_WITH_CREDENTIALS);
  }

  changePassword(id: number, password: string): Observable<void> {
    return this.http.put<void>(ApiPaths.users.password(id), { password }, HTTP_WITH_CREDENTIALS);
  }
}
