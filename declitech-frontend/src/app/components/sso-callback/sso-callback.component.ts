import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sso-callback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-[#0d1b1c]">
      <div class="text-center text-white">
        <div *ngIf="!errorMessage" class="flex flex-col items-center gap-4">
          <svg class="animate-spin h-10 w-10 text-[#0bd0da]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-lg font-medium">Connexion en cours...</p>
        </div>
        <div *ngIf="errorMessage" class="flex flex-col items-center gap-4">
          <p class="text-red-400 text-lg font-medium">{{ errorMessage }}</p>
          <button
            (click)="goToLogin()"
            class="mt-4 px-6 py-2 bg-[#0bd0da] text-[#0d1b1c] rounded-xl font-bold hover:opacity-90">
            Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  `
})
export class SsoCallbackComponent implements OnInit {
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const error = this.route.snapshot.queryParamMap.get('error');

    if (error) {
      this.errorMessage = this.mapIamError(error);
      return;
    }

    if (!code || !state) {
      this.errorMessage = 'Paramètres de callback manquants.';
      return;
    }

    this.authService.handleSsoCallback(code, state).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.errorMessage = err.message || 'Erreur d\'authentification SSO.';
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  private mapIamError(error: string): string {
    switch (error) {
      case 'invalid_credentials': return 'Identifiants invalides.';
      case 'account_inactive': return 'Compte désactivé. Contactez l\'administrateur.';
      case 'too_many_attempts': return 'Trop de tentatives. Réessayez plus tard.';
      default: return 'Erreur de connexion : ' + error;
    }
  }
}
