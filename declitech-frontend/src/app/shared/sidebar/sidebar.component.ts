import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { SessionService } from '../../services/session.service';
import { AlertService } from '../../services/alert.service';
import { Alert } from '../../models/alert';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  sessionTitle: string = '';
  elapsedTime: string = '';
  recentAlerts: Alert[] = [];
  showEndSessionModal = false;
  endingSession = false;
  isMobileOpen = false;
  isAdmin = false;
  isInstructor = false;

  private readonly ALERT_REFRESH_INTERVAL_MS = 10_000;
  private subscription = new Subscription();

  constructor(
    private sessionService: SessionService,
    private alertService: AlertService,
    private authService: AuthService,
    public layoutService: LayoutService
  ) { }

  ngOnInit(): void {
    const role = this.authService.getRole();
    this.isAdmin = role === 'ADMIN';
    this.isInstructor = role === 'INSTRUCTOR';
    this.subscription.add(
      this.layoutService.sidebarOpen$.subscribe(open => {
        this.isMobileOpen = open;
      })
    );

    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        this.sessionCode = session?.code || '';
        this.sessionTitle = session?.title || '';
      })
    );

    this.subscription.add(
      this.sessionService.elapsedTime$.subscribe(time => {
        this.elapsedTime = time;
      })
    );

    this.subscription.add(
      this.alertService.alerts$.subscribe(() => {
        this.updateRecentAlerts();
      })
    );

    this.subscription.add(
      interval(this.ALERT_REFRESH_INTERVAL_MS).subscribe(() => {
        this.recentAlerts = [...this.recentAlerts];
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onEndSession() {
    this.showEndSessionModal = true;
  }

  closeEndSessionModal(): void {
    this.showEndSessionModal = false;
  }

  confirmEndSession(): void {
    this.endingSession = true;
    this.sessionService.endSession();
    this.endingSession = false;
    this.showEndSessionModal = false;
  }

  private updateRecentAlerts(): void {
    this.recentAlerts = this.alertService.getAllRecentAlerts()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 4);
  }

  getAlertColor(alert: Alert): string {
    if (alert.alertType === 'TAB_SWITCH' || alert.alertType === 'MULTIPLE_SWITCHES') {
      return 'red';
    }
    if (alert.alertType === 'MOUSE_INACTIVITY') {
      return 'orange';
    }
    return 'amber';
  }

  getAlertTitleKey(alert: Alert): string {
    switch (alert.alertType) {
      case 'TAB_SWITCH':
      case 'MULTIPLE_SWITCHES':
        return 'ALERT_TYPE.TAB_SWITCHED_TITLE';
      case 'MOUSE_INACTIVITY':
        return 'ALERT_TYPE.NO_MOVEMENT_TITLE';
      default:
        return 'ALERT_TYPE.DISTRACTED_TITLE';
    }
  }

  getRelativeTime(timestamp: string): { value: string | number; unit: 'now' | 's' | 'm' | 'h' } {
    const now = new Date().getTime();
    const alertTime = new Date(timestamp).getTime();
    const diffMs = now - alertTime;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return { value: '', unit: 'now' };
    if (diffSec < 60) return { value: diffSec, unit: 's' };
    if (diffMin < 60) return { value: diffMin, unit: 'm' };
    return { value: Math.floor(diffMin / 60), unit: 'h' };
  }
}
