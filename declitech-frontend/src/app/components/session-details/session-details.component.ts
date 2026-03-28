import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { EmotionService } from '../../services/emotion.service';
import { SessionService } from '../../services/session.service';
import { EmotionReport } from '../../models/emotion-report.model';
import { SessionHistory, StudentReport } from '../../models/session';

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

  constructor(
    private route: ActivatedRoute,
    private emotionService: EmotionService,
    private sessionService: SessionService
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
    this.updateDisplayedStudents();
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
