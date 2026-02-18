import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.authService.validateTokenWithRole().pipe(
      map(result => {
        if (result.valid && result.role === 'ADMIN') {
          return true;
        }
        this.router.navigate(['/not-found']);
        return false;
      }),
      catchError(() => {
        this.router.navigate(['/not-found']);
        return of(false);
      })
    );
  }
}
