import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
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
  imports: [CommonModule],
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
    private el: ElementRef
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

    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    // IAM redirects back to http://localhost:4200?code=...&state=...
    // Forward straight to SsoCallbackComponent which handles the exchange
    if (code && state) {
      this.router.navigate(['/auth/callback'], { queryParams: { code, state } });
      return;
    }
    if (error) {
      this.router.navigate(['/auth/callback'], { queryParams: { error } });
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
      error: (err: Error) => {
        this.isLoading = false;
        this.errorMessage = this.sanitizeError(err.message);
      }
    });
  }

  private sanitizeError(message: string): string {
    // Never expose URLs or internal details to the user
    if (!message || /https?:\/\/|localhost|127\.0\.0\.1/.test(message)) {
      return 'Unable to reach the authentication server. Please try again later.';
    }
    return message;
  }

}
