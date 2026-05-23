import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { ToastsComponent } from '../../shared/toasts/toasts.component';
import { ToastService } from '../../shared/toasts/toast.service';
import { SessionService } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { EmotionService } from '../../services/emotion.service';
import { ModuleService } from '../../services/module.service';
import { UserService } from '../../services/user.service';
import { Module } from '../../models/module.model';
import { forkJoin } from 'rxjs';

interface AssignmentOption {
  key: string;
  moduleId: number;
  siteName: string;
  moduleTitle: string;
}
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import QRCode from 'qrcode';

@Component({
  selector: 'app-session-creation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, SidebarComponent, TranslateModule, ToastsComponent],
  templateUrl: './session-creation.component.html',
  styleUrls: ['./session-creation.component.css']
})
export class SessionCreationComponent implements OnInit, OnDestroy {
  private readonly toast = inject(ToastService);
  private readonly tr = inject(TranslateService);
  private pendingCreate = false;
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

  qrDataUrl = '';
  observeUrl = '';

  modules: Module[] = [];
  assignmentOptions: AssignmentOption[] = [];
  selectedAssignmentKey = '';
  loadError = '';
  hasModules = false;
  modulesLoaded = false;
  canTeach = false;

  constructor(
    private sessionService: SessionService,
    private emotionService: EmotionService,
    private authService: AuthService,
    private moduleService: ModuleService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.canTeach = this.authService.canTeach();
    this.isInstructor = this.canTeach;
    if (!this.canTeach) return;

    this.loadModules();

    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        if (session) {
          this.sessionGenerated = true;
          this.sessionCode = session.code;
          this.sessionTitle = session.title;
          this.sessionDuration = session.duration;
          this.startPollingConnectedStudents();
          this.generateQrForSession(session.code);
          if (this.pendingCreate) {
            this.pendingCreate = false;
            this.toast.success(this.tr.instant('SESSION_CREATION.CREATED_OK', { code: session.code }));
          }
        } else {
          this.sessionGenerated = false;
          this.sessionCode = '';
          this.qrDataUrl = '';
          this.observeUrl = '';
          this.stopPollingConnectedStudents();
        }
      })
    );

    this.subscription.add(
      this.sessionService.elapsedTime$.subscribe(time => {
        this.elapsedTime = time;
      })
    );

    this.subscription.add(
      this.sessionService.sessionError$.subscribe(msg => {
        this.pendingCreate = false;
        this.toast.error(this.tr.instant('SESSION_CREATION.ERROR_CREATE') + (msg ? `: ${msg}` : ''));
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    this.stopPollingConnectedStudents();
  }

  private loadModules(): void {
    forkJoin({
      modules: this.moduleService.myModules(),
      me: this.userService.me()
    }).subscribe({
      next: ({ modules, me }) => {
        this.modules = modules.filter(m => m.status === 'ACTIVE');
        const moduleById = new Map(this.modules.map(m => [m.id, m]));
        const assignments = me.moduleAssignments ?? [];
        this.assignmentOptions = assignments
          .filter(a => moduleById.has(a.moduleId))
          .map(a => ({
            key: `${a.moduleId}:${a.siteName}`,
            moduleId: a.moduleId,
            siteName: a.siteName,
            moduleTitle: moduleById.get(a.moduleId)?.title ?? `Module ${a.moduleId}`
          }));
        this.hasModules = this.assignmentOptions.length > 0;
        this.loadError = this.hasModules ? '' : 'NO_MODULES';
        this.modulesLoaded = true;
      },
      error: () => {
        this.loadError = 'LOAD_FAILED';
        this.modules = [];
        this.assignmentOptions = [];
        this.hasModules = false;
        this.modulesLoaded = true;
      }
    });
  }

  openModal(): void {
    this.isModalOpen = true;
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.modalTitle = '';
    this.modalDuration = 60;
    this.selectedAssignmentKey = '';
  }

  generateSession(): void {
    if (this.modalDuration <= 0 || !this.selectedAssignmentKey) return;
    const opt = this.assignmentOptions.find(o => o.key === this.selectedAssignmentKey);
    if (!opt) return;
    const sessionTitle = `${opt.moduleTitle} · ${opt.siteName}`;
    this.pendingCreate = true;
    this.sessionService.createSession(sessionTitle, this.modalDuration, opt.moduleId);
    this.closeModal();
  }

  copyCode(): void {
    navigator.clipboard.writeText(this.sessionCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => (this.codeCopied = false), 2000);
    });
  }

  getCodeArray(): string[] {
    return this.sessionCode.split('');
  }

  private startPollingConnectedStudents(): void {
    this.stopPollingConnectedStudents();
    this.updateConnectedStudentsCount();
    this.pollSubscription = interval(5000)
      .pipe(switchMap(() => this.emotionService.getReportCountBySessionCode(this.sessionCode)))
      .subscribe({
        next: count => (this.connectedStudents = count),
        error: () => {}
      });
  }

  private stopPollingConnectedStudents(): void {
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
      this.pollSubscription = undefined;
    }
  }

  private updateConnectedStudentsCount(): void {
    if (!this.sessionCode) return;
    this.emotionService.getReportCountBySessionCode(this.sessionCode).subscribe({
      next: count => (this.connectedStudents = count),
      error: () => {}
    });
  }

  private generateQrForSession(code: string): void {
    const url = `${window.location.origin}/observe?code=${encodeURIComponent(code)}`;
    this.observeUrl = url;
    QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then(dataUrl => (this.qrDataUrl = dataUrl))
      .catch(() => (this.qrDataUrl = ''));
  }
}
