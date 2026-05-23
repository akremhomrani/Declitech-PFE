import { Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { interval, startWith, Subscription, switchMap } from 'rxjs';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../services/logger.service';
import { ModuleService } from '../../services/module.service';
import { Module as AppModule } from '../../models/module.model';
import { SessionHistory } from '../../models/session';
import {
  buildDonutGradient,
  buildModuleStats,
  buildMonthBars,
  buildStatusSlices,
  ModuleStat,
  MonthBar,
  StatusSlice
} from '../../utils/analytics-charts.util';
import { CountUpHandle, countUpFloat, countUpInt } from '../../utils/count-up.util';

type Range = 'week' | 'month' | 'year' | 'all';

const POLL_INTERVAL_MS = 30_000;
const ANIMATE_DELAY_MS = 80;
const COUNT_UP_MS = 1_200;
const RATE_COUNT_UP_MS = 1_000;
const DONUT_ANIM_MS = 1_200;

@Component({
  selector: 'app-instructor-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, SidebarComponent, TranslateModule],
  templateUrl: './instructor-analytics.component.html',
  styleUrls: ['./instructor-analytics.component.css']
})
export class InstructorAnalyticsComponent implements OnInit, OnDestroy {
  private readonly sessionService = inject(SessionService);
  private readonly authService = inject(AuthService);
  private readonly moduleService = inject(ModuleService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly logger = inject(LoggerService);

  isLoading = true;
  instructorUsername = '';
  range: Range = 'all';

  lastUpdated: Date | null = null;
  isRefreshing = false;

  allSessions: SessionHistory[] = [];
  filteredSessions: SessionHistory[] = [];
  modules: AppModule[] = [];

  selectedModuleId: number | null | 'all' = 'all';

  totalSessions = 0;
  totalHours = 0;
  totalStudents = 0;
  totalReports = 0;
  avgParticipants = 0;
  completionRate = 0;

  displayedSessions = 0;
  displayedHours = 0;
  displayedStudents = 0;
  displayedReports = 0;
  displayedRate = 0;

  statusSlices: StatusSlice[] = [];
  monthBars: MonthBar[] = [];
  animatedDonutGradient = 'conic-gradient(#e2e8f0 0deg 360deg)';
  chartsVisible = false;

  moduleStats: ModuleStat[] = [];

  recentSessions: SessionHistory[] = [];
  largestClass: SessionHistory | null = null;

  private pollSub?: Subscription;
  private countUpHandles: CountUpHandle[] = [];
  private rafHandles: number[] = [];
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    this.instructorUsername = this.authService.getUsername() || 'Instructor';
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.cancelAnimations();
  }

  private startPolling(): void {
    const isInstructor = this.authService.isInstructor();
    const filters: { instructorUsername?: string } = {};
    if (isInstructor) filters.instructorUsername = this.instructorUsername;

    this.moduleService.myModules().subscribe({
      next: list => (this.modules = list),
      error: () => (this.modules = [])
    });

    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => {
          this.isRefreshing = !this.isLoading;
          return this.sessionService.filterSessionHistory(filters, 0, 200);
        })
      )
      .subscribe({
        next: (res) => {
          const incoming = res.sessions;
          const changed = this.hasChanged(incoming);

          this.allSessions = incoming;
          this.lastUpdated = new Date();
          this.isRefreshing = false;

          if (this.isLoading) {
            this.isLoading = false;
            this.applyRange(this.range);
          } else if (changed) {
            this.applyRange(this.range);
          }
        },
        error: (err) => {
          this.logger.warn('Failed to fetch analytics sessions', { err });
          this.isLoading = false;
          this.isRefreshing = false;
        }
      });
  }

  private hasChanged(incoming: SessionHistory[]): boolean {
    if (incoming.length !== this.allSessions.length) return true;
    const sig = (s: SessionHistory[]): string =>
      s.map((x) => `${x.id}:${x.status}:${x.participantCount}`).join('|');
    return sig(incoming) !== sig(this.allSessions);
  }

  setRange(r: string): void {
    this.range = r as Range;
    this.applyRange(this.range);
  }

  selectModule(id: number | null | 'all'): void {
    this.selectedModuleId = id;
    this.compute();
    this.scheduleAnimations();
  }

  private applyRange(r: Range): void {
    const now = new Date();
    this.filteredSessions = this.allSessions.filter((s) => {
      const d = new Date(s.createdAt);
      if (r === 'week') {
        const c = new Date(now);
        c.setDate(now.getDate() - 7);
        return d >= c;
      }
      if (r === 'month') {
        const c = new Date(now);
        c.setDate(now.getDate() - 30);
        return d >= c;
      }
      if (r === 'year') {
        const c = new Date(now);
        c.setFullYear(now.getFullYear() - 1);
        return d >= c;
      }
      return true;
    });
    this.selectedModuleId = 'all';
    this.compute();
  }

  private effectiveSessions(): SessionHistory[] {
    if (this.selectedModuleId === 'all') return this.filteredSessions;
    if (this.selectedModuleId === null) return this.filteredSessions.filter((s) => !s.moduleId);
    return this.filteredSessions.filter((s) => s.moduleId === this.selectedModuleId);
  }

  private compute(): void {
    const s = this.effectiveSessions();
    this.totalSessions = s.length;
    this.totalHours = Math.round(s.reduce((a, x) => a + x.durationHours, 0) * 10) / 10;
    this.totalStudents = s.reduce((a, x) => a + x.participantCount, 0);
    this.totalReports = s.reduce((a, x) => a + x.reportCount, 0);
    this.avgParticipants = s.length ? Math.round(this.totalStudents / s.length) : 0;
    const ended = s.filter((x) => x.status === 'ENDED' || x.status === 'EXPIRED').length;
    this.completionRate = s.length ? Math.round((ended / s.length) * 100) : 0;

    this.statusSlices = buildStatusSlices(s);
    this.monthBars = buildMonthBars(s);
    this.moduleStats = buildModuleStats(this.filteredSessions, this.modules);
    this.animatedDonutGradient = 'conic-gradient(#e2e8f0 0deg 360deg)';

    this.recentSessions = [...s]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    this.largestClass = s.length
      ? s.reduce((b, x) => (x.participantCount > b.participantCount ? x : b), s[0])
      : null;

    this.scheduleAnimations();
  }

  private scheduleAnimations(): void {
    this.cancelAnimations();

    this.displayedSessions = 0;
    this.displayedHours = 0;
    this.displayedStudents = 0;
    this.displayedReports = 0;
    this.displayedRate = 0;
    this.chartsVisible = false;

    const t = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.countUpHandles.push(
          countUpInt(0, this.totalSessions, COUNT_UP_MS, (v) =>
            this.zone.run(() => (this.displayedSessions = v))
          ),
          countUpInt(0, this.totalStudents, COUNT_UP_MS, (v) =>
            this.zone.run(() => (this.displayedStudents = v))
          ),
          countUpInt(0, this.totalReports, COUNT_UP_MS, (v) =>
            this.zone.run(() => (this.displayedReports = v))
          ),
          countUpInt(0, this.completionRate, RATE_COUNT_UP_MS, (v) =>
            this.zone.run(() => (this.displayedRate = v))
          ),
          countUpFloat(0, this.totalHours, COUNT_UP_MS, (v) =>
            this.zone.run(() => (this.displayedHours = v))
          )
        );
        this.animateDonut(DONUT_ANIM_MS);
      });

      this.zone.run(() => {
        this.monthBars = this.monthBars.map((b) => ({ ...b, animatedPct: b.heightPct }));
        this.moduleStats = this.moduleStats.map((m) => ({
          ...m,
          animatedWidth: Math.round((m.count / (this.moduleStats[0]?.count || 1)) * 100)
        }));
        this.chartsVisible = true;
      });
    }, ANIMATE_DELAY_MS);

    this.timeouts.push(t);
  }

  private animateDonut(durationMs: number): void {
    const start = performance.now();
    const tick = (now: number): void => {
      const p = Math.min((now - start) / durationMs, 1);
      const ease = 1 - Math.pow(1 - p, 2.5);
      const revealed = ease * 360;
      const gradient = buildDonutGradient(this.statusSlices, revealed);
      this.zone.run(() => (this.animatedDonutGradient = gradient));
      if (p < 1) this.rafHandles.push(requestAnimationFrame(tick));
    };
    this.rafHandles.push(requestAnimationFrame(tick));
  }

  private cancelAnimations(): void {
    this.countUpHandles.forEach((h) => h.cancel());
    this.countUpHandles = [];
    this.rafHandles.forEach((h) => cancelAnimationFrame(h));
    this.rafHandles = [];
    this.timeouts.forEach((t) => clearTimeout(t));
    this.timeouts = [];
  }

  fmtDuration(h: number): string {
    if (h < 1) return `${Math.round(h * 60)} min`;
    return `${h.toFixed(1)} hr`;
  }

  fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700';
      case 'ENDED':
        return 'bg-primary/10 text-primary';
      case 'CANCELLED':
        return 'bg-amber-100 text-amber-700';
      case 'EXPIRED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'radio_button_checked';
      case 'ENDED':
        return 'check_circle';
      case 'CANCELLED':
        return 'cancel';
      case 'EXPIRED':
        return 'timer_off';
      default:
        return 'help';
    }
  }

  isModuleSelected(id: number | null | 'all'): boolean {
    return this.selectedModuleId === id;
  }

  chipClass(id: number | null | 'all'): string {
    const base =
      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all';
    if (this.isModuleSelected(id)) {
      return `${base} bg-primary text-white border-primary shadow-sm`;
    }
    return `${base} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/40 hover:text-primary`;
  }

  viewSession(id: number): void {
    this.router.navigate(['/session/details', id]);
  }

  get initials(): string {
    const parts = this.instructorUsername.split(/[._\-\s]+/).filter((p) => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return this.instructorUsername.slice(0, 2).toUpperCase();
  }

  get animatedDonutStyle(): string {
    return `background: ${this.animatedDonutGradient}`;
  }
}
