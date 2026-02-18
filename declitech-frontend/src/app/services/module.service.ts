import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Module, CreateModuleRequest, UpdateModuleRequest, PagedModuleResponse, ModuleFilterRequest, SessionInfo } from '../models/module';

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  private apiUrl = `${environment.apiUrl}/api/modules`;
  private readonly authOptions = { withCredentials: true };

  constructor(private http: HttpClient) {}

  getAllModules(): Observable<Module[]> {
    return this.http.get<Module[]>(this.apiUrl, this.authOptions);
  }

  getModuleById(id: number): Observable<Module> {
    return this.http.get<Module>(`${this.apiUrl}/${id}`, this.authOptions);
  }

  getModulesPaginated(
    filter: ModuleFilterRequest = {},
    page: number = 0,
    size: number = 10,
    sortBy: string = 'createdAt',
    sortDirection: string = 'DESC'
  ): Observable<PagedModuleResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sortBy', sortBy)
      .set('sortDirection', sortDirection);

    if (filter.title) {
      params = params.set('title', filter.title);
    }
    if (filter.description) {
      params = params.set('description', filter.description);
    }
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    if (filter.site) {
      params = params.set('site', filter.site);
    }
    if (filter.search) {
      params = params.set('search', filter.search);
    }
    if (filter.createdBy) {
      params = params.set('createdBy', filter.createdBy.toString());
    }
    if (filter.createdByUsername) {
      params = params.set('createdByUsername', filter.createdByUsername);
    }

    return this.http.get<PagedModuleResponse>(`${this.apiUrl}/paginated`, {
      ...this.authOptions,
      params
    });
  }

  createModule(module: CreateModuleRequest): Observable<Module> {
    return this.http.post<Module>(this.apiUrl, module, this.authOptions);
  }

  updateModule(id: number, module: UpdateModuleRequest): Observable<Module> {
    return this.http.put<Module>(`${this.apiUrl}/${id}`, module, this.authOptions);
  }

  deleteModule(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, this.authOptions);
  }

  getModuleSessions(moduleId: number): Observable<SessionInfo[]> {
    return this.http.get<SessionInfo[]>(`${this.apiUrl}/${moduleId}/sessions`, this.authOptions);
  }
}
