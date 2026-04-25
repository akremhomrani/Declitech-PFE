import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Alert } from '../models/alert';

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    private eventSource?: EventSource;
    private alertSubject = new Subject<Alert>();
    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    private recentAlerts = new Map<string, Alert[]>();

    public alerts$ = this.alertSubject.asObservable();
    public connectionStatus$ = this.connectionStatusSubject.asObservable();

    constructor(private ngZone: NgZone) { }

    connectToSession(sessionCode: string): void {
        if (!/^[A-Z0-9]{6}$/.test(sessionCode)) {
            return;
        }
        this.disconnect();

        const url = `${environment.apiUrl}/api/alerts/stream?sessionId=${sessionCode}`;

        this.eventSource = new EventSource(url, { withCredentials: true });
        this.eventSource.addEventListener('connected', () => {
            this.ngZone.run(() => {
                this.connectionStatusSubject.next(true);
            });
        });

        this.eventSource.addEventListener('alert', (event: MessageEvent) => {
            this.ngZone.run(() => {
                try {
                    const alert: Alert = JSON.parse(event.data);

                    if (alert.alertType === 'ALERT_RESOLVED') {
                        if (alert.studentLoginIdentity) {
                            this.clearAlertsForParticipant(alert.studentLoginIdentity);
                        }
                    } else {
                        this.addRecentAlert(alert);
                    }

                    this.alertSubject.next(alert);
                } catch (e) {
                    console.error('[AlertService] Failed to parse SSE data:', event.data, e);
                }
            });
        });

        this.eventSource.addEventListener('heartbeat', () => { });

        this.eventSource.onerror = (err) => {
            console.error('[AlertService] SSE error:', err);
            this.ngZone.run(() => this.connectionStatusSubject.next(false));
        };
    }

    disconnect(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
            this.connectionStatusSubject.next(false);
            this.recentAlerts.clear();
        }
    }

    private addRecentAlert(alert: Alert): void {
        const key = alert.studentLoginIdentity || alert.sessionId;

        if (!this.recentAlerts.has(key)) {
            this.recentAlerts.set(key, []);
        }
        this.recentAlerts.get(key)!.push(alert);
    }

    getRecentAlertsForParticipant(identity: string): Alert[] {
        return this.recentAlerts.get(identity) || [];
    }

    getRecentAlertsForIdentity(studentLoginIdentity: string): Alert[] {
        return this.recentAlerts.get(studentLoginIdentity) || [];
    }

    hasRecentAlert(identity: string, alertType?: string): boolean {
        let alerts = this.getRecentAlertsForParticipant(identity);
        if (alertType) {
            return alerts.some(a => a.alertType === alertType);
        }
        return alerts.length > 0;
    }

    getAlertCount(identity: string): number {
        return this.getRecentAlertsForParticipant(identity).length;
    }

    // Clear all alerts for an identity (end of session)
    clearAlertsForParticipant(identity: string): void {
        this.recentAlerts.delete(identity);
    }

    // Only clear tab switch alerts (keep MOUSE_INACTIVITY)
    clearTabSwitchAlertsForParticipant(identity: string): void {
        const tabSwitchTypes = ['TAB_SWITCH', 'MULTIPLE_SWITCHES', 'OFF_PLATFORM'];
        const alerts = this.recentAlerts.get(identity);
        if (alerts) {
            const kept = alerts.filter(a => !tabSwitchTypes.includes(a.alertType));
            if (kept.length > 0) {
                this.recentAlerts.set(identity, kept);
            } else {
                this.recentAlerts.delete(identity);
            }
        }
    }

    getAllRecentAlerts(): Alert[] {
        const allAlerts: Alert[] = [];
        this.recentAlerts.forEach((alerts) => {
            allAlerts.push(...alerts);
        });
        return allAlerts;
    }
}
