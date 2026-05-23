import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { NavbarComponent } from '../../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../../shared/sidebar/sidebar.component';
import { ConfirmModalComponent } from '../../../shared/confirm-modal/confirm-modal.component';
import { ToastsComponent } from '../../../shared/toasts/toasts.component';
import { ToastService } from '../../../shared/toasts/toast.service';
import { ModuleService } from '../../../services/module.service';
import { SessionService } from '../../../services/session.service';
import { CreateModuleRequest, Module, UpdateModuleRequest } from '../../../models/module.model';

interface ModuleForm {
  title: string;
  description: string;
  sites: string[];
  newSite: string;
}

@Component({
  selector: 'app-admin-modules',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, NavbarComponent, SidebarComponent, ConfirmModalComponent, ToastsComponent],
  templateUrl: './modules.component.html',
  styleUrls: ['./modules.component.css']
})
export class AdminModulesComponent implements OnInit {
  private readonly moduleService = inject(ModuleService);
  private readonly sessionService = inject(SessionService);
  private readonly t = inject(TranslateService);
  private readonly toast = inject(ToastService);

  readonly Math = Math;

  modules: Module[] = [];
  filteredModules: Module[] = [];
  isLoading = false;
  error = '';
  searchTerm = '';

  currentPage = 0;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;
  hasNext = false;
  hasPrevious = false;

  modalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  editingId: number | null = null;
  form: ModuleForm = this.emptyForm();
  formError = '';
  saving = false;

  showArchiveModal = false;
  moduleToArchive: Module | null = null;
  archiving = false;

  private activeModuleIds = new Set<number>();
  private litSiteKeys = new Set<string>();

  get archiveModalMessage(): string {
    return this.t.instant('ADMIN.MODULES.CONFIRM_ARCHIVE', { title: this.moduleToArchive?.title });
  }

  ngOnInit(): void {
    this.refresh();
  }

  get pageArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  refresh(): void {
    this.isLoading = true;
    this.error = '';
    forkJoin({
      page: this.moduleService.listPaged(this.currentPage, this.pageSize),
      sessions: this.sessionService.getAllActiveSessions()
    }).subscribe({
      next: ({ page, sessions }) => {
        this.modules = page.content;
        this.totalItems = page.totalElements;
        this.totalPages = page.totalPages;
        this.hasNext = this.currentPage < this.totalPages - 1;
        this.hasPrevious = this.currentPage > 0;
        this.activeModuleIds = new Set(
          sessions.filter(s => s.moduleId != null).map(s => s.moduleId as number)
        );
        this.litSiteKeys = new Set(
          sessions
            .filter(s => s.moduleId != null && s.siteName)
            .map(s => `${s.moduleId}:${s.siteName}`)
        );
        this.applySearch();
        this.isLoading = false;
      },
      error: () => {
        this.error = this.t.instant('ADMIN.MODULES.ERROR_LOAD');
        this.isLoading = false;
      }
    });
  }

  isModuleActive(moduleId: number): boolean {
    return this.activeModuleIds.has(moduleId);
  }

  isSiteLit(moduleId: number, site: string): boolean {
    return this.litSiteKeys.has(`${moduleId}:${site}`);
  }

  getSiteBadgeClass(moduleId: number, site: string): string {
    const base = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium transition-all';
    if (this.isSiteLit(moduleId, site)) {
      return `${base} bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 ring-1 ring-green-300 dark:ring-green-600 shadow-sm shadow-green-200 dark:shadow-green-900/50`;
    }
    return `${base} bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400`;
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
    if (!q) {
      this.filteredModules = [...this.modules];
      return;
    }
    this.filteredModules = this.modules.filter(m =>
      m.title.toLowerCase().includes(q) ||
      (m.description ?? '').toLowerCase().includes(q) ||
      m.sites.some(s => s.toLowerCase().includes(q))
    );
  }

  openCreate(): void {
    this.modalMode = 'create';
    this.editingId = null;
    this.form = this.emptyForm();
    this.formError = '';
    this.modalOpen = true;
  }

  openEdit(module: Module): void {
    this.modalMode = 'edit';
    this.editingId = module.id;
    this.form = {
      title: module.title,
      description: module.description ?? '',
      sites: [...module.sites],
      newSite: ''
    };
    this.formError = '';
    this.modalOpen = true;
  }

  close(): void {
    this.modalOpen = false;
    this.editingId = null;
  }

  addSite(): void {
    const value = this.form.newSite.trim();
    if (!value || this.form.sites.includes(value)) {
      this.form.newSite = '';
      return;
    }
    this.form.sites.push(value);
    this.form.newSite = '';
  }

  removeSite(site: string): void {
    this.form.sites = this.form.sites.filter(s => s !== site);
  }

  save(): void {
    this.formError = '';
    if (!this.form.title) {
      this.formError = this.t.instant('ADMIN.MODULES.VALIDATION_TITLE');
      return;
    }
    this.saving = true;
    if (this.modalMode === 'create') {
      const req: CreateModuleRequest = {
        title: this.form.title,
        description: this.form.description || undefined,
        sites: this.form.sites
      };
      const title = this.form.title;
      this.moduleService.create(req).subscribe({
        next: () => {
          this.saving = false;
          this.close();
          this.toast.success(this.t.instant('ADMIN.MODULES.CREATED_OK', { title }));
          this.refresh();
        },
        error: err => {
          this.saving = false;
          this.formError = err?.error?.error || this.t.instant('ADMIN.MODULES.ERROR_CREATE');
        }
      });
    } else if (this.editingId !== null) {
      const req: UpdateModuleRequest = {
        title: this.form.title,
        description: this.form.description,
        sites: this.form.sites
      };
      const title = this.form.title;
      this.moduleService.update(this.editingId, req).subscribe({
        next: () => {
          this.saving = false;
          this.close();
          this.toast.success(this.t.instant('ADMIN.MODULES.UPDATED_OK', { title }));
          this.refresh();
        },
        error: err => {
          this.saving = false;
          this.formError = err?.error?.error || this.t.instant('ADMIN.MODULES.ERROR_UPDATE');
        }
      });
    }
  }

  archive(module: Module): void {
    this.moduleToArchive = module;
    this.showArchiveModal = true;
  }

  closeArchiveModal(): void {
    if (this.archiving) return;
    this.showArchiveModal = false;
    this.moduleToArchive = null;
  }

  confirmArchive(): void {
    if (!this.moduleToArchive) return;
    const target = this.moduleToArchive;
    this.archiving = true;
    this.moduleService.archive(target.id).subscribe({
      next: () => {
        this.archiving = false;
        this.showArchiveModal = false;
        this.moduleToArchive = null;
        this.toast.success(this.t.instant('ADMIN.MODULES.ARCHIVED_OK', { title: target.title }));
        this.refresh();
      },
      error: () => {
        this.archiving = false;
        this.toast.error(this.t.instant('ADMIN.MODULES.ERROR_ARCHIVE'));
      }
    });
  }

  private emptyForm(): ModuleForm {
    return { title: '', description: '', sites: [], newSite: '' };
  }
}
