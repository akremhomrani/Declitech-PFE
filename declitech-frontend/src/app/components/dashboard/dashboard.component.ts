import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { AlertService } from '../../services/alert.service';
import { LoggerService } from '../../services/logger.service';
import { EmotionReport, SessionStatistics } from '../../models/emotion-report.model';
import { interval, Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SidebarComponent, TranslateModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  students: EmotionReport[] = [];
  activeSessionCode: string = '';
  activeSessionId: number | undefined;
  activeTab: string = 'monitoring';
  statistics: SessionStatistics = {
    totalStudents: 0,
    connectedStudents: 0,
    focusedStudents: 0,
    distractedStudents: 0,
    averageAttention: 0
  };

  private readonly REFRESH_INTERVAL_MS = 5_000;
  private readonly ALERT_POLL_INTERVAL_MS = 5_000;
  private refreshSubscription?: Subscription;
  private sessionSubscription?: Subscription;
  private alertSubscription?: Subscription;
  private alertPollSubscription?: Subscription;

  constructor(
    private emotionService: EmotionService,
    private sessionService: SessionService,
    private alertService: AlertService,
    private logger: LoggerService
  ) {}

  ngOnInit() {
    this.sessionSubscription = this.sessionService.sessionData$.subscribe(session => {
      this.activeSessionCode = session?.code || '';
      this.activeSessionId = session?.id;

      if (this.activeSessionCode) {
        this.alertService.connectToSession(this.activeSessionCode);
        this.subscribeToAlerts();
        this.startAlertPolling();
      } else {
        this.alertService.disconnect();
        this.stopAlertPolling();
      }

      this.loadStudents();
    });

    this.startAutoRefresh();
  }

  ngOnDestroy() {
    this.refreshSubscription?.unsubscribe();
    this.sessionSubscription?.unsubscribe();
    this.alertSubscription?.unsubscribe();
    this.stopAlertPolling();
    this.alertService.disconnect();
  }

  private loadStudents() {
    if (!this.activeSessionCode) {
      this.students = [];
      this.calculateStatistics();
      return;
    }

    this.emotionService.getReportsBySessionCode(this.activeSessionCode).subscribe({
      next: reports => {
        this.students = reports;
        this.calculateStatistics();
      },
      error: err => this.logger.warn('Failed to load students', { err, sessionCode: this.activeSessionCode })
    });
  }

  private startAutoRefresh() {
    this.refreshSubscription = interval(this.REFRESH_INTERVAL_MS)
      .pipe(
        switchMap(() => {
          if (!this.activeSessionCode) return of([]);
          return this.emotionService.getReportsBySessionCode(this.activeSessionCode);
        })
      )
      .subscribe({
        next: reports => {
          this.students = reports;
          this.calculateStatistics();
        },
        error: err => this.logger.warn('Auto-refresh failed', { err })
      });
  }

  private startAlertPolling() {
    this.stopAlertPolling();
    if (!this.activeSessionCode) return;
    this.pollAlertsOnce();
    this.alertPollSubscription = interval(this.ALERT_POLL_INTERVAL_MS).subscribe(() => this.pollAlertsOnce());
  }

  private stopAlertPolling() {
    if (this.alertPollSubscription) {
      this.alertPollSubscription.unsubscribe();
      this.alertPollSubscription = undefined;
    }
  }

  private pollAlertsOnce() {
    if (!this.activeSessionCode) return;
    this.emotionService.getAllSessionAlerts(this.activeSessionCode).subscribe({
      next: alerts => {
        if (!alerts?.length) return;
        this.alertService.ingestPolledAlerts(alerts as any);
        this.students = [...this.students];
        this.calculateStatistics();
      },
      error: err => this.logger.warn('Alert polling failed', { err, sessionCode: this.activeSessionCode })
    });
  }

  private subscribeToAlerts() {
    this.alertSubscription?.unsubscribe();
    this.alertSubscription = this.alertService.alerts$.subscribe({
      next: () => {
        this.students = [...this.students];
        this.calculateStatistics();
      },
      error: err => this.logger.warn('Alert subscription error', { err })
    });
  }

  private calculateStatistics() {
    this.statistics.totalStudents = this.students.length;
    this.statistics.connectedStudents = this.students.filter(s => s.status === 'IN_PROGRESS').length;
    this.statistics.focusedStudents = this.students.filter(s =>
      s.status === 'IN_PROGRESS' && (s.dominantEmotion === 'happy' || s.dominantEmotion === 'neutral')
    ).length;
    this.statistics.distractedStudents = this.students.filter(s =>
      s.status === 'IN_PROGRESS' && (s.dominantEmotion === 'angry' || s.dominantEmotion === 'sad' || s.dominantEmotion === 'fear')
    ).length;

    if (this.statistics.connectedStudents > 0) {
      this.statistics.averageAttention = Math.floor((this.statistics.focusedStudents / this.statistics.connectedStudents) * 100);
    }
  }

  getStudentStatus(student: EmotionReport): string {
    if (student.status === 'IN_PROGRESS') return 'DASHBOARD.STATUS_FOCUSED';
    if (student.status === 'COMPLETED') return 'COMMON.COMPLETED';
    return 'DASHBOARD.OFFLINE';
  }

  hasTabSwitchAlert(student: EmotionReport): boolean {
    const identity = student.studentLoginIdentity;
    return this.alertService.hasRecentAlert(identity, 'TAB_SWITCH') ||
      this.alertService.hasRecentAlert(identity, 'MULTIPLE_SWITCHES');
  }

  hasMouseInactivityAlert(student: EmotionReport): boolean {
    return this.alertService.hasRecentAlert(student.studentLoginIdentity, 'MOUSE_INACTIVITY');
  }

  hasAnyAlert(student: EmotionReport): boolean {
    return this.alertService.hasRecentAlert(student.studentLoginIdentity);
  }

  getEngagementScore(student: EmotionReport): number {
    if (student.happyMean !== undefined && student.neutralMean !== undefined) {
      return Math.floor((student.happyMean + student.neutralMean) * 100);
    }
    return 0;
  }

  getAlertCount(student: EmotionReport): number {
    let count = this.alertService.getAlertCount(student.studentLoginIdentity);
    if (count === 0) {
      const alerts = this.alertService.getRecentAlertsForIdentity(student.studentLoginIdentity);
      count = alerts.length;
    }
    return count;
  }

  hasActiveAlert(student: EmotionReport): boolean {
    return this.alertService.hasRecentAlert(student.studentLoginIdentity);
  }

  getAlertBadgeType(student: EmotionReport): string {
    const identity = student.studentLoginIdentity;
    if (this.alertService.hasRecentAlert(identity, 'TAB_SWITCH') ||
      this.alertService.hasRecentAlert(identity, 'MULTIPLE_SWITCHES')) return 'SECURITY';
    if (this.alertService.hasRecentAlert(identity, 'MOUSE_INACTIVITY')) return 'BLOCKED';
    if (this.alertService.hasRecentAlert(identity)) return 'DISTRACTED';
    return 'FOCUSED';
  }

  getAlertMessage(student: EmotionReport): string {
    return 'DASHBOARD.STATUS_' + this.getStatusKey(student);
  }

  getStatusKey(student: EmotionReport): string {
    const identity = student.studentLoginIdentity;
    if (this.alertService.hasRecentAlert(identity, 'TAB_SWITCH') ||
      this.alertService.hasRecentAlert(identity, 'MULTIPLE_SWITCHES')) return 'SECURITY';
    if (this.alertService.hasRecentAlert(identity, 'MOUSE_INACTIVITY')) return 'BLOCKED';
    if (this.alertService.hasRecentAlert(identity)) return 'DISTRACTED';
    return 'ON_TASK';
  }

  getBadgeColor(badgeType: string): string {
    switch (badgeType) {
      case 'SECURITY': return 'bg-red-500';
      case 'BLOCKED': return 'bg-orange-500';
      case 'DISTRACTED': return 'bg-amber-500';
      case 'FOCUSED': return 'bg-primary';
      default: return 'bg-slate-400';
    }
  }
}
