import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/home',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadComponent: () => import('./components/auth/auth-page/auth-page.component').then(m => m.AuthPageComponent)
  },
  {
    path: 'home',
    loadComponent: () => import('./components/home/home-page/home-page.component').then(m => m.HomePageComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'evento/:id',
    loadComponent: () => import('./components/events/event-details/event-details.component').then(m => m.EventDetailsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'criar-evento',
    loadComponent: () => import('./components/events/event-form/event-form.component').then(m => m.EventFormComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'evento/:id/editar',
    loadComponent: () => import('./components/events/event-form/event-form.component').then(m => m.EventFormComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'perfil/me',
    loadComponent: () => import('./components/profile/profile-page/profile-page.component').then(m => m.ProfilePageComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'perfil/:id',
    loadComponent: () => import('./components/profile/profile-page/profile-page.component').then(m => m.ProfilePageComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'perfil/editar',
    loadComponent: () => import('./components/profile/profile-edit/profile-edit.component').then(m => m.ProfileEditComponent),
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];
