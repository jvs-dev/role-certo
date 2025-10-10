import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, switchMap, take, filter } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean> {
    console.log('Auth guard checking...');
    
    // Wait for auth to be ready first, then check the current user
    return this.authService.authReady$.pipe(
      filter(ready => ready),  // Wait until auth is initialized
      switchMap(() => this.authService.currentUser$),
      take(1),
      map(user => {
        console.log('Auth guard - user state:', user ? 'authenticated' : 'not authenticated');
        
        if (user) {
          return true;
        } else {
          console.log('Auth guard - redirecting to /auth');
          this.router.navigate(['/auth']);
          return false;
        }
      })
    );
  }
}