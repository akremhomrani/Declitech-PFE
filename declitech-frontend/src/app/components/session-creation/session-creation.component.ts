import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { SidebarComponent } from '../../shared/sidebar/sidebar.component';
import { SessionService } from '../../services/session.service';
import { EmotionService } from '../../services/emotion.service';
import { Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-session-creation',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, SidebarComponent],
  templateUrl: './session-creation.component.html',
  styleUrls: ['./session-creation.component.css']
})
export class SessionCreationComponent implements OnInit, OnDestroy {
  // Session state
  sessionGenerated = false;
  sessionCode = '';
  sessionTitle = '';
  sessionDuration = 0;
  connectedStudents = 0;
  elapsedTime = '0m 0s';
  
  private subscription = new Subscription();
  private pollSubscription?: Subscription;
  
  // Modal state
  isModalOpen = false;
  modalTitle = '';
  modalDuration = 60; // default 60 minutes
  
  constructor(
    private sessionService: SessionService,
    private emotionService: EmotionService
  ) {}
  
  ngOnInit(): void {
    // Subscribe to session data
    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        if (session) {
          this.sessionGenerated = true;
          this.sessionCode = session.code;
          this.sessionTitle = session.title;
          this.sessionDuration = session.duration;
          // Start polling for connected students count
          this.startPollingConnectedStudents();
        } else {
          this.sessionGenerated = false;
          this.sessionCode = '';
          // Stop polling when session ends
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
    // Stop any existing polling
    this.stopPollingConnectedStudents();
    
    // Poll immediately once
    this.updateConnectedStudentsCount();
    
    // Poll every 5 seconds
    this.pollSubscription = interval(5000)
      .pipe(
        switchMap(() => this.emotionService.getReportCountBySessionCode(this.sessionCode))
      )
      .subscribe({
        next: (count) => {
          this.connectedStudents = count;
        },
        error: (error) => {
          console.error('Error fetching connected students count:', error);
        }
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
        error: (error) => {
          console.error('Error fetching connected students count:', error);
        }
      });
    }
  }
  
  openModal(): void {
    this.isModalOpen = true;
  }
  
  closeModal(): void {
    this.isModalOpen = false;
    this.modalTitle = '';
    this.modalDuration = 60;
  }
  
  generateSession(): void {
    if (!this.modalTitle || this.modalDuration <= 0) {
      return;
    }
    
    this.sessionService.createSession(this.modalTitle, this.modalDuration);
    this.closeModal();
  }
  
  copyCode(): void {
    navigator.clipboard.writeText(this.sessionCode).then(() => {
      alert('Session code copied to clipboard!');
    });
  }
  
  showQR(): void {
    alert('QR Code feature coming soon!');
  }
  
  getCodeArray(): string[] {
    return this.sessionCode.split('');
  }
  
  endSession(): void {
    if (confirm('Are you sure you want to end this live session?')) {
      this.sessionService.endSession();
    }
  }
}