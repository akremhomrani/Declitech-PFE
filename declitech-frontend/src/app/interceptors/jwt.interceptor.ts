// jwt.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private isRefreshing = false;

  constructor(private authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Add withCredentials to all requests to include cookies
    request = request.clone({
      withCredentials: true
    });

    // Don't intercept errors for logout endpoint
    if (request.url.includes('/auth/logout')) {
      return next.handle(request);
    }

    return next.handle(request).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Avoid multiple refresh attempts
    if (this.isRefreshing) {
      return throwError(() => new Error('Authentication failed'));
    }

    // Skip refresh for auth endpoints to avoid infinite loop
    if (request.url.includes('/auth/')) {
      this.authService.logout();
      return throwError(() => new Error('Authentication failed'));
    }

    this.isRefreshing = true;

    return this.authService.refreshToken().pipe(
      switchMap(() => {
        this.isRefreshing = false;
        // Retry the original request with refreshed cookie
        return next.handle(request.clone({ withCredentials: true }));
      }),
      catchError((error) => {
        this.isRefreshing = false;
        this.authService.logout();
        return throwError(() => error);
      })
    );
  }
}
