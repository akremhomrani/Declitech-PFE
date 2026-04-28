import { Component, importProvidersFrom, inject, APP_INITIALIZER } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { provideRouter, RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { JwtInterceptor } from './app/interceptors/jwt.interceptor';
import { LanguageService } from './app/services/language.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styleUrls: []
})
export class App {}

export function createTranslateLoader(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export function initLanguageFactory(): () => void {
  const language = inject(LanguageService);
  return () => language.init();
}

bootstrapApplication(App, {
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    provideRouter(routes),
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'fr',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient]
        }
      })
    ),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initLanguageFactory,
      multi: true
    }
  ]
}).catch(() => { });
