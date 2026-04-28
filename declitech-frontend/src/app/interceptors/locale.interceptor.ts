import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../services/language.service';

export const localeInterceptor: HttpInterceptorFn = (req, next) => {
  const lang = inject(LanguageService).currentLanguage();
  return next(req.clone({ setHeaders: { 'Accept-Language': lang } }));
};
