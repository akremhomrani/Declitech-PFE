import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  isLoading = false;
  errorMessage = '';
  showForm = false;
  usernameOrEmail = '';
  password = '';
  cursorX = 0;
  cursorY = 0;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.defaultRouteFor(this.authService.getRole())]);
    }
  }

  revealForm(): void {
    this.showForm = true;
    this.errorMessage = '';
  }

  onCursorMove(event: MouseEvent): void {
    this.cursorX = event.clientX;
    this.cursorY = event.clientY;
  }

  submit(): void {
    if (!this.usernameOrEmail || !this.password) {
      this.errorMessage = 'Username and password are required';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.login(this.usernameOrEmail, this.password).subscribe({
      next: res => {
        this.isLoading = false;
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl || this.defaultRouteFor(res.role));
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Invalid credentials';
      }
    });
  }

  private defaultRouteFor(role: string | null): string {
    return role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
  }
}
