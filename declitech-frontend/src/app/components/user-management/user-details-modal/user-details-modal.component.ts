import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user/user.model';

@Component({
  selector: 'app-user-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-details-modal.component.html',
  styleUrls: ['./user-details-modal.component.css']
})
export class UserDetailsModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() userId: number | null = null;
  @Output() closeModal = new EventEmitter<void>();

  user: User | null = null;
  isLoading = false;
  errorMessage = '';

  constructor(private userService: UserService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen && this.userId) {
      this.loadUser();
    }
  }

  loadUser() {
    if (!this.userId) return;
    
    this.isLoading = true;
    this.errorMessage = '';
    this.userService.getUserById(this.userId)
      .subscribe({
        next: (user) => {
          this.user = user;
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Error loading user:', error);
          this.errorMessage = 'Failed to load user details';
          this.isLoading = false;
        }
      });
  }

  close() {
    this.closeModal.emit();
    this.user = null;
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  }

  formatPhoneNumber(phone: string): string {
    if (!phone) return 'N/A';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 8 || digits.startsWith('1') || digits.startsWith('0')) {
      return 'Invalid';
    }
    const formatted = `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
    return `+216 ${formatted}`;
  }

  getRoleBadgeClass(role: string): string {
    const baseClasses = 'px-3 py-1 rounded-full text-xs font-semibold';
    switch (role) {
      case 'ADMIN':
        return `${baseClasses} bg-purple-100 text-purple-700`;
      case 'INSTRUCTOR':
        return `${baseClasses} bg-blue-100 text-blue-700`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-700`;
    }
  }
}
