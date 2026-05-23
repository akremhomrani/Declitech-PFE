import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { NavbarComponent } from '../../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { UserService } from '../../../services/user.service';
import { ModuleService } from '../../../services/module.service';
import { SessionService } from '../../../services/session.service';
import { User, UserRole } from '../../../models/user.model';
import { Module } from '../../../models/module.model';
import { SessionHistory } from '../../../models/session';

interface InstructorPerf {
  username: string;
  role: UserRole | 'UNKNOWN';
  total: number;
  active: number;
  reports: number;
}

interface ModulePerf {
  moduleId: number | null;
  title: string;
  total: number;
  active: number;
  sites: string[];
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percent: number;
  offset: number;
  dash: number;
}

export interface DayBar {
  label: string;
  count: number;
  heightPct: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, NavbarComponent, SidebarComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly moduleService = inject(ModuleService);
  private readonly sessionService = inject(SessionService);
  private readonly t = inject(TranslateService);

  isLoading = false;
  error = '';

  totalUsers = 0;
  totalModules = 0;
  totalSessions = 0;
  activeSessionsCount = 0;
  totalReports = 0;

  roleCounts: Record<UserRole, number> = { ADMIN: 0, INSTRUCTEUR: 0, FREELANCER: 0 };

  topModules: ModulePerf[] = [];
  topInstructors: InstructorPerf[] = [];
  topFreelancers: InstructorPerf[] = [];
  liveActiveSessions: SessionHistory[] = [];

  private userRoleByName = new Map<string, UserRole>();

  donutSegments: DonutSegment[] = [];
  readonly donutRadius = 56;
  readonly donutCircumference = 2 * Math.PI * 56;

  dayBars: DayBar[] = [];
  maxDayCount = 0;

  topModuleMax = 0;
  topInstructorMax = 0;
  topFreelancerMax = 0;

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.isLoading = true;
    this.error = '';

    forkJoin({
      users: this.userService.list(0, 1000),
      modules: this.moduleService.list(),
      active: this.sessionService.getAllActiveSessions(),
      history: this.sessionService.getSessionHistory(0, 1000)
    }).subscribe({
      next: ({ users, modules, active, history }) => {
        this.userRoleByName = new Map(users.content.map(u => [u.username, u.role]));
        this.computeUserStats(users.content, users.totalElements);
        this.totalModules = modules.length;
        this.activeSessionsCount = active.length;
        this.liveActiveSessions = active;
        this.totalSessions = history.totalElements;
        this.computeSessionStats(history.sessions, modules);
        this.buildDonut();
        this.buildDayBars(history.sessions);
        this.topModuleMax = this.topModules.reduce((m, x) => Math.max(m, x.total), 0);
        this.topInstructorMax = this.topInstructors.reduce((m, x) => Math.max(m, x.total), 0);
        this.topFreelancerMax = this.topFreelancers.reduce((m, x) => Math.max(m, x.total), 0);
        this.isLoading = false;
      },
      error: () => {
        this.error = this.t.instant('ADMIN.DASHBOARD.ERROR_LOAD');
        this.isLoading = false;
      }
    });
  }

  private computeUserStats(users: User[], totalElements: number): void {
    this.totalUsers = totalElements;
    const counts: Record<UserRole, number> = { ADMIN: 0, INSTRUCTEUR: 0, FREELANCER: 0 };
    for (const u of users) {
      if (u.role in counts) counts[u.role]++;
    }
    this.roleCounts = counts;
  }

  private computeSessionStats(sessions: SessionHistory[], modules: Module[]): void {
    this.totalReports = sessions.reduce((acc, s) => acc + (s.reportCount ?? 0), 0);

    const modIndex = new Map<number, Module>(modules.map(m => [m.id, m]));
    const byModule = new Map<number | null, ModulePerf>();
    const byInstructor = new Map<string, InstructorPerf>();

    for (const s of sessions) {
      const key = s.moduleId ?? null;
      if (!byModule.has(key)) {
        const mod = key !== null ? modIndex.get(key) : null;
        byModule.set(key, {
          moduleId: key,
          title: mod?.title ?? s.moduleName ?? 'Unassigned',
          total: 0,
          active: 0,
          sites: mod?.sites ?? []
        });
      }
      const mEntry = byModule.get(key)!;
      mEntry.total++;
      if (s.status === 'ACTIVE') mEntry.active++;

      const uname = s.instructorUsername || 'unknown';
      const role = this.userRoleByName.get(uname);
      if (role === 'ADMIN') continue;
      if (!byInstructor.has(uname)) {
        byInstructor.set(uname, { username: uname, role: role ?? 'UNKNOWN', total: 0, active: 0, reports: 0 });
      }
      const iEntry = byInstructor.get(uname)!;
      iEntry.total++;
      iEntry.reports += s.reportCount ?? 0;
      if (s.status === 'ACTIVE') iEntry.active++;
    }

    this.topModules = [...byModule.values()].sort((a, b) => b.total - a.total).slice(0, 5);
    const sorted = [...byInstructor.values()].sort((a, b) => b.total - a.total);
    this.topInstructors = sorted.filter(x => x.role === 'INSTRUCTEUR').slice(0, 5);
    this.topFreelancers = sorted.filter(x => x.role === 'FREELANCER').slice(0, 5);
  }

  rolePercentage(role: UserRole): number {
    if (this.totalUsers === 0) return 0;
    return Math.round((this.roleCounts[role] / this.totalUsers) * 100);
  }

  getInitials(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  barWidth(value: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(2, Math.round((value / max) * 100));
  }

  private buildDonut(): void {
    const palette: { role: UserRole; color: string; label: string }[] = [
      { role: 'ADMIN', color: '#f97316', label: 'ROLE.ADMIN' },
      { role: 'INSTRUCTEUR', color: '#3b82f6', label: 'ROLE.INSTRUCTEUR' },
      { role: 'FREELANCER', color: '#a855f7', label: 'ROLE.FREELANCER' }
    ];
    const total = this.roleCounts.ADMIN + this.roleCounts.INSTRUCTEUR + this.roleCounts.FREELANCER;
    let cumulative = 0;
    this.donutSegments = palette.map(p => {
      const value = this.roleCounts[p.role];
      const fraction = total > 0 ? value / total : 0;
      const dash = fraction * this.donutCircumference;
      const offset = -cumulative * this.donutCircumference;
      cumulative += fraction;
      return {
        label: p.label,
        value,
        color: p.color,
        percent: Math.round(fraction * 100),
        offset,
        dash
      };
    });
  }

  private buildDayBars(sessions: SessionHistory[]): void {
    const days = 7;
    const counts = new Array(days).fill(0);
    const labels: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    }

    for (const s of sessions) {
      if (!s.createdAt) continue;
      const created = new Date(s.createdAt);
      created.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today.getTime() - created.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < days) {
        counts[days - 1 - diffDays]++;
      }
    }

    this.maxDayCount = Math.max(1, ...counts);
    this.dayBars = labels.map((label, i) => ({
      label,
      count: counts[i],
      heightPct: Math.round((counts[i] / this.maxDayCount) * 100)
    }));
  }
}
