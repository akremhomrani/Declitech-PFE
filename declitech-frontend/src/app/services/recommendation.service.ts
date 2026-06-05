import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ModuleRecommendations, RecommendationOverview } from '../models/recommendation.model';
import { ApiPaths } from './api-paths';
import { HTTP_WITH_CREDENTIALS } from './http-options';

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly http = inject(HttpClient);

  getOverview(): Observable<RecommendationOverview> {
    return this.http.get<RecommendationOverview>(ApiPaths.recommendations.overview, HTTP_WITH_CREDENTIALS);
  }

  getForModule(moduleId: number): Observable<ModuleRecommendations> {
    return this.http.get<ModuleRecommendations>(ApiPaths.recommendations.byModule(moduleId), HTTP_WITH_CREDENTIALS);
  }

  recompute(): Observable<{ status: string; scores: number }> {
    return this.http.post<{ status: string; scores: number }>(
      ApiPaths.recommendations.recompute, {}, HTTP_WITH_CREDENTIALS);
  }
}
