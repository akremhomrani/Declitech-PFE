import { Routes } from '@angular/router';
import { LoginComponent } from './app/components/login/login.component';
import { authGuard } from './app/guards/auth.guard';
import { roleGuard } from './app/guards/role.guard';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'login', component: LoginComponent },
  {
    path: 'forbidden',
    loadComponent: () => import('./app/shared/forbidden/forbidden.component').then(m => m.ForbiddenComponent)
  },

  {
    path: 'dashboard',
    loadComponent: () => import('./app/components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'session/details/:id',
    loadComponent: () => import('./app/components/session-details/session-details.component').then(m => m.SessionDetailsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'session/history',
    loadComponent: () => import('./app/components/session-history/session-history.component').then(m => m.SessionHistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'session/create',
    loadComponent: () => import('./app/components/session-creation/session-creation.component').then(m => m.SessionCreationComponent),
    canActivate: [authGuard, roleGuard('INSTRUCTEUR', 'FREELANCER')]
  },
  {
    path: 'observe',
    loadComponent: () => import('./app/components/teacher-observation/teacher-observation.component').then(m => m.TeacherObservationComponent),
    canActivate: [authGuard, roleGuard('INSTRUCTEUR', 'FREELANCER')]
  },
  {
    path: 'analytics',
    loadComponent: () => import('./app/components/instructor-analytics/instructor-analytics.component').then(m => m.InstructorAnalyticsComponent),
    canActivate: [authGuard, roleGuard('INSTRUCTEUR', 'FREELANCER', 'ADMIN')]
  },

  {
    path: 'admin/dashboard',
    loadComponent: () => import('./app/features/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
    canActivate: [authGuard, roleGuard('ADMIN')]
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./app/features/admin/users/users.component').then(m => m.AdminUsersComponent),
    canActivate: [authGuard, roleGuard('ADMIN')]
  },
  {
    path: 'admin/modules',
    loadComponent: () => import('./app/features/admin/modules/modules.component').then(m => m.AdminModulesComponent),
    canActivate: [authGuard, roleGuard('ADMIN')]
  },
  {
    path: 'admin/recommendations',
    loadComponent: () => import('./app/features/admin/recommendations/recommendations.component').then(m => m.AdminRecommendationsComponent),
    canActivate: [authGuard, roleGuard('ADMIN')]
  },

  {
    path: 'not-found',
    loadComponent: () => import('./app/shared/not-found/not-found.component').then(m => m.NotFoundComponent)
  },
  {
    path: '**',
    loadComponent: () => import('./app/shared/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
