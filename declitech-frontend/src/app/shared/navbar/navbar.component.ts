import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../services/session.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  sessionCode: string = '';
  
  firstName: string = '';
  lastName: string = '';
  username: string = '';
  role: string = '';
  isDropdownOpen = false;
  
  private subscription = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private sessionService: SessionService
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
    
    // Subscribe to session updates
    this.subscription.add(
      this.sessionService.sessionData$.subscribe(session => {
        this.sessionCode = session?.code || '';
      })
    );
  }
  
  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadUserInfo(): void {
    this.firstName = this.authService.getFirstName() || '';
    this.lastName = this.authService.getLastName() || '';
    this.username = this.authService.getUsername() || '';
    this.role = this.authService.getRole() || 'USER';
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  goToProfile(): void {
    this.closeDropdown();
    this.router.navigate(['/profile']);
  }

  logout(): void {
    this.closeDropdown();
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  getInitials(): string {
    const first = this.firstName?.charAt(0) || '';
    const last = this.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  }
}
