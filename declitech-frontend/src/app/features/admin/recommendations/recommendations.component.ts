import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { ToastsComponent } from '../../../shared/toasts/toasts.component';
import { ToastService } from '../../../shared/toasts/toast.service';
import { RecommendationService } from '../../../services/recommendation.service';
import {
  InstructorRecommendation,
  ModuleRecommendations,
  ModuleSummary,
  RecommendationOverview
} from '../../../models/recommendation.model';

type ModuleFilter = 'all' | 'unassigned' | 'strong';

@Component({
  selector: 'app-admin-recommendations',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NavbarComponent, SidebarComponent, ToastsComponent],
  templateUrl: './recommendations.component.html',
  styleUrls: ['./recommendations.component.css']
})
export class AdminRecommendationsComponent implements OnInit {
  private readonly recommendationService = inject(RecommendationService);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);

  readonly Math = Math;

  overview: RecommendationOverview | null = null;
  isLoading = false;
  error = '';
  recomputing = false;

  filter: ModuleFilter = 'all';
  searchTerm = '';

  expandedModuleId: number | null = null;
  private detailsCache = new Map<number, ModuleRecommendations>();
  loadingDetailsId: number | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading = true;
    this.error = '';
    this.recommendationService.getOverview().subscribe({
      next: data => {
        this.overview = data;
        this.isLoading = false;
      },
      error: () => {
        this.error = this.t.instant('ADMIN.RECOMMENDATIONS.ERROR_LOAD');
        this.isLoading = false;
      }
    });
  }

  recompute(): void {
    this.recomputing = true;
    this.recommendationService.recompute().subscribe({
      next: res => {
        this.recomputing = false;
        this.detailsCache.clear();
        this.expandedModuleId = null;
        this.toast.success(this.t.instant('ADMIN.RECOMMENDATIONS.RECOMPUTED_OK', { count: res.scores }));
        this.load();
      },
      error: () => {
        this.recomputing = false;
        this.toast.error(this.t.instant('ADMIN.RECOMMENDATIONS.ERROR_RECOMPUTE'));
      }
    });
  }

  get filteredModules(): ModuleSummary[] {
    const modules = this.overview?.modules ?? [];
    const q = this.searchTerm.trim().toLowerCase();
    return modules.filter(m => {
      if (this.filter === 'unassigned' && !m.unassigned) return false;
      if (this.filter === 'strong' && m.topScore < 0.78) return false;
      if (q && !m.moduleTitle.toLowerCase().includes(q) && !(m.siteName ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }

  toggle(module: ModuleSummary): void {
    if (this.expandedModuleId === module.moduleId) {
      this.expandedModuleId = null;
      return;
    }
    this.expandedModuleId = module.moduleId;
    if (!this.detailsCache.has(module.moduleId)) {
      this.loadingDetailsId = module.moduleId;
      this.recommendationService.getForModule(module.moduleId).subscribe({
        next: data => {
          this.detailsCache.set(module.moduleId, data);
          this.loadingDetailsId = null;
        },
        error: () => {
          this.loadingDetailsId = null;
          this.toast.error(this.t.instant('ADMIN.RECOMMENDATIONS.ERROR_LOAD'));
        }
      });
    }
  }

  details(moduleId: number): ModuleRecommendations | undefined {
    return this.detailsCache.get(moduleId);
  }

  pct(value: number): number {
    return Math.round(value * 100);
  }

  confidenceDots(confidence: number): number[] {
    const on = Math.max(0, Math.min(5, Math.round(confidence * 5)));
    return [0, 1, 2, 3, 4].map(i => (i < on ? 1 : 0));
  }

  scoreClass(score: number): string {
    if (score >= 0.78) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 0.6) return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-500 dark:text-slate-400';
  }

  trackByModuleId(_index: number, module: ModuleSummary): number {
    return module.moduleId;
  }

  trackByUsername(_index: number, rec: InstructorRecommendation): string {
    return rec.instructorUsername;
  }
}
