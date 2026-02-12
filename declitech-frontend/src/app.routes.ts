import { Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { DashboardComponent } from './app/components/dashboard/dashboard.component';
import { UserManagementComponent } from './app/components/user-management/user-management.component';
import { SessionCreationComponent } from './app/components/session-creation/session-creation.component';
import { SessionHistoryComponent } from './app/components/session-history/session-history.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'session/create', component: SessionCreationComponent },
  { path: 'session/history', component: SessionHistoryComponent },
  { path: 'users', component: UserManagementComponent },
  { path: '**', redirectTo: '' }
];
