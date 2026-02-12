import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { AlertService, Alert } from '../../services/alert.service';
import { EmotionReport, SessionStatistics } from '../../models/emotion-report.model';
import { interval, Subscription, of } from 'rxjs';
import { switchMap, filter } from 'rxjs/operators';
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
    // Subscribe to active session changes
    this.sessionSubscription = this.sessionService.sessionData$.subscribe(session => {
      this.activeSessionCode = session?.code || '';

      if (this.activeSessionCode) {
        this.alertService.connectToSession(this.activeSessionCode);
        this.subscribeToAlerts();
      } else {
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
      error: (error: any) => {
        console.error('Error loading students:', error);
      }
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
        error: (error: any) => {
          console.error('Error refreshing students:', error);
        }
      });
  }

  subscribeToAlerts() {
    this.alertSubscription = this.alertService.alerts$.subscribe({
      next: (alert: Alert) => {
        console.log('🚨 Dashboard received alert:', alert);
        // Force UI update when alert is received
        this.calculateStatistics();
      },
      error: (error: any) => {
        console.error('Error receiving alerts:', error);
      }
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

  getStudentStatusClass(student: EmotionReport): string {
    // Check for recent alerts first (highest priority)
    if (this.alertService.hasRecentAlert(student.participantId)) {
      // Priority 1: Tab switch alerts (RED)
      const hasTabSwitch = this.alertService.hasRecentAlert(student.participantId, 'TAB_SWITCH') ||
        this.alertService.hasRecentAlert(student.participantId, 'MULTIPLE_SWITCHES');
      if (hasTabSwitch) {
        return 'border-red-500 border-4 shadow-lg shadow-red-500/20';
      }

      // Priority 2: Mouse inactivity (ORANGE)
      const hasMouseInactivity = this.alertService.hasRecentAlert(student.participantId, 'MOUSE_INACTIVITY');
      if (hasMouseInactivity) {
        return 'border-orange-500 border-4 shadow-lg shadow-orange-500/20';
      }

      // Priority 3: Other alerts (AMBER)
      return 'border-amber-500 border-4 shadow-lg shadow-amber-500/20';
    }

    // Default emotion-based styling
    if (student.status === 'IN_PROGRESS') {
      if (student.dominantEmotion === 'happy' || student.dominantEmotion === 'neutral') {
        return 'border-primary border-2';
      } else if (student.dominantEmotion === 'angry' || student.dominantEmotion === 'sad') {
        return 'border-amber-400 border-2';
      } else if (student.dominantEmotion === 'fear') {
        return 'border-red-500 border-2';
      }
      // If IN_PROGRESS but no emotion detected yet
      return 'border-primary border-2';
    }

    // Default for any other status (CONNECTED, etc.) - blue border
    return 'border-primary border-2';
  }

  getEngagementScore(student: EmotionReport): number {
    if (student.happyMean !== undefined && student.neutralMean !== undefined) {
      return Math.floor((student.happyMean + student.neutralMean) * 100);
    }
    return 0;
  }

  getAlertCount(student: EmotionReport): number {
    return this.alertService.getAlertCount(student.participantId);
  }

  hasActiveAlert(student: EmotionReport): boolean {
    return this.alertService.hasRecentAlert(student.participantId);
  }

  getAlertBadgeType(student: EmotionReport): string {
    if (this.alertService.hasRecentAlert(student.participantId, 'TAB_SWITCH') ||
      this.alertService.hasRecentAlert(student.participantId, 'MULTIPLE_SWITCHES')) {
      return 'SECURITY';
    }
    if (this.alertService.hasRecentAlert(student.participantId, 'MOUSE_INACTIVITY')) {
      return 'BLOCKED';
    }
    if (this.alertService.hasRecentAlert(student.participantId)) {
      return 'DISTRACTED';
    }
    return 'FOCUSED';
  }

  getAlertMessage(student: EmotionReport): string {
    if (this.alertService.hasRecentAlert(student.participantId, 'TAB_SWITCH') ||
      this.alertService.hasRecentAlert(student.participantId, 'MULTIPLE_SWITCHES')) {
      return 'Tab Switched';
    }
    if (this.alertService.hasRecentAlert(student.participantId, 'MOUSE_INACTIVITY')) {
      return 'No Movement';
    }
    if (this.alertService.hasRecentAlert(student.participantId)) {
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
