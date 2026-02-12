import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../services/session.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  elapsedTime: string = '';
  
  private subscription = new Subscription();

  constructor(private sessionService: SessionService) {}
  
  ngOnInit(): void {
    // Subscribe to session updates
    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        this.sessionCode = session?.code || '';
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
  }

  onEndSession() {
    if (confirm('Are you sure you want to end this live session?')) {
      this.sessionService.endSession();
    }
  }
}
