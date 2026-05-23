import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateModuleRequest, Module, PagedModules, UpdateModuleRequest } from '../models/module.model';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private readonly http = inject(HttpClient);

  list(): Observable<Module[]> {
    return this.http.get<Module[]>(ApiPaths.modules.root, HTTP_WITH_CREDENTIALS);
  }

  listPaged(page = 0, size = 10): Observable<PagedModules> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PagedModules>(ApiPaths.modules.paged, { ...HTTP_WITH_CREDENTIALS, params });
  }

  myModules(): Observable<Module[]> {
    return this.http.get<Module[]>(ApiPaths.modules.me, HTTP_WITH_CREDENTIALS);
  }

  getById(id: number): Observable<Module> {
    return this.http.get<Module>(ApiPaths.modules.byId(id), HTTP_WITH_CREDENTIALS);
  }

  create(request: CreateModuleRequest): Observable<Module> {
    return this.http.post<Module>(ApiPaths.modules.root, request, HTTP_WITH_CREDENTIALS);
  }

  update(id: number, request: UpdateModuleRequest): Observable<Module> {
    return this.http.put<Module>(ApiPaths.modules.byId(id), request, HTTP_WITH_CREDENTIALS);
  }

  archive(id: number): Observable<void> {
    return this.http.delete<void>(ApiPaths.modules.byId(id), HTTP_WITH_CREDENTIALS);
  }
}
