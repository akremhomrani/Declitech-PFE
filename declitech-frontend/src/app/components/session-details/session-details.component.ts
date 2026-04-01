import { Component, OnInit } from '@angular/core';
import jsPDF from 'jspdf';
// @ts-ignore
import html2canvas from 'html2canvas';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { EmotionReport } from '../../models/emotion-report.model';
import { SessionHistory, StudentReport } from '../../models/session';
import { TrackReportService } from '../../services/track-report.service';
import { TrackReport } from '../../models/track-report.model';

@Component({
  selector: 'app-session-details',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, SidebarComponent],
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css']
})
export class SessionDetailsComponent implements OnInit {
  Math = Math;
  sessionId: number | null = null;
  sessionCode: string = '';
  sessionTitle: string = '';
  isLoading: boolean = false;
  
  classAvgFocus: number = 0;
  focusTrend: number = 0;
  mostCommonEmotion: string = 'Loading...';
  emotionPercentage: number = 0;
  criticalAlerts: number = 0;
  alertTrend: number = 0;
  participationScore: string = 'N/A';
  
  searchTerm: string = '';
  dateRange: string = '';
  alertType: string = '';
  
  students: StudentReport[] = [];
  allStudents: StudentReport[] = [];

  currentPage: number = 1;
  totalResults: number = 124;
  resultsPerPage: number = 5;

  trackReports: TrackReport[] = [];
  untransformedReports: EmotionReport[] = [];
  selectedStudent: StudentReport | null = null;
  selectedTrackReport: TrackReport | null = null;
  selectedEmotionReport: EmotionReport | null = null;
  isReportModalOpen: boolean = false;
  isExportingPdf: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private emotionService: EmotionService,
    private sessionService: SessionService,
    private trackReportService: TrackReportService
  ) {}

  ngOnInit(): void {
    this.sessionId = Number(this.route.snapshot.paramMap.get('id'));
    if (this.sessionId) {
      this.loadSessionDetails();
    }
  }

  loadSessionDetails(): void {
    if (!this.sessionId) return;
    
    this.isLoading = true;
    this.sessionService.getSessionById(this.sessionId).subscribe({
      next: (session: SessionHistory) => {
        this.sessionCode = session.sessionCode;
        this.sessionTitle = session.title;
        this.loadSessionReports();
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  loadSessionReports(): void {
    if (!this.sessionCode) return;
    
    this.emotionService.getReportsBySessionCode(this.sessionCode).subscribe({
      next: (reports: EmotionReport[]) => {
        this.untransformedReports = reports;
        this.allStudents = this.transformReportsToStudents(reports);
        this.totalResults = this.allStudents.length;
        this.updateDisplayedStudents();
        this.calculateStatistics(reports);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    this.trackReportService.getTrackReportsBySessionCode(this.sessionCode).subscribe({
      next: (reports: TrackReport[]) => {
        this.trackReports = reports;
      },
      error: (err) => {
        console.error('Failed to load track reports', err);
      }
    });
  }

  transformReportsToStudents(reports: EmotionReport[]): StudentReport[] {
    return reports.map((report, index) => {
      const focusScore = this.calculateFocusScore(report);
      const emotion = this.mapEmotionToLabel(report.dominantEmotion || 'neutral');
      const emotionColor = this.getEmotionColor(report.dominantEmotion || 'neutral');
      
      return {
        id: `#${report.id || index + 1000}`,
        name: report.studentLoginIdentity || 'Student',
        lastSessionDate: this.formatDate(report.generatedAt || report.createdAt || ''),
        avgFocusScore: focusScore,
        topEmotion: emotion,
        emotionColor: emotionColor,
        totalAlerts: this.calculateAlerts(report),
        avatarUrl: `https://i.pravatar.cc/150?img=${(index % 70) + 1}`
      };
    });
  }

  calculateFocusScore(report: EmotionReport): number {
    const happy = (report.happyMean || 0) * 100;
    const neutral = (report.neutralMean || 0) * 100;
    const sad = (report.sadMean || 0) * 100;
    const angry = (report.angryMean || 0) * 100;
    const fear = (report.fearMean || 0) * 100;
    
    const focusScore = (happy * 1.2 + neutral * 0.8) - (sad * 0.5 + angry * 0.7 + fear * 0.6);
    return Math.max(0, Math.min(100, focusScore));
  }

  mapEmotionToLabel(emotion: string): string {
    const emotionMap: { [key: string]: string } = {
      'happy': 'Focused',
      'neutral': 'Steady',
      'sad': 'Disengaged',
      'angry': 'Stressed',
      'fear': 'Anxious',
      'surprise': 'Engaged',
      'disgust': 'Distracted'
    };
    return emotionMap[emotion.toLowerCase()] || emotion;
  }

  getEmotionColor(emotion: string): string {
    const colorMap: { [key: string]: string } = {
      'happy': 'teal',
      'neutral': 'slate',
      'sad': 'slate',
      'angry': 'red',
      'fear': 'amber',
      'surprise': 'teal',
      'disgust': 'red'
    };
    return colorMap[emotion.toLowerCase()] || 'slate';
  }

  calculateAlerts(report: EmotionReport): number {
    let alerts = 0;
    if ((report.angryMean || 0) > 0.3) alerts++;
    if ((report.fearMean || 0) > 0.3) alerts++;
    if ((report.disgustMean || 0) > 0.2) alerts++;
    return alerts;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  calculateStatistics(reports: EmotionReport[]): void {
    if (reports.length === 0) {
      this.classAvgFocus = 0;
      this.mostCommonEmotion = 'No data';
      this.criticalAlerts = 0;
      this.participationScore = 'N/A';
      return;
    }

    const avgFocus = this.allStudents.reduce((sum, s) => sum + s.avgFocusScore, 0) / this.allStudents.length;
    this.classAvgFocus = Math.round(avgFocus * 10) / 10;

    const emotionCounts: { [key: string]: number } = {};
    reports.forEach(report => {
      const emotion = report.dominantEmotion || 'neutral';
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    const mostCommon = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];
    this.mostCommonEmotion = this.mapEmotionToLabel(mostCommon[0]);
    this.emotionPercentage = Math.round((mostCommon[1] / reports.length) * 100);

    this.criticalAlerts = this.allStudents.reduce((sum, s) => sum + s.totalAlerts, 0);

    if (avgFocus >= 90) this.participationScore = 'A+';
    else if (avgFocus >= 85) this.participationScore = 'A';
    else if (avgFocus >= 80) this.participationScore = 'A-';
    else if (avgFocus >= 75) this.participationScore = 'B+';
    else if (avgFocus >= 70) this.participationScore = 'B';
    else if (avgFocus >= 65) this.participationScore = 'B-';
    else if (avgFocus >= 60) this.participationScore = 'C';
    else this.participationScore = 'D';
  }

  updateDisplayedStudents(): void {
    const startIndex = (this.currentPage - 1) * this.resultsPerPage;
    const endIndex = startIndex + this.resultsPerPage;
    this.students = this.allStudents.slice(startIndex, endIndex);
  }

  getEmotionClass(color: string): string {
    const colorMap: { [key: string]: string } = {
      'teal': 'bg-teal-50 text-teal-600 border-teal-100',
      'slate': 'bg-slate-50 text-slate-500 border-slate-100',
      'red': 'bg-red-50 text-red-600 border-red-100',
      'amber': 'bg-amber-50 text-amber-600 border-amber-100'
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
    this.selectedStudent = this.allStudents.find(s => s.id === studentId) || null;
    if (this.selectedStudent) {
      // Find matching track report
      this.selectedTrackReport = this.trackReports.find(t => t.studentIdentity === this.selectedStudent?.name) || null;
      // Find matching original emotion report for precise stats
      this.selectedEmotionReport = this.untransformedReports.find(r => r.studentLoginIdentity === this.selectedStudent?.name) || null;
      this.isReportModalOpen = true;
    }
  }

  closeReportModal(): void {
    this.isReportModalOpen = false;
    this.selectedStudent = null;
    this.selectedTrackReport = null;
    this.selectedEmotionReport = null;
    this.isExportingPdf = false;
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    
    // Split by spaces or dots (e.g., 'ya.benattig' -> ['ya', 'benattig'])
    const parts = name.split(/[\s.]+/).filter(p => p.length > 0);
    
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    
    // Take first letter of first two parts
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  async exportModalToPDF(): Promise<void> {
    const modalElement = document.getElementById('full-report-content');
    if (!modalElement || !this.selectedStudent) return;

    try {
      this.isExportingPdf = true;

      // Wait for Angular change detection to flush
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clone the entire modal so we can expand it without affecting UI
      const clone = modalElement.cloneNode(true) as HTMLElement;

      // Show print header, hide sticky interactive header
      const clonePrintHeaders = clone.querySelectorAll('.print-header');
      clonePrintHeaders.forEach(el => {
        (el as HTMLElement).style.display = 'flex';
        el.classList.remove('hidden');
      });
      const cloneSticky = clone.querySelectorAll('[data-html2canvas-ignore]');
      cloneSticky.forEach(el => (el as HTMLElement).style.display = 'none');

      // Remove interactive-only elements (export button, close button)
      const ignoredEls = clone.querySelectorAll('[data-html2canvas-ignore]');
      ignoredEls.forEach(el => el.parentNode?.removeChild(el));

      // Style the clone for full-height off-screen rendering
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '-9999px';
      clone.style.width = modalElement.scrollWidth + 'px';
      clone.style.height = modalElement.scrollHeight + 'px';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.borderRadius = '0';
      clone.style.zIndex = '-1';
      clone.style.backgroundColor = '#ffffff';
      document.body.appendChild(clone);

      // Small delay to ensure clone is rendered
      await new Promise(resolve => setTimeout(resolve, 150));

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: clone.scrollWidth,
        height: clone.scrollHeight,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
      });

      // Remove clone from DOM
      document.body.removeChild(clone);

      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position -= pageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`Declitech_Report_${this.selectedStudent.name.replace(/\s+/g, '_')}_${dateStr}.pdf`);

    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      this.isExportingPdf = false;
    }
  }

  exportReport(): void {
    const dataStr = JSON.stringify(this.allStudents, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `session-${this.sessionCode}-report.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  changePage(page: number): void {
    if (page >= 1 && page <= Math.ceil(this.totalResults / this.resultsPerPage)) {
      this.currentPage = page;
      this.updateDisplayedStudents();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalResults / this.resultsPerPage);
  }

  get pages(): number[] {
    const pages = [];
    for (let i = 1; i <= Math.min(3, this.totalPages); i++) {
      pages.push(i);
    }
    return pages;
  }
}
