import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { AlertService } from '../../services/alert.service';
import { Alert } from '../../models/alert';
import { AuthService } from '../../services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  elapsedTime: string = '';
  recentAlerts: Alert[] = [];
  showEndSessionModal = false;
  endingSession = false;
  isMobileOpen = false;
  isAdmin = false;
  isInstructor = false;

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
      interval(10000).subscribe(() => {
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
    const allAlerts = this.alertService.getAllRecentAlerts();
    console.log('[Sidebar] updateRecentAlerts — total alerts from service:', allAlerts.length, allAlerts);
    this.recentAlerts = allAlerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 4);
    console.log('[Sidebar] recentAlerts after update:', this.recentAlerts);
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

  getAlertTitle(alert: Alert): string {
    switch (alert.alertType) {
      case 'TAB_SWITCH':
      case 'MULTIPLE_SWITCHES':
        return 'TAB SWITCHED';
      case 'MOUSE_INACTIVITY':
        return 'NO MOVEMENT';
      default:
        return 'DISTRACTED';
    }
  }

  getRelativeTime(timestamp: string): string {
    const now = new Date().getTime();
    const alertTime = new Date(timestamp).getTime();
    const diffMs = now - alertTime;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) return 'Now';
    if (diffSec < 60) return `${diffSec}s`;
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}h`;
  }
}
