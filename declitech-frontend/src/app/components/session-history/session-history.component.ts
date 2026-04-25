import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { SessionHistory, PagedSessionResponse } from '../../models/session';
import { SessionFilters } from '../../services/session.service';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, SidebarComponent],
  templateUrl: './session-history.component.html',
  styleUrls: ['./session-history.component.css']
})
export class SessionHistoryComponent implements OnInit, OnDestroy {
  sessions: SessionHistory[] = [];
  isLoading = true;
  searchTerm = '';
  filterStatus: 'all' | 'active' | 'expired' | 'cancelled' = 'all';
  isAdmin = false;
  isInstructor = false;
  currentUsername: string | null = null;

  currentPage = 1;
  totalPages = 1;
  totalElements = 0;
  pageSize = 10;
  hasNext = false;
  hasPrevious = false;

  private readonly SEARCH_DEBOUNCE_MS = 500;
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.authService.getRole();
    this.isAdmin = role === 'ADMIN';
    this.isInstructor = role === 'INSTRUCTOR';
    this.currentUsername = this.authService.getUsername();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  private loadSessions(): void {
    this.isLoading = true;
    const page = this.currentPage - 1;

    const hasFilters = this.searchTerm || this.filterStatus !== 'all' || this.isInstructor;

    if (hasFilters) {
      const filters: SessionFilters = {};
      if (this.searchTerm) {
        filters.search = this.searchTerm;
      }
      if (this.filterStatus === 'active') {
        filters.status = 'ACTIVE';
      } else if (this.filterStatus === 'expired') {
        filters.status = 'ENDED';
      } else if (this.filterStatus === 'cancelled') {
        filters.status = 'CANCELLED';
      }
      if (this.isInstructor && this.currentUsername) {
        filters.instructorUsername = this.currentUsername;
      }

      this.sessionService.filterSessionHistory(filters, page, this.pageSize).subscribe({
        next: (response: PagedSessionResponse) => {
          this.sessions = response.sessions;
          this.currentPage = response.currentPage + 1;
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.pageSize = response.pageSize;
          this.hasNext = this.currentPage < this.totalPages;
          this.hasPrevious = this.currentPage > 1;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
    } else {
      this.sessionService.getSessionHistory(page, this.pageSize).subscribe({
        next: (response: PagedSessionResponse) => {
          this.sessions = response.sessions;
          this.currentPage = response.currentPage + 1;
          this.totalPages = response.totalPages;
          this.totalElements = response.totalElements;
          this.pageSize = response.pageSize;
          this.hasNext = this.currentPage < this.totalPages;
          this.hasPrevious = this.currentPage > 1;
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
        }
      });
    }
  }

  onSearchChange(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadSessions();
    }, this.SEARCH_DEBOUNCE_MS);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadSessions();
  }

  nextPage(): void {
    if (this.hasNext) {
      this.currentPage++;
      this.loadSessions();
    }
  }

  previousPage(): void {
    if (this.hasPrevious) {
      this.currentPage--;
      this.loadSessions();
    }
  }

  getStatusClass(session: SessionHistory): string {
    switch (session.status) {
      case 'ACTIVE':
        return 'bg-emerald-100 text-emerald-700';
      case 'EXPIRED':
        return 'bg-red-100 text-red-700';
      case 'CANCELLED':
        return 'bg-amber-100 text-amber-700';
      case 'ENDED':
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  getStatusText(session: SessionHistory): string {
    switch (session.status) {
      case 'ACTIVE':
        return 'Active';
      case 'EXPIRED':
        return 'Expired';
      case 'CANCELLED':
        return 'Cancelled';
      case 'ENDED':
      default:
        return 'Ended';
    }
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
    return this.sessions.filter(s => s.status === 'ACTIVE').length;
  }

  viewSessionDetails(sessionId: number): void {
    this.router.navigate(['/session/details', sessionId]);
  }
}
