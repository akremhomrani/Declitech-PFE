import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Alert {
    participantId: string;
    sessionId: string;
    studentLoginIdentity?: string;
    alertType: 'TAB_SWITCH' | 'MULTIPLE_SWITCHES' | 'OFF_PLATFORM' | 'INACTIVITY' | 'LOW_ENGAGEMENT' | 'DISTRACTION' | 'FOCUS_LOSS' | 'ALERT_RESOLVED' | 'MOUSE_INACTIVITY';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
    timestamp: string;
    metadata?: any;
}

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    private eventSource?: EventSource;
    private alertSubject = new Subject<Alert>();
    private connectionStatusSubject = new BehaviorSubject<boolean>(false);
    private recentAlerts = new Map<string, Alert[]>();
    private readonly ALERT_RETENTION_MS = 30000; // 30 seconds

    public alerts$ = this.alertSubject.asObservable();
    public connectionStatus$ = this.connectionStatusSubject.asObservable();

    constructor() { }

    connectToSession(sessionCode: string): void {
        this.disconnect();

        const url = `${environment.apiUrl}/api/alerts/stream?sessionId=${sessionCode}`;
        console.log('🔌 Connecting to SSE:', url);

        this.eventSource = new EventSource(url);

        this.eventSource.addEventListener('connected', (event: MessageEvent) => {
            console.log('✅ SSE connection established:', JSON.parse(event.data));
            this.connectionStatusSubject.next(true);
        });

        this.eventSource.addEventListener('alert', (event: MessageEvent) => {
            const alert: Alert = JSON.parse(event.data);
            console.log('🚨 Alert received:', alert);

            // If alert is resolved, clear all alerts for this participant
            if (alert.alertType === 'ALERT_RESOLVED') {
                console.log('✅ Clearing alerts for participant:', alert.participantId);
                this.clearAlertsForParticipant(alert.participantId);
            } else {
                this.addRecentAlert(alert);
            }

            this.alertSubject.next(alert);
        });

        this.eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
            console.log('💓 Heartbeat received');
        });

        this.eventSource.onerror = (error) => {
            console.error('❌ SSE connection error:', error);
            this.connectionStatusSubject.next(false);
        };
    }

    disconnect(): void {
        if (this.eventSource) {
            console.log('🔌 Disconnecting from SSE');
            this.eventSource.close();
            this.eventSource = undefined;
            this.connectionStatusSubject.next(false);
            this.recentAlerts.clear();
        }
    }

    private addRecentAlert(alert: Alert): void {
        const key = alert.participantId;

        if (!this.recentAlerts.has(key)) {
            this.recentAlerts.set(key, []);
        }

        const alerts = this.recentAlerts.get(key)!;
        alerts.push(alert);

        // Clean up old alerts
        setTimeout(() => {
            const index = alerts.indexOf(alert);
            if (index > -1) {
                alerts.splice(index, 1);
            }
            if (alerts.length === 0) {
                this.recentAlerts.delete(key);
            }
        }, this.ALERT_RETENTION_MS);
    }

    getRecentAlertsForParticipant(participantId: string): Alert[] {
        return this.recentAlerts.get(participantId) || [];
    }

    hasRecentAlert(participantId: string, alertType?: string): boolean {
        const alerts = this.getRecentAlertsForParticipant(participantId);
        if (alertType) {
            return alerts.some(a => a.alertType === alertType);
        }
        return alerts.length > 0;
    }

    getAlertCount(participantId: string): number {
        return this.getRecentAlertsForParticipant(participantId).length;
    }

    clearAlertsForParticipant(participantId: string): void {
        this.recentAlerts.delete(participantId);
        console.log('🧹 Cleared all alerts for participant:', participantId);
    }

    getAllRecentAlerts(): Alert[] {
        const allAlerts: Alert[] = [];
        this.recentAlerts.forEach((alerts) => {
            allAlerts.push(...alerts);
        });
        return allAlerts;
    }
}
