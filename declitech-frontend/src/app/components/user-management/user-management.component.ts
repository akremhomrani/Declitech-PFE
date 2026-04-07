import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { FormsModule } from '@angular/forms';
import { UserFormModalComponent } from './user-form-modal/user-form-modal.component';
import { UserDetailsModalComponent } from './user-details-modal/user-details-modal.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User, PagedUserResponse } from '../../models/user';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, RouterLink, NavbarComponent, SidebarComponent, FormsModule, UserFormModalComponent, UserDetailsModalComponent],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: User[] = [];
  currentPage = 1;
  totalPages = 1;
  totalElements = 0;
  pageSize = 10;
  hasNext = false;
  hasPrevious = false;
  searchTerm = '';
  private searchTimeout: any;

  isModalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  selectedUserId: number | null = null;

  isDetailsModalOpen = false;
  selectedDetailsUserId: number | null = null;

  showBlockModal = false;
  userToBlock: User | null = null;
  blockingUser = false;
  isAdmin = false;

  constructor(private userService: UserService, private authService: AuthService) { }

  ngOnInit() {
    this.isAdmin = this.authService.getRole() === 'ADMIN';
    if (this.isAdmin) {
      this.loadUsers();
    }
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  loadUsers() {
    const page = this.currentPage - 1;

    if (this.searchTerm) {
      const filters = {
        firstName: this.searchTerm,
        lastName: this.searchTerm,
        username: this.searchTerm,
        email: this.searchTerm
      };
      this.userService.filterUsers(filters, page, this.pageSize)
        .subscribe({
          next: (response: PagedUserResponse) => {
            this.users = response.users;
            this.currentPage = response.currentPage + 1;
            this.totalPages = response.totalPages;
            this.totalElements = response.totalElements;
            this.pageSize = response.pageSize;
            this.hasNext = this.currentPage < this.totalPages;
            this.hasPrevious = this.currentPage > 1;
          },
          error: (error: any) => { }
        });
    } else {
      this.userService.getAllUsers(page, this.pageSize)
        .subscribe({
          next: (response: PagedUserResponse) => {
            this.users = response.users;
            this.currentPage = response.currentPage + 1;
            this.totalPages = response.totalPages;
            this.totalElements = response.totalElements;
            this.pageSize = response.pageSize;
            this.hasNext = this.currentPage < this.totalPages;
            this.hasPrevious = this.currentPage > 1;
          },
          error: (error: any) => { }
        });
    }
  }

  onSearch() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadUsers();
    }, 500);
  }

  nextPage() {
    if (this.hasNext) {
      this.currentPage++;
      this.loadUsers();
    }
  }

  previousPage() {
    if (this.hasPrevious) {
      this.currentPage--;
      this.loadUsers();
    }
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

  openCreateModal() {
    this.modalMode = 'create';
    this.selectedUserId = null;
    this.isModalOpen = true;
  }

  openEditModal(userId: number) {
    this.modalMode = 'edit';
    this.selectedUserId = userId;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedUserId = null;
  }

  onUserSaved() {
    this.loadUsers();
  }

  viewUserDetails(userId: number) {
    this.selectedDetailsUserId = userId;
    this.isDetailsModalOpen = true;
  }

  closeDetailsModal() {
    this.isDetailsModalOpen = false;
    this.selectedDetailsUserId = null;
  }

  deleteUser(userId: number) {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(userId)
        .subscribe({
          next: () => {
            this.loadUsers();
          },
          error: (error: any) => {
            alert('Failed to delete user');
          }
        });
    }
  }

  blockUser(userId: number) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      this.userToBlock = user;
      this.showBlockModal = true;
    }
  }

  closeBlockModal(): void {
    this.showBlockModal = false;
    this.userToBlock = null;
  }

  confirmBlockUser(): void {
    if (!this.userToBlock) return;
    this.blockingUser = true;

    if (this.userToBlock.active) {
      this.userService.deleteUser(this.userToBlock.id).subscribe({
        next: () => {
          this.blockingUser = false;
          this.showBlockModal = false;
          this.userToBlock = null;
          this.loadUsers();
        },
        error: () => {
          this.blockingUser = false;
        }
      });
    } else {
      this.userService.unblockUser(this.userToBlock.id).subscribe({
        next: () => {
          this.blockingUser = false;
          this.showBlockModal = false;
          this.userToBlock = null;
          this.loadUsers();
        },
        error: () => {
          this.blockingUser = false;
        }
      });
    }
  }
}
