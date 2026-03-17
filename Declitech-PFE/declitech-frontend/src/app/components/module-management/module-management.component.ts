import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { FormsModule } from '@angular/forms';
import { ModuleFormModalComponent } from './module-form-modal/module-form-modal.component';
import { ModuleSessionsModalComponent } from './module-sessions-modal/module-sessions-modal.component';
import { ModuleService } from '../../services/module.service';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { Module, ModuleFilterRequest, SessionInfo } from '../../models/module';
import { interval, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-module-management',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SidebarComponent, FormsModule, ModuleFormModalComponent, ModuleSessionsModalComponent],
  templateUrl: './module-management.component.html',
  styleUrls: ['./module-management.component.css']
})
export class ModuleManagementComponent implements OnInit, OnDestroy {
  modules: Module[] = [];
  searchTerm = '';
  private searchTimeout: any;
  private pollSubscription?: Subscription;

  isModalOpen = false;
  modalMode: 'create' | 'edit' = 'create';
  selectedModuleId: number | null = null;

  // Sessions modal
  isSessionsModalOpen = false;
  selectedModuleSessions: SessionInfo[] = [];
  selectedModuleTitle = '';

  isAdmin = false;
  activeSites = new Set<string>();

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalPages = 0;
  totalItems = 0;
  hasNext = false;
  hasPrevious = false;

  // Math for template
  Math = Math;

  constructor(
    private moduleService: ModuleService,
    private sessionService: SessionService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.isAdmin = this.authService.getRole() === 'ADMIN';
    if (this.isAdmin) {
      this.loadModules();
      this.loadActiveSessions();
      this.startPollingActiveSessions();
    }
  }

  ngOnDestroy() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
  }

  loadModules() {
    const filter: ModuleFilterRequest = {};
    
    if (this.searchTerm) {
      filter.search = this.searchTerm;
    }

    this.moduleService.getModulesPaginated(filter, this.currentPage, this.pageSize)
      .subscribe({
        next: (response) => {
          this.modules = response.modules;
          this.currentPage = response.currentPage;
          this.totalPages = response.totalPages;
          this.totalItems = response.totalItems;
          this.pageSize = response.pageSize;
          this.hasNext = response.hasNext;
          this.hasPrevious = response.hasPrevious;
        },
        error: (error: any) => {
          console.error('Error loading modules:', error);
        }
      });
  }

  loadActiveSessions() {
    this.sessionService.getAllActiveSessions()
      .subscribe({
        next: (sessions) => {
          this.activeSites.clear();
          sessions.forEach(session => {
            // Parse session title to extract module and site
            // Format: "Module Title - Site" or just "Module Title"
            const parts = session.title.split(' - ');
            if (parts.length >= 2 && session.moduleId) {
              const site = parts[parts.length - 1].trim();
              this.activeSites.add(`${session.moduleId}-${site}`);
            }
          });
        },
        error: (error: any) => {
          console.error('Error loading active sessions:', error);
        }
      });
  }

  private startPollingActiveSessions(): void {
    // Poll for active sessions every 10 seconds
    this.pollSubscription = interval(10000)
      .pipe(
        switchMap(() => this.sessionService.getAllActiveSessions())
      )
      .subscribe({
        next: (sessions) => {
          this.activeSites.clear();
          sessions.forEach(session => {
            const parts = session.title.split(' - ');
            if (parts.length >= 2 && session.moduleId) {
              const site = parts[parts.length - 1].trim();
              this.activeSites.add(`${session.moduleId}-${site}`);
            }
          });
        },
        error: () => {}
      });
  }

  isSiteActive(moduleId: number, site: string): boolean {
    return this.activeSites.has(`${moduleId}-${site}`);
  }

  getSiteBadgeClass(moduleId: number, site: string): string {
    if (this.isSiteActive(moduleId, site)) {
      return 'px-2 py-1 bg-green-500 text-white rounded-md text-xs font-medium animate-pulse';
    }
    return 'px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium';
  }

  onSearch() {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 0;
      this.loadModules();
    }, 500);
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadModules();
    }
  }

  nextPage() {
    if (this.hasNext) {
      this.currentPage++;
      this.loadModules();
    }
  }

  previousPage() {
    if (this.hasPrevious) {
      this.currentPage--;
      this.loadModules();
    }
  }

  get pageArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  openCreateModal() {
    this.modalMode = 'create';
    this.selectedModuleId = null;
    this.isModalOpen = true;
  }

  openEditModal(moduleId: number) {
    this.modalMode = 'edit';
    this.selectedModuleId = moduleId;
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.selectedModuleId = null;
  }

  onModuleSaved() {
    this.loadModules();
  }

  deleteModule(moduleId: number) {
    if (confirm('Are you sure you want to delete this module?')) {
      this.moduleService.deleteModule(moduleId)
        .subscribe({
          next: () => {
            this.loadModules();
          },
          error: (error: any) => {
            alert('Failed to delete module');
          }
        });
    }
  }

  viewModuleSessions(moduleId: number) {
    const module = this.modules.find(m => m.id === moduleId);
    this.selectedModuleTitle = module ? module.title : 'Unknown Module';
    
    this.moduleService.getModuleSessions(moduleId)
      .subscribe({
        next: (sessions) => {
          this.selectedModuleSessions = sessions;
          this.isSessionsModalOpen = true;
        },
        error: (error: any) => {
          console.error('Error loading module sessions:', error);
          alert('Failed to load module sessions');
        }
      });
  }

  closeSessionsModal() {
    this.isSessionsModalOpen = false;
    this.selectedModuleSessions = [];
    this.selectedModuleTitle = '';
  }
}
