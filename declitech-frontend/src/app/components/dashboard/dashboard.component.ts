import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { AlertService } from '../../services/alert.service';
import { Alert } from '../../models/alert';
import { EmotionReport, SessionStatistics } from '../../models/emotion-report.model';
import { interval, Subscription, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  students: EmotionReport[] = [];
  activeSessionCode: string = '';
  activeTab: string = 'monitoring';
  statistics: SessionStatistics = {
    totalStudents: 30,
    connectedStudents: 0,
    focusedStudents: 0,
    distractedStudents: 0,
    averageAttention: 0
  };

  private refreshSubscription?: Subscription;
  private sessionSubscription?: Subscription;
  private alertSubscription?: Subscription;

  constructor(
    private emotionService: EmotionService,
    private sessionService: SessionService,
    private alertService: AlertService
  ) { }

  ngOnInit() {
    this.sessionSubscription = this.sessionService.sessionData$.subscribe(session => {
      this.activeSessionCode = session?.code || '';
      console.log('[Dashboard] Session code:', this.activeSessionCode);

      if (this.activeSessionCode) {
        console.log('[Dashboard] Connecting to SSE for session:', this.activeSessionCode);
        this.alertService.connectToSession(this.activeSessionCode);
        this.subscribeToAlerts();
      } else {
        console.log('[Dashboard] No session code — disconnecting SSE');
        this.alertService.disconnect();
      }

      this.loadStudents();
    });

    this.startAutoRefresh();
  }

  ngOnDestroy() {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
    }
    if (this.sessionSubscription) {
      this.sessionSubscription.unsubscribe();
    }
    if (this.alertSubscription) {
      this.alertSubscription.unsubscribe();
    }
    this.alertService.disconnect();
  }

  loadStudents() {
    if (!this.activeSessionCode) {
      this.students = [];
      this.calculateStatistics();
      return;
    }

    this.emotionService.getReportsBySessionCode(this.activeSessionCode).subscribe({
      next: (reports) => {
        this.students = reports;
        this.calculateStatistics();
      },
      error: () => { }
    });
  }

  startAutoRefresh() {
    this.refreshSubscription = interval(5000)
      .pipe(
        switchMap(() => {
          if (!this.activeSessionCode) {
            return of([]);
          }
          return this.emotionService.getReportsBySessionCode(this.activeSessionCode);
        })
      )
      .subscribe({
        next: (reports) => {
          this.students = reports;
          this.calculateStatistics();
        },
        error: () => { }
      });
  }

  subscribeToAlerts() {
    if (this.alertSubscription) {
      this.alertSubscription.unsubscribe();
    }
    this.alertSubscription = this.alertService.alerts$.subscribe({
      next: (alert: Alert) => {
        console.log('[Dashboard] Alert received from stream:', alert);
        console.log('[Dashboard] Current students identities:', this.students.map(s => s.studentLoginIdentity));
        this.students = [...this.students];
        this.calculateStatistics();
        // Check border state for each student after alert
        this.students.forEach(s => {
          console.log(`[Dashboard] Student "${s.studentLoginIdentity}" — hasAnyAlert: ${this.hasAnyAlert(s)}, hasTabSwitch: ${this.hasTabSwitchAlert(s)}, hasMouseInactivity: ${this.hasMouseInactivityAlert(s)}`);
        });
      },
      error: (err) => { console.error('[Dashboard] Alert stream error:', err); }
    });
  }

  calculateStatistics() {
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
    if (student.status === 'IN_PROGRESS') {
      return 'Focused';
    } else if (student.status === 'COMPLETED') {
      return 'Completed';
    }
    return 'Offline';
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
      this.alertService.hasRecentAlert(identity, 'MULTIPLE_SWITCHES')) {
      return 'SECURITY';
    }
    if (this.alertService.hasRecentAlert(identity, 'MOUSE_INACTIVITY')) {
      return 'BLOCKED';
    }
    if (this.alertService.hasRecentAlert(identity)) {
      return 'DISTRACTED';
    }
    return 'FOCUSED';
  }

  getAlertMessage(student: EmotionReport): string {
    const identity = student.studentLoginIdentity;
    if (this.alertService.hasRecentAlert(identity, 'TAB_SWITCH') ||
      this.alertService.hasRecentAlert(identity, 'MULTIPLE_SWITCHES')) {
      return 'Tab Switched';
    }
    if (this.alertService.hasRecentAlert(identity, 'MOUSE_INACTIVITY')) {
      return 'No Movement';
    }
    if (this.alertService.hasRecentAlert(identity)) {
      return 'Distracted';
    }
    return 'On Task';
  }

  getBadgeColor(badgeType: string): string {
    switch (badgeType) {
      case 'SECURITY':
        return 'bg-red-500';
      case 'BLOCKED':
        return 'bg-orange-500';
      case 'DISTRACTED':
        return 'bg-amber-500';
      case 'FOCUSED':
        return 'bg-primary';
      default:
        return 'bg-slate-400';
    }
  }
}
