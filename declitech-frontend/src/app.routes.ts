import { Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { DashboardComponent } from './app/components/dashboard/dashboard.component';
import { SessionCreationComponent } from './app/components/session-creation/session-creation.component';
import { SessionHistoryComponent } from './app/components/session-history/session-history.component';
import { SessionDetailsComponent } from './app/components/session-details/session-details.component';
import { NotFoundComponent } from './app/shared/not-found/not-found.component';
import { ForbiddenComponent } from './app/shared/forbidden/forbidden.component';
import { InstructorAnalyticsComponent } from './app/components/instructor-analytics/instructor-analytics.component';
import { TeacherObservationComponent } from './app/components/teacher-observation/teacher-observation.component';
import { AdminUsersComponent } from './app/features/admin/users/users.component';
import { AdminModulesComponent } from './app/features/admin/modules/modules.component';
import { AdminDashboardComponent } from './app/features/admin/dashboard/admin-dashboard.component';
import { authGuard } from './app/guards/auth.guard';
import { roleGuard } from './app/guards/role.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  { path: 'forbidden', component: ForbiddenComponent },

  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'session/details/:id', component: SessionDetailsComponent, canActivate: [authGuard] },
  { path: 'session/history', component: SessionHistoryComponent, canActivate: [authGuard] },
  { path: 'session/create', component: SessionCreationComponent, canActivate: [authGuard, roleGuard('INSTRUCTEUR', 'FREELANCER')] },
  { path: 'observe', component: TeacherObservationComponent, canActivate: [authGuard, roleGuard('INSTRUCTEUR', 'FREELANCER')] },
  { path: 'analytics', component: InstructorAnalyticsComponent, canActivate: [authGuard, roleGuard('INSTRUCTEUR', 'FREELANCER', 'ADMIN')] },

  { path: 'admin/dashboard', component: AdminDashboardComponent, canActivate: [authGuard, roleGuard('ADMIN')] },
  { path: 'admin/users', component: AdminUsersComponent, canActivate: [authGuard, roleGuard('ADMIN')] },
  { path: 'admin/modules', component: AdminModulesComponent, canActivate: [authGuard, roleGuard('ADMIN')] },

  { path: 'not-found', component: NotFoundComponent },
  { path: '**', component: NotFoundComponent }
];
