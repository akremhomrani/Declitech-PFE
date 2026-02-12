import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { AlertService, Alert } from '../../services/alert.service';
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

  private subscription = new Subscription();

  constructor(
    private sessionService: SessionService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    // Subscribe to session updates
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

    // Subscribe to alerts
    this.subscription.add(
      this.alertService.alerts$.subscribe(() => {
        this.updateRecentAlerts();
      })
    );

    // Update relative time every 10 seconds
    this.subscription.add(
      interval(10000).subscribe(() => {
        this.recentAlerts = [...this.recentAlerts]; // Trigger change detection
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onEndSession() {
    if (confirm('Are you sure you want to end this live session?')) {
      this.sessionService.endSession();
    }
  }

  private updateRecentAlerts(): void {
    const allAlerts = this.alertService.getAllRecentAlerts();
    // Get the 4 most recent alerts, sorted by timestamp (newest first)
    this.recentAlerts = allAlerts
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
