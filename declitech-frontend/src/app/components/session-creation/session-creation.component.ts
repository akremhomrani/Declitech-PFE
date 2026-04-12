import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { ModuleService } from '../../services/module.service';
import { AuthService } from '../../services/auth.service';
import { EmotionService } from '../../services/emotion.service';
import { Module } from '../../models/module';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-session-creation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, SidebarComponent],
  templateUrl: './session-creation.component.html',
  styleUrls: ['./session-creation.component.css']
})
export class SessionCreationComponent implements OnInit, OnDestroy {
  sessionGenerated = false;
  sessionCode = '';
  sessionTitle = '';
  sessionDuration = 0;
  connectedStudents = 0;
  elapsedTime = '0m 0s';
  isInstructor = false;

  private subscription = new Subscription();
  private pollSubscription?: Subscription;

  isModalOpen = false;
  modalTitle = '';
  modalDuration = 90;
  codeCopied = false;

  modules: Module[] = [];
  availableLocations: string[] = [];
  selectedLocation: string = '';
  selectedModuleId: string = '';
  modalStep: number = 1;

  get modulesForSelectedLocation(): Module[] {
    if (!this.selectedLocation) return [];
    return this.modules.filter(m => m.sites && m.sites.includes(this.selectedLocation));
  }

  constructor(
    private sessionService: SessionService,
    private moduleService: ModuleService,
    private emotionService: EmotionService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.isInstructor = this.authService.getRole() === 'INSTRUCTOR';

    if (!this.isInstructor) {
      return;
    }

    this.loadModules();

    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        if (session) {
          this.sessionGenerated = true;
          this.sessionCode = session.code;
          this.sessionTitle = session.title;
          this.sessionDuration = session.duration;
          this.startPollingConnectedStudents();
        } else {
          this.sessionGenerated = false;
          this.sessionCode = '';
          this.stopPollingConnectedStudents();
        }
      })
    );

    this.subscription.add(
      this.sessionService.elapsedTime$.subscribe(time => {
        this.elapsedTime = time;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.stopPollingConnectedStudents();
  }

  private startPollingConnectedStudents(): void {
    this.stopPollingConnectedStudents();

    this.updateConnectedStudentsCount();

    this.pollSubscription = interval(5000)
      .pipe(
        switchMap(() => this.emotionService.getReportCountBySessionCode(this.sessionCode))
      )
      .subscribe({
        next: (count) => {
          this.connectedStudents = count;
        },
        error: () => { }
      });
  }

  private stopPollingConnectedStudents(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = undefined;
    }
  }

  private updateConnectedStudentsCount(): void {
    if (this.sessionCode) {
      this.emotionService.getReportCountBySessionCode(this.sessionCode).subscribe({
        next: (count) => {
          this.connectedStudents = count;
        },
        error: () => { }
      });
    }
  }

  private loadModules(): void {
    this.moduleService.getAllModules().subscribe({
      next: (modules) => {
        this.modules = modules;
        this.buildModuleOptions();
      },
      error: (error) => {
        console.error('Error loading modules:', error);
      }
    });
  }

  private buildModuleOptions(): void {
    const locationSet = new Set<string>();
    this.modules.forEach(module => {
      if (module.sites) {
        module.sites.forEach(site => locationSet.add(site));
      }
    });
    this.availableLocations = Array.from(locationSet).sort();
  }

  onLocationChange(): void {
    this.selectedModuleId = '';
  }

  goToModuleStep(): void {
    if (this.selectedLocation) {
      this.modalStep = 2;
    }
  }

  backToLocationStep(): void {
    this.selectedModuleId = '';
    this.modalStep = 1;
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.modalTitle = '';
    this.modalDuration = 60;
    this.selectedLocation = '';
    this.selectedModuleId = '';
    this.modalStep = 1;
  }

  generateSession(): void {
    if (!this.selectedModuleId || this.modalDuration <= 0) {
      return;
    }

    const moduleId = parseInt(this.selectedModuleId);
    const selectedModule = this.modules.find(m => m.id === moduleId);
    const sessionTitle = selectedModule
      ? `${selectedModule.title} - ${this.selectedLocation}`
      : 'Session';

    this.sessionService.createSession(sessionTitle, this.modalDuration, moduleId);
    this.closeModal();
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.sessionCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => this.codeCopied = false, 2000);
    });
  }

  getCodeArray(): string[] {
    return this.sessionCode.split('');
  }
}