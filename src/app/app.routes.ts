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
    path: 'mapa',
    loadComponent: () => import('./components/map/map-page/map-view.component').then(m => m.MapViewComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'picos',
    loadComponent: () => import('./components/picos/picos-list/picos-list.component').then(m => m.PicosListComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'picos/:id',
    loadComponent: () => import('./components/picos/pico-details/pico-details.component').then(m => m.PicoDetailsComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'adicionar-pico',
    loadComponent: () => import('./components/picos/add-pico/add-pico.component').then(m => m.AddPicoComponent),
    canActivate: [AuthGuard]
  },
  {
    path: 'picos/:id/editar',
    loadComponent: () => import('./components/picos/add-pico/add-pico.component').then(m => m.AddPicoComponent),
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/home'
  }
];