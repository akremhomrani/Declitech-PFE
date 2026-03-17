import { Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { DashboardComponent } from './app/components/dashboard/dashboard.component';
import { UserManagementComponent } from './app/components/user-management/user-management.component';
import { ModuleManagementComponent } from './app/components/module-management/module-management.component';
import { SessionCreationComponent } from './app/components/session-creation/session-creation.component';
import { SessionHistoryComponent } from './app/components/session-history/session-history.component';
import { SessionDetailsComponent } from './app/components/session-details/session-details.component';
import { NotFoundComponent } from './app/shared/not-found/not-found.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'session/create', component: SessionCreationComponent },
  { path: 'session/history', component: SessionHistoryComponent },
  { path: 'session/details/:id', component: SessionDetailsComponent },
  { path: 'users', component: UserManagementComponent },
  { path: 'modules', component: ModuleManagementComponent },
  { path: 'not-found', component: NotFoundComponent },
  { path: '**', component: NotFoundComponent }
];
