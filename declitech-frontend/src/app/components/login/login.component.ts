import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

interface Particle {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  isLoading = false;
  errorMessage = '';
  animationDone = false;

  spotlightX = -9999;
  spotlightY = -9999;

  particles: Particle[] = Array.from({ length: 30 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 8,
    duration: Math.random() * 6 + 6
  }));

  private rafId = 0;
  private targetX = -9999;
  private targetY = -9999;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private el: ElementRef,
    private translate: TranslateService
  ) {}

  @HostListener('mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    this.targetX = e.clientX;
    this.targetY = e.clientY;
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.targetX = -9999;
    this.targetY = -9999;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
  }

  private animateSpotlight(): void {
    const ease = 0.1;
    this.spotlightX += (this.targetX - this.spotlightX) * ease;
    this.spotlightY += (this.targetY - this.spotlightY) * ease;

    const el = this.el.nativeElement.querySelector('.spotlight') as HTMLElement;
    if (el) {
      el.style.background = `radial-gradient(200px circle at ${this.spotlightX}px ${this.spotlightY}px,
        rgba(11, 208, 218, 0.13) 0%,
        rgba(11, 208, 218, 0.04) 50%,
        transparent 100%)`;
    }
    this.rafId = requestAnimationFrame(() => this.animateSpotlight());
  }

  ngOnInit(): void {
    setTimeout(() => { this.animationDone = true; }, 100);
    this.animateSpotlight();

    const code  = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (window.opener) {
      if (error) {
        window.opener.postMessage(
          { type: 'SSO_ERROR', error: this.mapIamError(error) },
          window.location.origin
        );
      } else if (code && state) {
        window.opener.postMessage(
          { type: 'SSO_CALLBACK', code, state },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    if (error) {
      this.errorMessage = this.mapIamError(error);
      return;
    }

    if (code && state) {
      this.isLoading = true;
      this.authService.handleSsoCallback(code, state).subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err: Error) => {
          this.isLoading = false;
          this.errorMessage = this.sanitizeError(err.message) || this.translate.instant('AUTH.ERROR_GENERIC');
        }
      });
      return;
    }

    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/dashboard']);
    }
  }

  loginWithIAM(userType: 'student' | 'staff'): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.initiateSsoLogin(userType).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: Error) => {
        this.isLoading = false;
        if (err.message !== 'AUTH.ERROR_CANCELLED') {
          this.errorMessage = this.sanitizeError(err.message);
        }
      }
    });
  }

  private sanitizeError(message: string): string {
    if (!message || /https?:\/\/|localhost|127\.0\.0\.1/.test(message)) {
      return this.translate.instant('AUTH.ERROR_UNREACHABLE');
    }
    if (message.startsWith('AUTH.')) {
      return this.translate.instant(message);
    }
    return message;
  }

  private mapIamError(error: string): string {
    switch (error) {
      case 'invalid_credentials': return this.translate.instant('AUTH.ERROR_INVALID');
      case 'account_inactive':    return this.translate.instant('AUTH.ERROR_ACCOUNT_LOCKED');
      case 'too_many_attempts':   return this.translate.instant('AUTH.ERROR_TOO_MANY');
      default:                    return this.translate.instant('AUTH.ERROR_GENERIC');
    }
  }
}
