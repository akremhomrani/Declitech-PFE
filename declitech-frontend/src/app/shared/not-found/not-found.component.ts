import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-[#0d1b1c] to-[#152a2b] flex items-center justify-center p-6">
      <div class="text-center max-w-md">
        <div class="mb-8">
          <h1 class="text-[120px] font-black text-[#0bd0da] leading-none tracking-tighter opacity-80">404</h1>
        </div>
        <h2 class="text-white text-2xl font-bold mb-3">Page Not Found</h2>
        <p class="text-[#a0c5c7] text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or you don't have permission to access it.
        </p>
        <a routerLink="/dashboard"
          class="inline-flex items-center gap-2 px-6 py-3 bg-[#0bd0da] text-[#0d1b1c] font-bold text-sm rounded-xl hover:bg-[#09b8c1] transition-colors">
          <span class="material-symbols-outlined text-lg">arrow_back</span>
          Back to Dashboard
        </a>
      </div>
    </div>
  `
})
export class NotFoundComponent {}
