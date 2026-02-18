import { Injectable } from '@angular/core';
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
    private identityToParticipantId = new Map<string, string>();

    public alerts$ = this.alertSubject.asObservable();
    public connectionStatus$ = this.connectionStatusSubject.asObservable();

    constructor() { }

    connectToSession(sessionCode: string): void {
        this.disconnect();

        const url = `${environment.apiUrl}/api/alerts/stream?sessionId=${sessionCode}`;

        this.eventSource = new EventSource(url);

        this.eventSource.addEventListener('connected', () => {
            this.connectionStatusSubject.next(true);
        });

        this.eventSource.addEventListener('alert', (event: MessageEvent) => {
            const alert: Alert = JSON.parse(event.data);

            if (alert.alertType === 'ALERT_RESOLVED') {
                this.clearAlertsForParticipant(alert.participantId);
            } else {
                this.addRecentAlert(alert);
            }

            this.alertSubject.next(alert);
        });

        this.eventSource.addEventListener('heartbeat', () => {});

        this.eventSource.onerror = () => {
            this.connectionStatusSubject.next(false);
        };
    }

    disconnect(): void {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
            this.connectionStatusSubject.next(false);
            this.recentAlerts.clear();
            this.identityToParticipantId.clear();
        }
    }

    private addRecentAlert(alert: Alert): void {
        const key = alert.participantId;

        if (alert.studentLoginIdentity) {
            this.identityToParticipantId.set(alert.studentLoginIdentity, key);
        }

        if (!this.recentAlerts.has(key)) {
            this.recentAlerts.set(key, []);
        }

        const alerts = this.recentAlerts.get(key)!;
        alerts.push(alert);
    }

    getRecentAlertsForParticipant(participantId: string): Alert[] {
        const direct = this.recentAlerts.get(participantId);
        if (direct && direct.length > 0) {
            return direct;
        }
        for (const [, alerts] of this.recentAlerts) {
            if (alerts.length > 0 && alerts.some(a => a.studentLoginIdentity === participantId)) {
                return alerts;
            }
        }
        return [];
    }

    getRecentAlertsForIdentity(studentLoginIdentity: string): Alert[] {
        const pid = this.identityToParticipantId.get(studentLoginIdentity);
        if (pid) {
            return this.recentAlerts.get(pid) || [];
        }
        return [];
    }

    hasRecentAlert(participantId: string, alertType?: string, studentLoginIdentity?: string): boolean {
        let alerts = this.getRecentAlertsForParticipant(participantId);
        if (alerts.length === 0 && studentLoginIdentity) {
            alerts = this.getRecentAlertsForIdentity(studentLoginIdentity);
        }
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
        for (const [identity, pid] of this.identityToParticipantId) {
            if (pid === participantId) {
                this.identityToParticipantId.delete(identity);
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
