import { Injectable, signal } from '@angular/core';
import { StorageKeys } from './storage-keys';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);

  constructor() {
    this.init();
  }

  toggle(): void {
    this.apply(!this.isDark());
  }

  private init(): void {
    const stored = localStorage.getItem(StorageKeys.ui.theme);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === 'dark' : prefersDark;
    this.apply(dark);
  }

  private apply(dark: boolean): void {
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem(StorageKeys.ui.theme, dark ? 'dark' : 'light');
  }
}
