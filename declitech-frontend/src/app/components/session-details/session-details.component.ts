import { Component, ElementRef, OnInit, Renderer2, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { EmotionReport, SessionAlert } from '../../models/emotion-report.model';
import { StudentActivityReport } from '../../models/student-activity-report.model';
import { SessionHistory, StudentReport } from '../../models/session';
import { TrackReportService } from '../../services/track-report.service';
import { TrackReport } from '../../models/track-report.model';
import { Observation, TAG_INDEX, parseObservation, stringifyObservation } from '../../models/observation.model';
import { TranslateModule } from '@ngx-translate/core';
import { LoggerService } from '../../services/logger.service';
import { PdfExportService } from '../../services/pdf-export.service';
import {
  alertIcon,
  alertSeverityClass,
  alertTypeI18nKey,
  formatAlertTime as fmtAlertTime,
  getInitials as makeInitials
} from '../../utils/alert-presentation.util';

interface VisitedSite {
  name: string;
  url: string;
  count: number;
  firstSeen: string;
}

const TAB_SWITCH_TYPES = new Set(['TAB_SWITCH', 'MULTIPLE_SWITCHES', 'OFF_PLATFORM']);

@Component({
  selector: 'app-session-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, SidebarComponent, TranslateModule],
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css']
})
export class SessionDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly emotionService = inject(EmotionService);
  private readonly sessionService = inject(SessionService);
  private readonly trackReportService = inject(TrackReportService);
  private readonly logger = inject(LoggerService);
  private readonly pdfExport = inject(PdfExportService);
  private readonly renderer = inject(Renderer2);

  @ViewChild('fullReport') fullReportRef?: ElementRef<HTMLElement>;

  Math = Math;
  sessionId: number | null = null;
  sessionCode = '';
  sessionTitle = '';
  isLoading = false;

  classAvgFocus = 0;
  focusTrend = 0;
  mostCommonEmotion = 'COMMON.LOADING';
  emotionPercentage = 0;
  criticalAlerts = 0;
  alertTrend = 0;
  participationScore = 'N/A';

  searchTerm = '';
  dateRange = '';
  alertType = '';

  students: StudentReport[] = [];
  allStudents: StudentReport[] = [];

  currentPage = 1;
  totalResults = 0;
  resultsPerPage = 5;

  trackReports: TrackReport[] = [];
  untransformedReports: EmotionReport[] = [];
  selectedStudent: StudentReport | null = null;
  selectedTrackReport: TrackReport | null = null;
  selectedEmotionReport: EmotionReport | null = null;
  selectedStudentAlerts: SessionAlert[] = [];
  selectedStudentReport: StudentActivityReport | null = null;
  reportActivities: { activity: string; note?: unknown }[] = [];
  isLoadingReport = false;
  isLoadingAlerts = false;
  isReportModalOpen = false;
  isExportingPdf = false;
  noteText = '';
  isSavingNote = false;
  noteSaved = false;

  tabSwitchAlerts: SessionAlert[] = [];
  uniqueVisitedSites: VisitedSite[] = [];

  private readonly studentAlertCache = new Map<string, SessionAlert[]>();

  parsedObservation: Observation | null = null;
  hasStructuredObservation = false;
  readonly tagIndex = TAG_INDEX;

  readonly alertSummaryTypes = ['TAB_SWITCH', 'MULTIPLE_SWITCHES', 'OFF_PLATFORM', 'MOUSE_INACTIVITY', 'INACTIVITY'];

  private readonly ALERT_HIGH_THRESHOLD = 0.3;
  private readonly ALERT_MED_THRESHOLD = 0.2;
  private readonly NOTE_SAVED_MS = 3_000;
  private readonly STUDENT_ID_OFFSET = 1_000;

  ngOnInit(): void {
    this.sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.sessionId) {
      this.loadSessionDetails();
    }
  }

  private loadSessionDetails(): void {
    if (!this.sessionId) return;

    this.isLoading = true;
    this.sessionService.getSessionById(this.sessionId).subscribe({
      next: (session: SessionHistory) => {
        this.sessionCode = session.sessionCode;
        this.sessionTitle = session.title;
        this.loadSessionReports();
      },
      error: (err) => {
        this.logger.error('Failed to load session details', err);
        this.isLoading = false;
      }
    });
  }

  private loadSessionReports(): void {
    if (!this.sessionCode) return;

    this.emotionService.getReportsBySessionCode(this.sessionCode).subscribe({
      next: (reports: EmotionReport[]) => {
        this.untransformedReports = reports;
        this.allStudents = this.transformReportsToStudents(reports);
        this.totalResults = this.allStudents.length;
        this.updateDisplayedStudents();
        this.calculateStatistics(reports);
        this.isLoading = false;
        this.loadAlertCounts();
      },
      error: (err) => {
        this.logger.error('Failed to load session reports', err);
        this.isLoading = false;
      }
    });

    this.trackReportService.getTrackReportsBySessionCode(this.sessionCode).subscribe({
      next: (reports: TrackReport[]) => {
        this.trackReports = reports;
      },
      error: (err) => this.logger.warn('Failed to load track reports', { err })
    });
  }

  private transformReportsToStudents(reports: EmotionReport[]): StudentReport[] {
    return reports.map((report, index) => ({
      id: `#${report.id || index + this.STUDENT_ID_OFFSET}`,
      name: report.studentLoginIdentity || 'Student',
      lastSessionDate: this.formatDate(report.generatedAt || report.createdAt || ''),
      avgFocusScore: this.calculateFocusScore(report),
      topEmotion: this.mapEmotionToLabel(report.dominantEmotion || 'neutral'),
      emotionColor: this.getEmotionColor(report.dominantEmotion || 'neutral'),
      totalAlerts: this.calculateAlerts(report),
      avatarUrl: ''
    }));
  }

  private calculateFocusScore(report: EmotionReport): number {
    const happy = (report.happyMean || 0) * 100;
    const neutral = (report.neutralMean || 0) * 100;
    const sad = (report.sadMean || 0) * 100;
    const angry = (report.angryMean || 0) * 100;
    const fear = (report.fearMean || 0) * 100;

    const focusScore = happy * 1.2 + neutral * 0.8 - (sad * 0.5 + angry * 0.7 + fear * 0.6);
    return Number(Math.max(0, Math.min(100, focusScore)).toFixed(2));
  }

  private mapEmotionToLabel(emotion: string): string {
    const keyMap: Record<string, string> = {
      happy: 'EMOTION.FOCUSED',
      neutral: 'EMOTION.STEADY',
      sad: 'EMOTION.DISENGAGED',
      angry: 'EMOTION.STRESSED',
      fear: 'EMOTION.ANXIOUS',
      surprise: 'EMOTION.ENGAGED',
      disgust: 'EMOTION.DISTRACTED'
    };
    return keyMap[emotion.toLowerCase()] || emotion;
  }

  private getEmotionColor(emotion: string): string {
    const colorMap: Record<string, string> = {
      happy: 'teal',
      neutral: 'slate',
      sad: 'slate',
      angry: 'red',
      fear: 'amber',
      surprise: 'teal',
      disgust: 'red'
    };
    return colorMap[emotion.toLowerCase()] || 'slate';
  }

  private calculateAlerts(report: EmotionReport): number {
    let alerts = 0;
    if ((report.angryMean || 0) > this.ALERT_HIGH_THRESHOLD) alerts++;
    if ((report.fearMean || 0) > this.ALERT_HIGH_THRESHOLD) alerts++;
    if ((report.disgustMean || 0) > this.ALERT_MED_THRESHOLD) alerts++;
    return alerts;
  }

  private loadAlertCounts(): void {
    if (!this.sessionCode || this.allStudents.length === 0) return;

    // Single batch fetch — backend returns all alerts for the session, frontend
    // groups by identity. Replaces N+1 per-student requests.
    this.emotionService.getAllSessionAlerts(this.sessionCode).subscribe({
      next: (alerts) => {
        const countByIdentity = new Map<string, number>();
        alerts.forEach((a) => {
          if (!TAB_SWITCH_TYPES.has(a.alertType)) return;
          countByIdentity.set(a.studentLoginIdentity, (countByIdentity.get(a.studentLoginIdentity) || 0) + 1);
        });
        this.allStudents = this.allStudents.map((s) => ({
          ...s,
          totalAlerts: countByIdentity.get(s.name) ?? s.totalAlerts
        }));
        this.updateDisplayedStudents();
      },
      error: (err) => this.logger.warn('Failed to load batch alert counts', { err })
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private calculateStatistics(reports: EmotionReport[]): void {
    if (reports.length === 0) {
      this.classAvgFocus = 0;
      this.mostCommonEmotion = 'COMMON.NONE';
      this.criticalAlerts = 0;
      this.participationScore = 'N/A';
      return;
    }

    const avgFocus = this.allStudents.reduce((sum, s) => sum + s.avgFocusScore, 0) / this.allStudents.length;
    this.classAvgFocus = Number(avgFocus.toFixed(2));

    const emotionCounts: Record<string, number> = {};
    reports.forEach((report) => {
      const emotion = report.dominantEmotion || 'neutral';
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    const mostCommon = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
    this.mostCommonEmotion = this.mapEmotionToLabel(mostCommon[0]);
    this.emotionPercentage = Math.round((mostCommon[1] / reports.length) * 100);

    this.criticalAlerts = this.allStudents.reduce((sum, s) => sum + s.totalAlerts, 0);
    this.participationScore = scoreToGrade(avgFocus);
  }

  private updateDisplayedStudents(): void {
    const startIndex = (this.currentPage - 1) * this.resultsPerPage;
    this.students = this.allStudents.slice(startIndex, startIndex + this.resultsPerPage);
  }

  getEmotionClass(color: string): string {
    const colorMap: Record<string, string> = {
      teal: 'bg-teal-50 text-teal-600 border-teal-100',
      slate: 'bg-slate-50 text-slate-500 border-slate-100',
      red: 'bg-red-50 text-red-600 border-red-100',
      amber: 'bg-amber-50 text-amber-600 border-amber-100'
    };
    return colorMap[color] || colorMap['slate'];
  }

  getFocusBarColor(score: number): string {
    if (score >= 85) return 'bg-primary';
    if (score >= 70) return 'bg-amber-400';
    return 'bg-red-400';
  }

  applyFilters(): void {
    this.updateDisplayedStudents();
  }

  viewFullReport(studentId: string): void {
    this.selectedStudent = this.allStudents.find((s) => s.id === studentId) || null;
    if (!this.selectedStudent) return;

    const sName = (this.selectedStudent.name || '').trim().toLowerCase();
    this.selectedTrackReport =
      this.trackReports.find((t) => (t.studentIdentity || '').trim().toLowerCase() === sName) || null;
    this.selectedEmotionReport =
      this.untransformedReports.find((r) => r.studentLoginIdentity === this.selectedStudent?.name) || null;
    this.setStudentAlerts([]);
    this.applyInstructorNote(this.selectedEmotionReport?.instructorNote || '');
    this.noteSaved = false;
    this.isReportModalOpen = true;

    const sessionId = this.sessionCode || this.selectedEmotionReport?.sessionCode || '';
    const identity = this.selectedEmotionReport?.studentLoginIdentity || this.selectedStudent.name || '';
    if (!sessionId || !identity) return;

    this.fetchStudentReport(sessionId, identity);

    const cacheKey = `${sessionId}::${identity}`;
    const cached = this.studentAlertCache.get(cacheKey);
    if (cached) {
      this.setStudentAlerts(cached);
      return;
    }

    this.isLoadingAlerts = true;
    this.emotionService.getAlertsBySessionAndStudent(sessionId, identity).subscribe({
      next: (alerts) => {
        this.studentAlertCache.set(cacheKey, alerts);
        this.setStudentAlerts(alerts);
        this.isLoadingAlerts = false;
      },
      error: (err) => {
        this.logger.warn('Failed to load student alerts for modal', { err });
        this.setStudentAlerts([]);
        this.isLoadingAlerts = false;
      }
    });
  }

  private fetchStudentReport(sessionId: string, identity: string): void {
    this.selectedStudentReport = null;
    this.reportActivities = [];
    this.isLoadingReport = true;
    this.emotionService.getStudentActivityReport(sessionId, identity).subscribe({
      next: (report) => {
        this.selectedStudentReport = report;
        this.reportActivities = this.parseReportActivities(report.details);
        this.isLoadingReport = false;
      },
      error: () => {
        this.selectedStudentReport = null;
        this.reportActivities = [];
        this.isLoadingReport = false;
      }
    });
  }

  private parseReportActivities(details: string): { activity: string; note?: unknown }[] {
    try {
      const parsed = JSON.parse(details || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((a) => a && typeof a.activity === 'string' && a.activity.trim())
        .map((a) => ({ activity: a.activity, note: a.note }));
    } catch {
      return [];
    }
  }

  difficultyClass(difficulty: string): string {
    const value = (difficulty || '').toLowerCase();
    if (value.includes('élev') || value.includes('eleve') || value.includes('high')) {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
    if (value.includes('moy') || value.includes('medium')) {
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    }
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  }

  closeReportModal(): void {
    this.isReportModalOpen = false;
    this.selectedStudent = null;
    this.selectedTrackReport = null;
    this.selectedEmotionReport = null;
    this.selectedStudentReport = null;
    this.reportActivities = [];
    this.isLoadingReport = false;
    this.setStudentAlerts([]);
    this.isLoadingAlerts = false;
    this.isExportingPdf = false;
    this.noteText = '';
    this.noteSaved = false;
    this.isSavingNote = false;
    this.parsedObservation = null;
    this.hasStructuredObservation = false;
  }

  // Memoize derived alert views — recomputed only when the underlying alert array changes.
  // Avoids the 10×/cycle template re-evaluation flagged in the audit.
  private setStudentAlerts(alerts: SessionAlert[]): void {
    this.selectedStudentAlerts = alerts;
    this.tabSwitchAlerts = alerts.filter((a) => TAB_SWITCH_TYPES.has(a.alertType));
    this.uniqueVisitedSites = aggregateVisitedSites(this.tabSwitchAlerts);
  }

  private applyInstructorNote(raw: string): void {
    if (!raw) {
      this.parsedObservation = null;
      this.hasStructuredObservation = false;
      this.noteText = '';
      return;
    }
    const obs = parseObservation(raw);
    const looksStructured = raw.trim().startsWith('{') && obs.tags.length > 0;
    if (looksStructured) {
      this.parsedObservation = obs;
      this.hasStructuredObservation = true;
      this.noteText = obs.comment || '';
    } else {
      this.parsedObservation = null;
      this.hasStructuredObservation = false;
      this.noteText = obs.comment || raw;
    }
  }

  removeObservationTag(tagId: string): void {
    if (!this.parsedObservation) return;
    this.parsedObservation = {
      ...this.parsedObservation,
      tags: this.parsedObservation.tags.filter((t) => t !== tagId)
    };
  }

  saveNote(): void {
    if (!this.selectedEmotionReport?.id || this.isSavingNote) return;
    this.isSavingNote = true;
    this.noteSaved = false;

    let payload: string;
    if (this.hasStructuredObservation && this.parsedObservation) {
      const updated: Observation = {
        ...this.parsedObservation,
        v: 2,
        tags: this.parsedObservation.tags,
        comment: this.noteText.trim(),
        updatedAt: new Date().toISOString()
      };
      payload = stringifyObservation(updated);
      this.parsedObservation = updated;
    } else {
      payload = this.noteText;
    }

    this.emotionService.updateInstructorNote(this.selectedEmotionReport.id, payload).subscribe({
      next: () => {
        if (this.selectedEmotionReport) this.selectedEmotionReport.instructorNote = payload;
        this.isSavingNote = false;
        this.noteSaved = true;
        setTimeout(() => {
          this.noteSaved = false;
        }, this.NOTE_SAVED_MS);
      },
      error: (err) => {
        this.logger.error('Failed to save instructor note', err);
        this.isSavingNote = false;
      }
    });
  }

  // Bound by the template (replaces the previous getTabSwitchAlerts() function call).
  // Kept as a method so existing template references compile; returns the cached array.
  getTabSwitchAlerts(): SessionAlert[] {
    return this.tabSwitchAlerts;
  }

  getUniqueVisitedSites(): VisitedSite[] {
    return this.uniqueVisitedSites;
  }

  getAlertCountByType(alertType: string): number {
    return this.selectedStudentAlerts.filter((a) => a.alertType === alertType).length;
  }

  getAlertTypeLabel(alertType: string): string {
    return alertTypeI18nKey(alertType);
  }

  getAlertIcon(alertType: string): string {
    return alertIcon(alertType);
  }

  getAlertSeverityClass(severity: string): string {
    return alertSeverityClass(severity);
  }

  formatAlertTime(timestamp: string): string {
    return fmtAlertTime(timestamp);
  }

  getInitials(name: string): string {
    return makeInitials(name);
  }

  async exportModalToPDF(): Promise<void> {
    const element = this.fullReportRef?.nativeElement;
    if (!element || !this.selectedStudent) return;

    this.isExportingPdf = true;
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Declitech_Report_${this.selectedStudent.name.replace(/\s+/g, '_')}_${dateStr}.pdf`;
    await this.pdfExport.exportElementToPdf(element, { filename });
    this.isExportingPdf = false;
  }

  exportReport(): void {
    const dataStr = JSON.stringify(this.allStudents, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `session-${this.sessionCode}-report.json`;
    const link = this.renderer.createElement('a') as HTMLAnchorElement;
    this.renderer.setAttribute(link, 'href', dataUri);
    this.renderer.setAttribute(link, 'download', exportFileDefaultName);
    link.click();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= Math.ceil(this.totalResults / this.resultsPerPage)) {
      this.currentPage = page;
      this.updateDisplayedStudents();
    }
  }

  trackByStudentId(_index: number, student: StudentReport): string {
    return student.id;
  }

  trackByPage(_index: number, page: number): number {
    return page;
  }

  trackBySiteUrl(_index: number, site: VisitedSite): string {
    return site.url;
  }

  trackByTagId(_index: number, tagId: string): string {
    return tagId;
  }

  get totalPages(): number {
    return Math.ceil(this.totalResults / this.resultsPerPage);
  }

  get pages(): number[] {
    const out: number[] = [];
    for (let i = 1; i <= Math.min(3, this.totalPages); i++) out.push(i);
    return out;
  }
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 80) return 'A-';
  if (score >= 75) return 'B+';
  if (score >= 70) return 'B';
  if (score >= 65) return 'B-';
  if (score >= 60) return 'C';
  return 'D';
}

function aggregateVisitedSites(alerts: SessionAlert[]): VisitedSite[] {
  const map = new Map<string, VisitedSite>();
  alerts.forEach((a) => {
    if (!a.tabUrl) return;
    const existing = map.get(a.tabUrl);
    if (existing) {
      existing.count++;
      return;
    }
    let name = a.tabTitle || a.tabUrl;
    try {
      name = new URL(a.tabUrl).hostname.replace(/^www\./, '');
    } catch {
      // keep fallback
    }
    map.set(a.tabUrl, { name, url: a.tabUrl, count: 1, firstSeen: a.timestamp });
  });
  return Array.from(map.values());
}
