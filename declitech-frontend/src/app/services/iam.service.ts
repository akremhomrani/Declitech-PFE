import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';
import { IamSite } from '../models/iam/iam-site.model';

@Injectable({ providedIn: 'root' })
export class IamService {
  private readonly http = inject(HttpClient);

  getSites(): Observable<IamSite[]> {
    return this.http.get<IamSite[]>(ApiPaths.iam.sites, HTTP_WITH_CREDENTIALS);
  }
}
