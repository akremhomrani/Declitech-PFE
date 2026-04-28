import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { ApiPaths } from './api-paths';
import { LoggerService } from './logger.service';
import { Alert } from '../models/alert';

const SESSION_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const TAB_SWITCH_TYPES = ['TAB_SWITCH', 'MULTIPLE_SWITCHES', 'OFF_PLATFORM'] as const;

@Injectable({ providedIn: 'root' })
export class AlertService {
    private readonly ngZone = inject(NgZone);
    private readonly logger = inject(LoggerService);

    private readonly alertSubject = new Subject<Alert>();
    private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);
    private readonly recentAlerts = new Map<string, Alert[]>();

    readonly alerts$ = this.alertSubject.asObservable();
    readonly connectionStatus$ = this.connectionStatusSubject.asObservable();

    private eventSource?: EventSource;

    connectToSession(sessionCode: string): void {
        if (!SESSION_CODE_PATTERN.test(sessionCode)) {
            return;
        }
        this.disconnect();

        this.eventSource = new EventSource(ApiPaths.alerts.stream(sessionCode), { withCredentials: true });

        this.eventSource.addEventListener('connected', () => {
            this.ngZone.run(() => this.connectionStatusSubject.next(true));
        });

        this.eventSource.addEventListener('alert', (event: MessageEvent) => {
            this.ngZone.run(() => this.handleAlertEvent(event));
        });

        this.eventSource.addEventListener('heartbeat', () => { });

        this.eventSource.onerror = (err) => {
            this.logger.warn('SSE alert stream error', { err: String(err) });
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

    getRecentAlertsForParticipant(identity: string): Alert[] {
        return this.recentAlerts.get(identity) || [];
    }

    getRecentAlertsForIdentity(studentLoginIdentity: string): Alert[] {
        return this.recentAlerts.get(studentLoginIdentity) || [];
    }

    hasRecentAlert(identity: string, alertType?: string): boolean {
        const alerts = this.getRecentAlertsForParticipant(identity);
        if (alertType) {
            return alerts.some(a => a.alertType === alertType);
        }
        return alerts.length > 0;
    }

    getAlertCount(identity: string): number {
        return this.getRecentAlertsForParticipant(identity).length;
    }

    clearAlertsForParticipant(identity: string): void {
        this.recentAlerts.delete(identity);
    }

    clearTabSwitchAlertsForParticipant(identity: string): void {
        const alerts = this.recentAlerts.get(identity);
        if (!alerts) return;
        const kept = alerts.filter(a => !TAB_SWITCH_TYPES.includes(a.alertType as typeof TAB_SWITCH_TYPES[number]));
        if (kept.length > 0) {
            this.recentAlerts.set(identity, kept);
        } else {
            this.recentAlerts.delete(identity);
        }
    }

    getAllRecentAlerts(): Alert[] {
        const all: Alert[] = [];
        this.recentAlerts.forEach(alerts => all.push(...alerts));
        return all;
    }

    private handleAlertEvent(event: MessageEvent): void {
        let alert: Alert;
        try {
            alert = JSON.parse(event.data);
        } catch (err) {
            this.logger.warn('Malformed SSE alert payload', { err, data: event.data });
            return;
        }

        if (alert.alertType === 'ALERT_RESOLVED') {
            if (alert.studentLoginIdentity) {
                this.clearAlertsForParticipant(alert.studentLoginIdentity);
            }
        } else {
            this.addRecentAlert(alert);
        }
        this.alertSubject.next(alert);
    }

    private addRecentAlert(alert: Alert): void {
        const key = alert.studentLoginIdentity || alert.sessionId;
        const list = this.recentAlerts.get(key) ?? [];
        list.push(alert);
        this.recentAlerts.set(key, list);
    }
}
