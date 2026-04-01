import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TrackReport } from '../models/track-report.model';

@Injectable({
  providedIn: 'root'
})
export class TrackReportService {
  private apiUrl = `${environment.apiUrl}/api/reports/track`;

  constructor(private http: HttpClient) {}

  getTrackReportsBySessionCode(sessionCode: string): Observable<TrackReport[]> {
    return this.http.get<TrackReport[]>(`${this.apiUrl}/session/${sessionCode}`);
  }
}
