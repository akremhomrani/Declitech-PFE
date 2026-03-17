import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User, PagedUserResponse, CreateUserRequest, UpdateUserRequest } from '../models/user';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/api/users/paginated`;
  private readonly authOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  getAllUsers(page: number = 0, size: number = 10): Observable<PagedUserResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    return this.http.get<PagedUserResponse>(this.apiUrl, { params, ...this.authOptions });
  }

  getUserById(id: number): Observable<User> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.get<User>(`${baseUrl}/${id}`, this.authOptions);
  }

  getUserByUsername(username: string): Observable<User> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.get<User>(`${baseUrl}/username/${username}`, this.authOptions);
  }

  createUser(user: CreateUserRequest): Observable<User> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.post<User>(baseUrl, user, this.authOptions);
  }

  updateUser(id: number, user: UpdateUserRequest): Observable<User> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.put<User>(`${baseUrl}/${id}`, user, this.authOptions);
  }

  deleteUser(id: number): Observable<void> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.delete<void>(`${baseUrl}/${id}`, this.authOptions);
  }

  blockUser(id: number): Observable<void> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.delete<void>(`${baseUrl}/${id}`, this.authOptions);
  }

  unblockUser(id: number): Observable<User> {
    const baseUrl = `${environment.apiUrl}/api/users`;
    return this.http.patch<User>(`${baseUrl}/${id}/reactivate`, {}, this.authOptions);
  }

  filterUsers(filters: any, page: number = 0, size: number = 10): Observable<PagedUserResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters.firstName) params = params.set('firstName', filters.firstName);
    if (filters.lastName) params = params.set('lastName', filters.lastName);
    if (filters.username) params = params.set('username', filters.username);
    if (filters.email) params = params.set('email', filters.email);
    if (filters.role) params = params.set('role', filters.role);
    if (filters.active !== null && filters.active !== undefined) {
      params = params.set('active', filters.active.toString());
    }

    return this.http.get<PagedUserResponse>(this.apiUrl, { params, ...this.authOptions });
  }
}
