import { Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { DashboardComponent } from './app/components/dashboard/dashboard.component';
import { UserManagementComponent } from './app/components/user-management/user-management.component';
import { ModuleManagementComponent } from './app/components/module-management/module-management.component';
import { SessionCreationComponent } from './app/components/session-creation/session-creation.component';
import { SessionHistoryComponent } from './app/components/session-history/session-history.component';
import { SessionDetailsComponent } from './app/components/session-details/session-details.component';
import { NotFoundComponent } from './app/shared/not-found/not-found.component';
import { AuthGuard } from './app/guards/auth.guard';
import { AdminGuard } from './app/guards/admin.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  { path: 'session/create', component: SessionCreationComponent, canActivate: [AuthGuard] },
  { path: 'session/history', component: SessionHistoryComponent, canActivate: [AuthGuard] },
  { path: 'session/details/:id', component: SessionDetailsComponent, canActivate: [AuthGuard] },
  { path: 'users', component: UserManagementComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'modules', component: ModuleManagementComponent, canActivate: [AuthGuard, AdminGuard] },
  { path: 'not-found', component: NotFoundComponent },
  { path: '**', component: NotFoundComponent }
];
