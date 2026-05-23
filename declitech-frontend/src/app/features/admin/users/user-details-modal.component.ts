import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { User } from '../../../models/user.model';
import { Module } from '../../../models/module.model';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-user-details-modal',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './user-details-modal.component.html',
  styleUrls: ['./user-details-modal.component.css']
})
export class UserDetailsModalComponent {
  @Input() isOpen = false;
  @Input() userId: number | null = null;
  @Input() modules: Module[] = [];
  @Output() closeModal = new EventEmitter<void>();

  get assignedModules(): Module[] {
    if (!this.user || !this.modules.length) return [];
    const ids = new Set(this.user.moduleIds);
    return this.modules.filter(m => ids.has(m.id));
  }

  get assignmentPairs(): { moduleTitle: string; siteName: string }[] {
    if (!this.user) return [];
    return (this.user.moduleAssignments ?? []).map(a => ({
      moduleTitle: this.modules.find(m => m.id === a.moduleId)?.title ?? '?',
      siteName: a.siteName
    }));
  }

  private readonly userService = inject(UserService);
  private readonly t = inject(TranslateService);

  user: User | null = null;
  isLoading = false;
  errorMessage = '';

  ngOnChanges(): void {
    if (this.isOpen && this.userId != null) {
      this.fetch(this.userId);
    } else if (!this.isOpen) {
      this.user = null;
      this.errorMessage = '';
    }
  }

  fetch(id: number): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.userService.getById(id).subscribe({
      next: u => {
        this.user = u;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.t.instant('ADMIN.USERS.DETAILS.ERROR_LOAD');
        this.isLoading = false;
      }
    });
  }

  close(): void {
    this.closeModal.emit();
  }

  formatPhone(phone?: string | null): string {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 8) return `+216 ${digits}`;
    return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }

  getInitials(first?: string | null, last?: string | null): string {
    const f = (first ?? '').trim().charAt(0).toUpperCase();
    const l = (last ?? '').trim().charAt(0).toUpperCase();
    return (f + l) || '?';
  }

  getRoleBadgeClass(role: string): string {
    const base = 'px-3 py-1 rounded-full text-xs font-semibold';
    if (role === 'ADMIN') return `${base} bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300`;
    if (role === 'FREELANCER') return `${base} bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300`;
    return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`;
  }
}
