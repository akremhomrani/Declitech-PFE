import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { HttpClient } from '@angular/common/http';

interface SessionHistory {
  id: number;
  sessionCode: string;
  title: string;
  instructorId: number;
  durationHours: number;
  participantCount: number;
  reportCount: number;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
  expiresAt: string;
}

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, SidebarComponent],
  templateUrl: './session-history.component.html',
  styleUrls: ['./session-history.component.css']
})
export class SessionHistoryComponent implements OnInit {
  sessions: SessionHistory[] = [];
  filteredSessions: SessionHistory[] = [];
  isLoading = true;
  searchTerm = '';
  filterStatus: 'all' | 'active' | 'expired' = 'all';

  private apiUrl = 'http://localhost:8084/api/sessions';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.isLoading = true;
    this.http.get<SessionHistory[]>(`${this.apiUrl}/history`).subscribe({
      next: (sessions) => {
        this.sessions = sessions.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading sessions:', error);
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let result = [...this.sessions];

    // Filter by status
    if (this.filterStatus === 'active') {
      result = result.filter(s => s.isActive && !s.isExpired);
    } else if (this.filterStatus === 'expired') {
      result = result.filter(s => !s.isActive || s.isExpired);
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(s => 
        s.sessionCode.toLowerCase().includes(term) ||
        s.title.toLowerCase().includes(term)
      );
    }

    this.filteredSessions = result;
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  getStatusClass(session: SessionHistory): string {
    if (session.isActive && !session.isExpired) {
      return 'bg-emerald-100 text-emerald-700';
    }
    return 'bg-slate-100 text-slate-600';
  }

  getStatusText(session: SessionHistory): string {
    if (session.isActive && !session.isExpired) {
      return 'Active';
    }
    if (session.isExpired) {
      return 'Expired';
    }
    return 'Ended';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    return `${hours.toFixed(1)} hr`;
  }

  getTotalParticipants(): number {
    return this.sessions.reduce((sum, s) => sum + s.participantCount, 0);
  }

  getTotalReports(): number {
    return this.sessions.reduce((sum, s) => sum + s.reportCount, 0);
  }

  getActiveCount(): number {
    return this.sessions.filter(s => s.isActive && !s.isExpired).length;
  }
}
