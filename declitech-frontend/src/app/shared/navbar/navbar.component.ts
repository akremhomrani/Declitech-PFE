import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../services/session.service';
import { LayoutService } from '../../services/layout.service';
import { ThemeService } from '../../services/theme.service';
import { LanguageService, AppLanguage } from '../../services/language.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly layoutService = inject(LayoutService);
  readonly themeService = inject(ThemeService);
  readonly languageService = inject(LanguageService);

  sessionCode: string = '';
  firstName: string = '';
  lastName: string = '';
  username: string = '';
  role: string = '';
  isDropdownOpen = false;
  isLanguageMenuOpen = false;

  private readonly subscription = new Subscription();

  ngOnInit(): void {
    this.loadUserInfo();
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
    this.role = this.authService.getRole() || '';
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) this.isLanguageMenuOpen = false;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
    this.isLanguageMenuOpen = false;
  }

  toggleLanguageMenu(): void {
    this.isLanguageMenuOpen = !this.isLanguageMenuOpen;
    if (this.isLanguageMenuOpen) this.isDropdownOpen = false;
  }

  selectLanguage(lang: AppLanguage): void {
    this.languageService.setLanguage(lang);
    this.isLanguageMenuOpen = false;
  }

  toggleMobileSidebar(): void {
    this.layoutService.toggleSidebar();
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
