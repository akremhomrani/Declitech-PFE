import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { IamService } from '../../services/iam.service';
import { AuthService } from '../../services/auth.service';
import { EmotionService } from '../../services/emotion.service';
import { IamSite, IamModule } from '../../models/iam/iam-site.model';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import QRCode from 'qrcode';

@Component({
  selector: 'app-session-creation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NavbarComponent, SidebarComponent, TranslateModule],
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

  qrDataUrl = '';
  observeUrl = '';

  sites: IamSite[] = [];
  availableLocations: string[] = [];
  selectedLocation: string = '';
  selectedModuleId: string = '';
  modalStep: number = 1;

  get modulesForSelectedLocation(): IamModule[] {
    const site = this.sites.find(s => s.name === this.selectedLocation);
    if (!site) return [];
    return site.salles.flatMap(salle => salle.modules);
  }

  constructor(
    private sessionService: SessionService,
    private iamService: IamService,
    private emotionService: EmotionService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    this.isInstructor = this.authService.getRole() === 'INSTRUCTOR';

    if (!this.isInstructor) {
      return;
    }

    this.loadSites();

    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        if (session) {
          this.sessionGenerated = true;
          this.sessionCode = session.code;
          this.sessionTitle = session.title;
          this.sessionDuration = session.duration;
          this.startPollingConnectedStudents();
          this.generateQrForSession(session.code);
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

  private loadSites(): void {
    this.iamService.getSites().subscribe({
      next: (sites) => {
        this.sites = sites;
        this.availableLocations = sites.map(s => s.name).sort();
      },
      error: () => { }
    });
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
    const selectedModule = this.modulesForSelectedLocation.find(m => m.id === moduleId);
    const sessionTitle = selectedModule
      ? `${selectedModule.name} - ${this.selectedLocation}`
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

  private generateQrForSession(code: string): void {
    const url = `${window.location.origin}/observe?code=${encodeURIComponent(code)}`;
    this.observeUrl = url;
    QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then(dataUrl => { this.qrDataUrl = dataUrl; })
      .catch(() => { this.qrDataUrl = ''; });
  }
}