import { Injectable, NgZone, inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { ApiPaths } from './api-paths';
import { LoggerService } from './logger.service';
import { Alert } from '../models/alert';

const SESSION_CODE_PATTERN = /^[A-Z0-9]{6}$/;
const TAB_SWITCH_TYPES = ['TAB_SWITCH', 'MULTIPLE_SWITCHES', 'OFF_PLATFORM'] as const;
const MAX_ALERTS_PER_IDENTITY = 50;
const PROCESSED_SIG_CAP = 1_000;
const RECONNECT_INITIAL_MS = 1_000;
const RECONNECT_MAX_MS = 15_000;

const normalizeIdentity = (id: string | null | undefined): string =>
    (id || '').trim().toLowerCase();

@Injectable({ providedIn: 'root' })
export class AlertService {
    private readonly ngZone = inject(NgZone);
    private readonly logger = inject(LoggerService);

    private readonly alertSubject = new Subject<Alert>();
    private readonly connectionStatusSubject = new BehaviorSubject<boolean>(false);
    private readonly recentAlerts = new Map<string, Alert[]>();
    // Tracks every signature we've already applied (cached OR resolved) so the
    // polling fallback never replays the same alert twice. Without this,
    // ALERT_RESOLVED entries — which are not added to recentAlerts — keep
    // arriving in the buffered poll response and re-clear the cache every
    // cycle, causing the badge to flicker on/off.
    private readonly processedSignatures = new Set<string>();

    readonly alerts$ = this.alertSubject.asObservable();
    readonly connectionStatus$ = this.connectionStatusSubject.asObservable();

    private eventSource?: EventSource;
    private currentSessionCode = '';
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private reconnectDelay = RECONNECT_INITIAL_MS;

    connectToSession(sessionCode: string): void {
        if (!SESSION_CODE_PATTERN.test(sessionCode)) {
            this.logger.warn('Invalid sessionCode, refusing SSE');
            return;
        }
        this.disconnect();
        this.currentSessionCode = sessionCode;
        this.reconnectDelay = RECONNECT_INITIAL_MS;
        this.openStream();
    }

    private openStream(): void {
        const sessionCode = this.currentSessionCode;
        if (!sessionCode) return;

        const url = ApiPaths.alerts.stream(sessionCode);
        this.logger.info('Opening SSE alert stream', { sessionCode });
        this.eventSource = new EventSource(url, { withCredentials: true });

        this.eventSource.addEventListener('connected', () => {
            this.logger.info('SSE alert stream connected', { sessionCode });
            this.reconnectDelay = RECONNECT_INITIAL_MS;
            this.ngZone.run(() => this.connectionStatusSubject.next(true));
        });

        this.eventSource.addEventListener('alert', (event: MessageEvent) => {
            this.logger.info('SSE alert received');
            this.ngZone.run(() => this.handleAlertEvent(event));
        });

        this.eventSource.addEventListener('heartbeat', () => { });

        this.eventSource.onerror = (err) => {
            this.logger.warn('SSE alert stream error', { err: String(err) });
            this.ngZone.run(() => this.connectionStatusSubject.next(false));
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect(): void {
        if (!this.currentSessionCode || this.reconnectTimer) return;
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
        }
        const delay = this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.currentSessionCode) this.openStream();
        }, delay);
    }

    disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.currentSessionCode = '';
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = undefined;
            this.connectionStatusSubject.next(false);
            this.recentAlerts.clear();
            this.processedSignatures.clear();
        }
    }

    getRecentAlertsForParticipant(identity: string): Alert[] {
        return this.recentAlerts.get(normalizeIdentity(identity)) || [];
    }

    getRecentAlertsForIdentity(studentLoginIdentity: string): Alert[] {
        return this.recentAlerts.get(normalizeIdentity(studentLoginIdentity)) || [];
    }

    hasRecentAlert(identity: string, alertType?: string): boolean {
        const key = normalizeIdentity(identity);
        const alerts = this.recentAlerts.get(key) || [];
        const result = alertType
            ? alerts.some(a => a.alertType === alertType)
            : alerts.length > 0;
        return result;
    }

    getAlertCount(identity: string): number {
        return this.getRecentAlertsForParticipant(identity).length;
    }

    clearAlertsForParticipant(identity: string): void {
        this.recentAlerts.delete(normalizeIdentity(identity));
    }

    clearTabSwitchAlertsForParticipant(identity: string): void {
        const key = normalizeIdentity(identity);
        const alerts = this.recentAlerts.get(key);
        if (!alerts) return;
        const kept = alerts.filter(a => !TAB_SWITCH_TYPES.includes(a.alertType as typeof TAB_SWITCH_TYPES[number]));
        if (kept.length > 0) {
            this.recentAlerts.set(key, kept);
        } else {
            this.recentAlerts.delete(key);
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
            this.logger.warn('Malformed SSE alert payload', { err });
            return;
        }

        const sig = this.alertSignature(alert);
        if (this.processedSignatures.has(sig)) return;
        this.markProcessed(sig);

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
        const key = normalizeIdentity(alert.studentLoginIdentity) || normalizeIdentity(alert.sessionId);
        if (!key) return;
        const list = this.recentAlerts.get(key) ?? [];
        list.push(alert);
        // Cap memory: evict oldest entries beyond 50 per identity.
        if (list.length > MAX_ALERTS_PER_IDENTITY) {
            list.shift();
        }
        this.recentAlerts.set(key, list);
    }

    /**
     * Polling fallback — feeds DB+Redis-buffered alerts into the live cache when
     * SSE is unavailable. De-duplicated by id, then by (timestamp + type + identity).
     */
    ingestPolledAlerts(alerts: Array<Alert & { id?: number }>): void {
        if (!alerts?.length) return;
        const fresh: Alert[] = [];
        alerts.forEach((raw) => {
            const sig = this.alertSignature(raw);
            if (this.processedSignatures.has(sig)) return;
            this.markProcessed(sig);
            if (raw.alertType === 'ALERT_RESOLVED') {
                if (raw.studentLoginIdentity) {
                    this.clearAlertsForParticipant(raw.studentLoginIdentity);
                }
            } else {
                this.addRecentAlert(raw);
            }
            fresh.push(raw);
        });
        if (fresh.length) {
            this.ngZone.run(() => fresh.forEach((a) => this.alertSubject.next(a)));
        }
    }

    private markProcessed(sig: string): void {
        this.processedSignatures.add(sig);
        if (this.processedSignatures.size > PROCESSED_SIG_CAP) {
            const oldest = this.processedSignatures.values().next().value;
            if (oldest !== undefined) this.processedSignatures.delete(oldest);
        }
    }

    private alertSignature(a: Alert & { id?: number }): string {
        return `${a.timestamp}|${a.alertType}|${normalizeIdentity(a.studentLoginIdentity)}`;
    }
}
