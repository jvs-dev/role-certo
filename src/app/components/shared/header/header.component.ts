import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit {
  // Dropdown state
  isMapDropdownOpen = false;
  
  // Mobile navigation active state
  isHomeActive = true;
  isPicosActive = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Subscribe to router events to update active state
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateActiveState(event.url);
      });
      
    // Initialize active state based on current route
    this.updateActiveState(this.router.url);
  }
  
  // Update active state based on current route
  private updateActiveState(url: string): void {
    // Home is active for home page or root path
    this.isHomeActive = url === '/home' || url === '/';
    // Picos is active for any picos-related routes
    this.isPicosActive = url.startsWith('/picos') && !url.startsWith('/picos/mapa');
  }

  toggleMapDropdown(event: Event): void {
    event.preventDefault();
    this.isMapDropdownOpen = !this.isMapDropdownOpen;
  }

  closeMapDropdown(): void {
    this.isMapDropdownOpen = false;
  }
  
  navigateToProfile(): void {
    this.router.navigate(['/perfil/me']);
  }
  
  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.home-page__nav-dropdown')) {
      this.isMapDropdownOpen = false;
    }
  }
}