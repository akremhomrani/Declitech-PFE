import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { interval, Subscription, switchMap, startWith } from 'rxjs';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { IamService } from '../../services/iam.service';
import { IamModule } from '../../models/iam/iam-site.model';
import { SessionHistory } from '../../models/session';

export interface MonthBar {
  label: string;
  count: number;
  heightPct: number;
  animatedPct: number;
  delay: number;
}

export interface StatusSlice {
  label: string;
  count: number;
  pct: number;
  color: string;
  bg: string;
  text: string;
}

export interface ModuleStat {
  id: number | null;
  name: string;
  count: number;
  animatedWidth: number;
}

type Range = 'week' | 'month' | 'year' | 'all';

@Component({
  selector: 'app-instructor-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, SidebarComponent],
  templateUrl: './instructor-analytics.component.html',
  styleUrls: ['./instructor-analytics.component.css']
})
export class InstructorAnalyticsComponent implements OnInit, OnDestroy {

  isLoading = true;
  instructorUsername = '';
  range: Range = 'all';

  // ── Live refresh ───────────────────────────────────────
  lastUpdated: Date | null = null;
  isRefreshing = false;
  private pollSub?: Subscription;
  private readonly POLL_INTERVAL_MS = 30_000;

  allSessions: SessionHistory[] = [];
  filteredSessions: SessionHistory[] = [];
  modules: IamModule[] = [];

  // ── Active module filter ───────────────────────────────
  selectedModuleId: number | null | 'all' = 'all';

  // ── Raw computed values ────────────────────────────────
  totalSessions   = 0;
  totalHours      = 0;
  totalStudents   = 0;
  totalReports    = 0;
  avgParticipants = 0;
  completionRate  = 0;

  // ── Animated display values (count-up) ────────────────
  displayedSessions = 0;
  displayedHours    = 0;
  displayedStudents = 0;
  displayedReports  = 0;
  displayedRate     = 0;

  // ── Charts ────────────────────────────────────────────
  statusSlices: StatusSlice[] = [];
  monthBars: MonthBar[] = [];
  animatedDonutGradient = 'conic-gradient(#e2e8f0 0deg 360deg)';
  chartsVisible = false;

  // ── Module stats ──────────────────────────────────────
  moduleStats: ModuleStat[] = [];

  // ── Lists ─────────────────────────────────────────────
  recentSessions: SessionHistory[] = [];
  largestClass: SessionHistory | null = null;

  private rafHandles: number[] = [];
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
    private iamService: IamService,
    private router: Router,
    private zone: NgZone
  ) {}

  ngOnInit(): void {
    this.instructorUsername = this.authService.getUsername() || 'Instructor';
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.rafHandles.forEach(h => cancelAnimationFrame(h));
    this.timeouts.forEach(t => clearTimeout(t));
  }

  // ── Polling ────────────────────────────────────────────

  private startPolling(): void {
    const isInstructor = this.authService.getRole() === 'INSTRUCTOR';
    const filters: { instructorUsername?: string } = {};
    if (isInstructor) filters.instructorUsername = this.instructorUsername;

    // Load modules from IAM once (they rarely change) then poll sessions
    this.iamService.getSites().subscribe({
      next: (sites) => {
        this.modules = sites.flatMap(s => s.salles.flatMap(sa => sa.modules));

        this.pollSub = interval(this.POLL_INTERVAL_MS).pipe(
          startWith(0),                      // fire immediately on subscribe
          switchMap(() => {                  // cancel in-flight if new tick arrives
            this.isRefreshing = !this.isLoading;
            return this.sessionService.filterSessionHistory(filters, 0, 200);
          })
        ).subscribe({
          next: (res) => {
            const incoming = res.sessions;
            const changed  = this.hasChanged(incoming);

            this.allSessions  = incoming;
            this.lastUpdated  = new Date();
            this.isRefreshing = false;

            if (this.isLoading) {
              // First load — full render with animations
              this.isLoading = false;
              this.applyRange(this.range);
            } else if (changed) {
              // Subsequent poll — only update if data actually changed
              this.applyRange(this.range);
            }
          },
          error: () => {
            this.isLoading    = false;
            this.isRefreshing = false;
          }
        });
      },
      error: () => { this.modules = []; this.isLoading = false; }
    });
  }

  /** Fingerprint comparison — avoids re-render on identical polls */
  private hasChanged(incoming: SessionHistory[]): boolean {
    if (incoming.length !== this.allSessions.length) return true;
    const sig = (s: SessionHistory[]) =>
      s.map(x => `${x.id}:${x.status}:${x.participantCount}`).join('|');
    return sig(incoming) !== sig(this.allSessions);
  }

  // ── Range & module filters ─────────────────────────────

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
    this.filteredSessions = this.allSessions.filter(s => {
      const d = new Date(s.createdAt);
      if (r === 'week')  { const c = new Date(now); c.setDate(now.getDate() - 7);         return d >= c; }
      if (r === 'month') { const c = new Date(now); c.setDate(now.getDate() - 30);        return d >= c; }
      if (r === 'year')  { const c = new Date(now); c.setFullYear(now.getFullYear() - 1); return d >= c; }
      return true;
    });
    this.selectedModuleId = 'all';
    this.compute();
  }

  private effectiveSessions(): SessionHistory[] {
    if (this.selectedModuleId === 'all') return this.filteredSessions;
    if (this.selectedModuleId === null)  return this.filteredSessions.filter(s => !s.moduleId);
    return this.filteredSessions.filter(s => s.moduleId === this.selectedModuleId);
  }

  private compute(): void {
    const s = this.effectiveSessions();
    this.totalSessions   = s.length;
    this.totalHours      = Math.round(s.reduce((a, x) => a + x.durationHours, 0) * 10) / 10;
    this.totalStudents   = s.reduce((a, x) => a + x.participantCount, 0);
    this.totalReports    = s.reduce((a, x) => a + x.reportCount, 0);
    this.avgParticipants = s.length ? Math.round(this.totalStudents / s.length) : 0;
    const ended = s.filter(x => x.status === 'ENDED' || x.status === 'EXPIRED').length;
    this.completionRate  = s.length ? Math.round((ended / s.length) * 100) : 0;

    this.buildStatusChart();
    this.buildMonthChart();
    this.buildModuleStats();

    this.recentSessions = [...s]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    this.largestClass = s.length
      ? s.reduce((b, x) => x.participantCount > b.participantCount ? x : b, s[0])
      : null;

    this.scheduleAnimations();
  }

  // ── Chart builders ────────────────────────────────────

  private buildStatusChart(): void {
    const s     = this.effectiveSessions();
    const total = s.length || 1;
    const counts = {
      ACTIVE:    s.filter(x => x.status === 'ACTIVE').length,
      ENDED:     s.filter(x => x.status === 'ENDED').length,
      CANCELLED: s.filter(x => x.status === 'CANCELLED').length,
      EXPIRED:   s.filter(x => x.status === 'EXPIRED').length,
    };
    const raw: StatusSlice[] = [
      { label: 'Active',    count: counts.ACTIVE,    pct: 0, color: '#10b981', bg: 'bg-emerald-100', text: 'text-emerald-700' },
      { label: 'Ended',     count: counts.ENDED,     pct: 0, color: '#0097B2', bg: 'bg-primary/10',  text: 'text-primary' },
      { label: 'Cancelled', count: counts.CANCELLED, pct: 0, color: '#f59e0b', bg: 'bg-amber-100',   text: 'text-amber-700' },
      { label: 'Expired',   count: counts.EXPIRED,   pct: 0, color: '#ef4444', bg: 'bg-red-100',     text: 'text-red-700' },
    ];
    raw.forEach(r => r.pct = Math.round((r.count / total) * 100));
    this.statusSlices = raw;
    this.animatedDonutGradient = 'conic-gradient(#e2e8f0 0deg 360deg)';
  }

  private buildMonthChart(): void {
    const map    = new Map<string, number>();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    this.effectiveSessions().forEach(s => {
      const d   = new Date(s.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    const now = new Date();
    const bars: MonthBar[] = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
      bars.push({ label: months[d.getMonth()], count: map.get(key) || 0, heightPct: 0, animatedPct: 0, delay: (5 - i) * 80 });
    }
    const max = Math.max(...bars.map(b => b.count), 1);
    bars.forEach(b => b.heightPct = Math.round((b.count / max) * 100));
    this.monthBars = bars;
  }

  private buildModuleStats(): void {
    const base = this.filteredSessions;
    const map  = new Map<number | null, number>();
    base.forEach(s => {
      const key = s.moduleId ?? null;
      map.set(key, (map.get(key) || 0) + 1);
    });

    const stats: ModuleStat[] = [];
    map.forEach((count, id) => {
      const mod  = id !== null ? this.modules.find(m => m.id === id) : null;
      const name = mod ? mod.name : (id !== null ? `Module #${id}` : 'No Module');
      stats.push({ id, name, count, animatedWidth: 0 });
    });

    stats.sort((a, b) => b.count - a.count);
    this.moduleStats = stats.slice(0, 6);
  }

  // ── Animation orchestrator ────────────────────────────

  private scheduleAnimations(): void {
    this.rafHandles.forEach(h => cancelAnimationFrame(h));
    this.timeouts.forEach(t => clearTimeout(t));
    this.rafHandles = [];
    this.timeouts   = [];

    this.displayedSessions = 0;
    this.displayedHours    = 0;
    this.displayedStudents = 0;
    this.displayedReports  = 0;
    this.displayedRate     = 0;
    this.chartsVisible     = false;

    const t = setTimeout(() => {
      this.zone.runOutsideAngular(() => {
        this.countUp(0, this.totalSessions,  1200, v => this.zone.run(() => this.displayedSessions = v));
        this.countUp(0, this.totalStudents,  1200, v => this.zone.run(() => this.displayedStudents = v));
        this.countUp(0, this.totalReports,   1200, v => this.zone.run(() => this.displayedReports  = v));
        this.countUp(0, this.completionRate, 1000, v => this.zone.run(() => this.displayedRate     = v));
        this.countUpFloat(0, this.totalHours, 1200, v => this.zone.run(() => this.displayedHours  = v));
        this.animateDonut(1200);
      });

      this.zone.run(() => {
        this.monthBars   = this.monthBars.map(b => ({ ...b, animatedPct: b.heightPct }));
        this.moduleStats = this.moduleStats.map(m => ({ ...m, animatedWidth: Math.round((m.count / (this.moduleStats[0]?.count || 1)) * 100) }));
        this.chartsVisible = true;
      });
    }, 80);

    this.timeouts.push(t);
  }

  private countUp(from: number, to: number, duration: number, onUpdate: (v: number) => void): void {
    const start = performance.now();
    const tick  = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      onUpdate(Math.round(from + (to - from) * ease));
      if (p < 1) { const h = requestAnimationFrame(tick); this.rafHandles.push(h); }
    };
    this.rafHandles.push(requestAnimationFrame(tick));
  }

  private countUpFloat(from: number, to: number, duration: number, onUpdate: (v: number) => void): void {
    const start = performance.now();
    const tick  = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      onUpdate(Math.round((from + (to - from) * ease) * 10) / 10);
      if (p < 1) { const h = requestAnimationFrame(tick); this.rafHandles.push(h); }
    };
    this.rafHandles.push(requestAnimationFrame(tick));
  }

  private animateDonut(duration: number): void {
    const slices  = this.statusSlices.filter(s => s.count > 0);
    if (!slices.length) return;
    const targets = slices.map(s => (s.pct / 100) * 360);
    const start   = performance.now();
    const tick    = (now: number) => {
      const p        = Math.min((now - start) / duration, 1);
      const ease     = 1 - Math.pow(1 - p, 2.5);
      const revealed = ease * 360;
      let deg = 0;
      const stops: string[] = [];
      for (let i = 0; i < slices.length; i++) {
        const sliceEnd = deg + targets[i];
        if (deg >= revealed) break;
        const visibleEnd = Math.min(sliceEnd, revealed);
        stops.push(`${slices[i].color} ${deg.toFixed(1)}deg ${visibleEnd.toFixed(1)}deg`);
        deg = sliceEnd;
      }
      if (revealed < 360) stops.push(`#e2e8f0 ${revealed.toFixed(1)}deg 360deg`);
      this.zone.run(() => this.animatedDonutGradient = `conic-gradient(${stops.join(', ')})`);
      if (p < 1) { const h = requestAnimationFrame(tick); this.rafHandles.push(h); }
    };
    this.rafHandles.push(requestAnimationFrame(tick));
  }

  // ── Helpers ───────────────────────────────────────────

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
      case 'ACTIVE':    return 'bg-emerald-100 text-emerald-700';
      case 'ENDED':     return 'bg-primary/10 text-primary';
      case 'CANCELLED': return 'bg-amber-100 text-amber-700';
      case 'EXPIRED':   return 'bg-red-100 text-red-700';
      default:          return 'bg-slate-100 text-slate-600';
    }
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'ACTIVE':    return 'radio_button_checked';
      case 'ENDED':     return 'check_circle';
      case 'CANCELLED': return 'cancel';
      case 'EXPIRED':   return 'timer_off';
      default:          return 'help';
    }
  }

  isModuleSelected(id: number | null | 'all'): boolean {
    return this.selectedModuleId === id;
  }

  chipClass(id: number | null | 'all'): string {
    const base = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all';
    if (this.isModuleSelected(id)) {
      return `${base} bg-primary text-white border-primary shadow-sm`;
    }
    return `${base} bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary/40 hover:text-primary`;
  }

  viewSession(id: number): void {
    this.router.navigate(['/session/details', id]);
  }

  get initials(): string {
    const parts = this.instructorUsername.split(/[._\-\s]+/).filter(p => p.length > 0);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return this.instructorUsername.slice(0, 2).toUpperCase();
  }

  get animatedDonutStyle(): string {
    return `background: ${this.animatedDonutGradient}`;
  }
}
