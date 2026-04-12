import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'declitech-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  isDark = signal(false);

  constructor() {
    this.init();
  }

  private init(): void {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === 'dark' : prefersDark;
    this.apply(dark);
  }

  toggle(): void {
    this.apply(!this.isDark());
  }

  private apply(dark: boolean): void {
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }
}
