import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModuleService } from '../../../services/module.service';
import { CreateModuleRequest, UpdateModuleRequest } from '../../../models/module';

@Component({
  selector: 'app-module-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './module-form-modal.component.html',
  styleUrls: ['./module-form-modal.component.css']
})
export class ModuleFormModalComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Input() moduleId: number | null = null;
  @Input() mode: 'create' | 'edit' = 'create';
  @Output() closeModal = new EventEmitter<void>();
  @Output() moduleSaved = new EventEmitter<void>();

  module: any = {
    title: '',
    description: '',
    sites: []
  };

  newSite = '';
  isLoading = false;
  errorMessage = '';

  constructor(private moduleService: ModuleService) {}

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen'] && this.isOpen && this.mode === 'edit' && this.moduleId) {
      this.loadModule();
    } else if (changes['isOpen'] && this.isOpen && this.mode === 'create') {
      this.resetForm();
    }
  }

  loadModule() {
    this.isLoading = true;
    this.moduleService.getModuleById(this.moduleId!)
      .subscribe({
        next: (module) => {
          this.module = {
            title: module.title,
            description: module.description,
            sites: [...module.sites]
          };
          this.isLoading = false;
        },
        error: (error: any) => {
          this.errorMessage = 'Failed to load module details';
          this.isLoading = false;
        }
      });
  }

  saveModule() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const request = this.mode === 'create'
      ? this.moduleService.createModule(this.module as CreateModuleRequest)
      : this.moduleService.updateModule(this.moduleId!, this.module as UpdateModuleRequest);

    request.subscribe({
      next: () => {
        this.isLoading = false;
        this.moduleSaved.emit();
        this.close();
      },
      error: (error: any) => {
        this.errorMessage = error.error?.message || 'Failed to save module';
        this.isLoading = false;
      }
    });
  }

  validateForm(): boolean {
    if (!this.module.title || this.module.title.trim().length < 3) {
      this.errorMessage = 'Title must be at least 3 characters long';
      return false;
    }

    if (this.module.sites.length === 0) {
      this.errorMessage = 'At least one site location is required';
      return false;
    }

    return true;
  }

  addSite() {
    if (this.newSite && this.newSite.trim() !== '') {
      const trimmedSite = this.newSite.trim();
      if (!this.module.sites.includes(trimmedSite)) {
        this.module.sites.push(trimmedSite);
        this.newSite = '';
      } else {
        this.errorMessage = 'This site location already exists';
      }
    }
  }

  removeSite(index: number) {
    this.module.sites.splice(index, 1);
  }

  close() {
    this.closeModal.emit();
    this.resetForm();
  }

  resetForm() {
    this.module = {
      title: '',
      description: '',
      sites: []
    };
    this.newSite = '';
    this.errorMessage = '';
  }
}
