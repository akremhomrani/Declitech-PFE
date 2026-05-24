import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { UserDetailsModalComponent } from './user-details-modal.component';
import { UserService } from '../../../services/user.service';
import { ModuleService } from '../../../services/module.service';
import { CreateUserRequest, ModuleAssignment, UpdateUserRequest, User, UserRole, UserStatus } from '../../../models/user.model';
import { Module } from '../../../models/module.model';
import { ConfirmModalComponent, ConfirmVariant } from '../../../shared/confirm-modal/confirm-modal.component';
import { ToastsComponent } from '../../../shared/toasts/toasts.component';
import { ToastService } from '../../../shared/toasts/toast.service';

interface UserForm {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: UserRole;
  status: UserStatus;
  moduleAssignments: ModuleAssignment[];
}

interface ModuleSiteOption {
  moduleId: number;
  moduleTitle: string;
  siteName: string;
  key: string;
  ownerUsername: string | null;
  ownedByEditingUser: boolean;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NavbarComponent, SidebarComponent, UserDetailsModalComponent, ConfirmModalComponent, ToastsComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class AdminUsersComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly moduleService = inject(ModuleService);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);

  readonly Math = Math;

  users: User[] = [];
  filteredUsers: User[] = [];
  modules: Module[] = [];
  isLoading = false;
  error = '';
  searchTerm = '';
  roleFilter: UserRole | 'ALL' = 'ALL';
  statusFilter: UserStatus | 'ALL' = 'ALL';
  viewMode: 'rows' | 'grid' = 'rows';
  readonly roleOrder: UserRole[] = ['ADMIN', 'INSTRUCTEUR', 'FREELANCER'];

  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  hasNext = false;
  hasPrevious = false;

  modalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;
  form: UserForm = this.emptyForm();
  formError = '';
  saving = false;

  detailsOpen = false;
  detailsUserId: number | null = null;

  modulePickerPage = 0;
  readonly modulePickerSize = 4;

  showBlockModal = false;
  userToBlock: User | null = null;
  blockingUser = false;

  get blockModalTitle(): string {
    return this.t.instant(this.userToBlock?.status === 'ACTIVE' ? 'ADMIN.USERS.BLOCK_TITLE' : 'ADMIN.USERS.UNBLOCK_TITLE');
  }

  get blockModalMessage(): string {
    return this.t.instant(
      this.userToBlock?.status === 'ACTIVE' ? 'ADMIN.USERS.CONFIRM_BLOCK' : 'ADMIN.USERS.CONFIRM_UNBLOCK',
      { name: this.userToBlock?.username }
    );
  }

  get blockModalHint(): string {
    return this.t.instant(this.userToBlock?.status === 'ACTIVE' ? 'ADMIN.USERS.BLOCK_HINT' : 'ADMIN.USERS.UNBLOCK_HINT');
  }

  get blockModalConfirmLabel(): string {
    return this.t.instant(this.userToBlock?.status === 'ACTIVE' ? 'ADMIN.USERS.BLOCK' : 'ADMIN.USERS.UNBLOCK');
  }

  get blockModalIcon(): string {
    return this.userToBlock?.status === 'ACTIVE' ? 'block' : 'check_circle';
  }

  get blockModalVariant(): ConfirmVariant {
    return this.userToBlock?.status === 'ACTIVE' ? 'danger' : 'success';
  }

  ngOnInit(): void {
    this.refresh();
    this.moduleService.list().subscribe({
      next: m => (this.modules = m),
      error: () => {}
    });
  }

  get activeCount(): number {
    return this.users.filter(u => u.status === 'ACTIVE').length;
  }

  get inactiveCount(): number {
    return this.users.filter(u => u.status !== 'ACTIVE').length;
  }

  get pageArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  refresh(): void {
    this.isLoading = true;
    this.error = '';
    this.userService.list(this.currentPage, this.pageSize).subscribe({
      next: page => {
        this.users = page.content;
        this.totalElements = page.totalElements;
        this.totalPages = page.totalPages;
        this.hasNext = this.currentPage < this.totalPages - 1;
        this.hasPrevious = this.currentPage > 0;
        this.applySearch();
        this.isLoading = false;
      },
      error: () => {
        this.error = this.t.instant('ADMIN.USERS.ERROR_LOAD');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    this.applySearch();
  }

  previousPage(): void {
    if (!this.hasPrevious) return;
    this.currentPage--;
    this.refresh();
  }

  nextPage(): void {
    if (!this.hasNext) return;
    this.currentPage++;
    this.refresh();
  }

  goToPage(page: number): void {
    if (page === this.currentPage || page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
    this.refresh();
  }

  private applySearch(): void {
    const q = this.searchTerm.trim().toLowerCase();
    this.filteredUsers = this.users.filter(u => {
      if (this.roleFilter !== 'ALL' && u.role !== this.roleFilter) return false;
      if (this.statusFilter !== 'ALL' && u.status !== this.statusFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }

  setRoleFilter(role: UserRole | 'ALL'): void {
    this.roleFilter = role;
    this.applySearch();
  }

  setStatusFilter(status: UserStatus | 'ALL'): void {
    this.statusFilter = status;
    this.applySearch();
  }

  setView(mode: 'rows' | 'grid'): void {
    this.viewMode = mode;
  }

  roleCount(role: UserRole): number {
    return this.users.filter(u => u.role === role).length;
  }

  assignmentCount(user: User): number {
    return user.moduleAssignments?.length ?? 0;
  }

  hasActiveFilters(): boolean {
    return this.roleFilter !== 'ALL' || this.statusFilter !== 'ALL' || this.searchTerm.trim().length > 0;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.roleFilter = 'ALL';
    this.statusFilter = 'ALL';
    this.applySearch();
  }

  getInitials(first?: string | null, last?: string | null): string {
    const f = (first ?? '').trim().charAt(0).toUpperCase();
    const l = (last ?? '').trim().charAt(0).toUpperCase();
    return (f + l) || '?';
  }

  getRoleBadgeClass(role: string): string {
    const base = 'px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold';
    if (role === 'ADMIN') return `${base} bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300`;
    if (role === 'FREELANCER') return `${base} bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300`;
    return `${base} bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300`;
  }

  openCreate(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.form = this.emptyForm();
    this.formError = '';
    this.modulePickerPage = 0;
    this.modalOpen = true;
  }

  openEdit(user: User): void {
    this.modalMode = 'edit';
    this.editingId = user.id;
    this.form = {
      username: user.username,
      email: user.email,
      password: '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      phoneNumber: user.phoneNumber ?? '',
      role: user.role,
      status: user.status,
      moduleAssignments: (user.moduleAssignments ?? []).map(a => ({ ...a }))
    };
    this.formError = '';
    this.modulePickerPage = 0;
    this.modalOpen = true;
  }

  close(): void {
    this.modalOpen = false;
    this.editingId = null;
  }

  get moduleSiteOptions(): ModuleSiteOption[] {
    const ownerByKey = new Map<string, string>();
    for (const u of this.users) {
      for (const a of (u.moduleAssignments ?? [])) {
        ownerByKey.set(`${a.moduleId}:${a.siteName}`, u.username);
      }
    }
    const editingUsername = this.editingId != null
      ? this.users.find(u => u.id === this.editingId)?.username ?? null
      : null;

    const opts: ModuleSiteOption[] = [];
    for (const m of this.modules) {
      if (!m.sites || m.sites.length === 0) continue;
      for (const s of m.sites) {
        const key = `${m.id}:${s}`;
        const owner = ownerByKey.get(key) ?? null;
        opts.push({
          moduleId: m.id,
          moduleTitle: m.title,
          siteName: s,
          key,
          ownerUsername: owner,
          ownedByEditingUser: !!owner && !!editingUsername && owner === editingUsername
        });
      }
    }
    return opts;
  }

  isOptionLocked(opt: ModuleSiteOption): boolean {
    return !!opt.ownerUsername && !opt.ownedByEditingUser;
  }

  get pagedModuleOptions(): ModuleSiteOption[] {
    const start = this.modulePickerPage * this.modulePickerSize;
    return this.moduleSiteOptions.slice(start, start + this.modulePickerSize);
  }

  get modulePickerTotalPages(): number {
    return Math.ceil(this.moduleSiteOptions.length / this.modulePickerSize);
  }

  modulePickerPrev(): void {
    if (this.modulePickerPage > 0) this.modulePickerPage--;
  }

  modulePickerNext(): void {
    if (this.modulePickerPage < this.modulePickerTotalPages - 1) this.modulePickerPage++;
  }

  toggleAssignment(opt: ModuleSiteOption): void {
    if (this.isOptionLocked(opt)) {
      this.toast.error(this.t.instant('ADMIN.USERS.OWNED_BY', {
        module: opt.moduleTitle, site: opt.siteName, name: opt.ownerUsername
      }));
      return;
    }
    const idx = this.form.moduleAssignments.findIndex(a => a.moduleId === opt.moduleId && a.siteName === opt.siteName);
    if (idx >= 0) this.form.moduleAssignments.splice(idx, 1);
    else this.form.moduleAssignments.push({ moduleId: opt.moduleId, siteName: opt.siteName });
  }

  isAssigned(opt: ModuleSiteOption): boolean {
    return this.form.moduleAssignments.some(a => a.moduleId === opt.moduleId && a.siteName === opt.siteName);
  }

  removeAssignment(a: ModuleAssignment): void {
    this.form.moduleAssignments = this.form.moduleAssignments.filter(x => !(x.moduleId === a.moduleId && x.siteName === a.siteName));
  }

  moduleTitleFor(moduleId: number): string {
    return this.modules.find(m => m.id === moduleId)?.title ?? '?';
  }

  onRoleChange(): void {
    if (this.form.role === 'ADMIN') {
      this.form.moduleAssignments = [];
    }
  }

  save(): void {
    this.formError = '';
    if (!this.form.username || !this.form.email || !this.form.role) {
      this.formError = this.t.instant('ADMIN.USERS.VALIDATION_REQUIRED');
      return;
    }
    if (this.modalMode === 'create' && !this.form.password) {
      this.formError = this.t.instant('ADMIN.USERS.VALIDATION_PASSWORD');
      return;
    }
    this.saving = true;
    if (this.modalMode === 'create') {
      const assignments = this.form.role === 'ADMIN' ? [] : this.form.moduleAssignments;
      const req: CreateUserRequest = {
        username: this.form.username,
        email: this.form.email,
        password: this.form.password,
        firstName: this.form.firstName || undefined,
        lastName: this.form.lastName || undefined,
        phoneNumber: this.form.phoneNumber || undefined,
        role: this.form.role,
        moduleAssignments: assignments
      };
      const username = this.form.username;
      this.userService.create(req).subscribe({
        next: () => {
          this.saving = false;
          this.close();
          this.toast.success(this.t.instant('ADMIN.USERS.CREATED_OK', { name: username }));
          this.refresh();
        },
        error: err => {
          this.saving = false;
          this.formError = err?.error?.error || this.t.instant('ADMIN.USERS.ERROR_CREATE');
        }
      });
    } else if (this.editingId !== null) {
      const assignments = this.form.role === 'ADMIN' ? [] : this.form.moduleAssignments;
      const req: UpdateUserRequest = {
        email: this.form.email,
        firstName: this.form.firstName,
        lastName: this.form.lastName,
        phoneNumber: this.form.phoneNumber || undefined,
        role: this.form.role,
        moduleAssignments: assignments
      };
      const username = this.form.username;
      this.userService.update(this.editingId, req).subscribe({
        next: () => {
          this.saving = false;
          this.close();
          this.toast.success(this.t.instant('ADMIN.USERS.UPDATED_OK', { name: username }));
          this.refresh();
        },
        error: err => {
          this.saving = false;
          this.formError = err?.error?.error || this.t.instant('ADMIN.USERS.ERROR_UPDATE');
        }
      });
    }
  }

  viewDetails(user: User): void {
    this.detailsUserId = user.id;
    this.detailsOpen = true;
  }

  closeDetails(): void {
    this.detailsOpen = false;
    this.detailsUserId = null;
  }

  block(user: User): void {
    this.userToBlock = user;
    this.showBlockModal = true;
  }

  closeBlockModal(): void {
    if (this.blockingUser) return;
    this.showBlockModal = false;
    this.userToBlock = null;
  }

  confirmBlockUser(): void {
    if (!this.userToBlock) return;
    const willBlock = this.userToBlock.status === 'ACTIVE';
    const user = this.userToBlock;
    this.blockingUser = true;

    const req: UpdateUserRequest = { status: willBlock ? 'INACTIVE' : 'ACTIVE' };
    this.userService.update(user.id, req).subscribe({
      next: () => {
        this.blockingUser = false;
        this.showBlockModal = false;
        this.userToBlock = null;
        this.toast.success(this.t.instant(
          willBlock ? 'ADMIN.USERS.BLOCKED_OK' : 'ADMIN.USERS.UNBLOCKED_OK',
          { name: user.username }
        ));
        this.refresh();
      },
      error: () => {
        this.blockingUser = false;
        this.toast.error(this.t.instant(
          willBlock ? 'ADMIN.USERS.ERROR_BLOCK' : 'ADMIN.USERS.ERROR_UNBLOCK'
        ));
      }
    });
  }

  private emptyForm(): UserForm {
    return {
      username: '',
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      role: 'INSTRUCTEUR',
      status: 'ACTIVE',
      moduleAssignments: []
    };
  }

  onPhoneInput(value: string): void {
    this.form.phoneNumber = (value || '').replace(/\D/g, '').slice(0, 8);
  }

  formatPhone(phone?: string | null): string {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 8) return `+216 ${digits}`;
    return `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)}`;
  }
}
