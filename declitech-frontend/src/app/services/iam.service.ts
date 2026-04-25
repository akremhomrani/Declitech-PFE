import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { IamSite } from '../models/iam/iam-site.model';

@Injectable({ providedIn: 'root' })
export class IamService {
  private readonly apiUrl = `${environment.apiUrl}/api/iam`;

  constructor(private http: HttpClient) {}

  getSites(): Observable<IamSite[]> {
    return this.http.get<IamSite[]>(`${this.apiUrl}/sites`, { withCredentials: true });
  }
}
