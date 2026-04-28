import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';
import { TrackReport } from '../models/track-report.model';

@Injectable({ providedIn: 'root' })
export class TrackReportService {
  private readonly http = inject(HttpClient);

  getTrackReportsBySessionCode(sessionCode: string): Observable<TrackReport[]> {
    return this.http.get<TrackReport[]>(ApiPaths.reports.trackBySessionCode(sessionCode), HTTP_WITH_CREDENTIALS);
  }
}
