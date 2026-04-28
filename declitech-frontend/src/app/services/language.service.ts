import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { StorageKeys } from './storage-keys';

export type AppLanguage = 'fr' | 'en';

const SUPPORTED_LANGUAGES: AppLanguage[] = ['fr', 'en'];
const DEFAULT_LANGUAGE: AppLanguage = 'fr';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly currentLanguage = signal<AppLanguage>(DEFAULT_LANGUAGE);
  readonly supportedLanguages: readonly AppLanguage[] = SUPPORTED_LANGUAGES;

  init(): void {
    this.translate.addLangs(SUPPORTED_LANGUAGES);
    this.translate.setDefaultLang(DEFAULT_LANGUAGE);
    const stored = localStorage.getItem(StorageKeys.ui.language) as AppLanguage | null;
    const initial = stored && SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
    this.setLanguage(initial);
  }

  setLanguage(lang: AppLanguage): void {
    this.translate.use(lang);
    this.currentLanguage.set(lang);
    localStorage.setItem(StorageKeys.ui.language, lang);
    document.documentElement.setAttribute('lang', lang);
  }
}
