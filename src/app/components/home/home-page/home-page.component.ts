import { Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { LoadingService } from '../../../services/loading.service';
import { ToastService } from '../../../services/toast.service';
import { Event, User } from '../../../models/interfaces';
import { SearchBarComponent } from '../../shared/search-bar/search-bar.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { FooterComponent } from '../../shared/footer/footer.component';

@Component({
  selector: 'app-home-page',
  imports: [CommonModule, RouterModule, SearchBarComponent, HeaderComponent, FooterComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss'
})
export class HomePageComponent implements OnInit, OnDestroy {
  events: Event[] = [];
  currentUser: User | null = null;
  isLoading = false;
  isSearching = false;
  isLoadingMore = false;
  hasMoreEvents = true;
  
  // Carousel properties
  currentSlide = 0;
  visibleSlides = 1;
  slideWidth = 100;
  isMobileMenuOpen = false;
  
  private destroy$ = new Subject<void>();
  private isBrowser: boolean;

  constructor(
    private eventService: EventService,
    private authService: AuthService,
    private loadingService: LoadingService,
    private toastService: ToastService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        if (this.isBrowser) {
          this.loadInitialEvents();
        }
      });

    this.loadingService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.isLoading = loading;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadInitialEvents(): Promise<void> {
    this.loadingService.show('home-events');
    try {
      const userCity = this.currentUser?.location?.city || undefined;
      this.events = await this.eventService.getEvents(userCity, 10);
      
      if (this.events.length === 0 && userCity) {
        // If no events in user's city, load general events
        this.events = await this.eventService.getEvents(undefined, 10);
        if (this.events.length > 0) {
          this.toastService.showInfo(
            'Nenhum evento encontrado na sua cidade',
            'Mostrando eventos de outras localidades'
          );
        }
      }
      
      this.hasMoreEvents = this.events.length === 10;
      this.eventService.resetPagination();
    } catch (error) {
      this.toastService.showError('Erro ao carregar eventos');
    } finally {
      this.loadingService.hide('home-events');
    }
  }

  async onSearch(searchTerm: string): Promise<void> {
    if (searchTerm.trim() === '') {
      this.onClearSearch();
      return;
    }

    this.isSearching = true;
    this.loadingService.show('search-events');
    try {
      this.events = await this.eventService.searchEvents(searchTerm);
      this.hasMoreEvents = false; // No pagination for search results
    } catch (error) {
      this.toastService.showError('Erro na busca');
    } finally {
      this.loadingService.hide('search-events');
      this.isSearching = false;
    }
  }

  async onClearSearch(): Promise<void> {
    this.isSearching = false;
    await this.loadInitialEvents();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll(): void {
    if (!this.isBrowser || this.isSearching || this.isLoadingMore || !this.hasMoreEvents) {
      return;
    }

    const threshold = 200;
    const position = window.pageYOffset + window.innerHeight;
    const height = document.documentElement.scrollHeight;

    if (position > height - threshold) {
      this.loadMoreEvents();
    }
  }

  async loadMoreEvents(): Promise<void> {
    if (this.isLoadingMore || !this.hasMoreEvents) {
      return;
    }

    this.isLoadingMore = true;
    try {
      const userCity = this.currentUser?.location?.city || undefined;
      const moreEvents = await this.eventService.getMoreEvents(userCity, 10);
      
      if (moreEvents.length > 0) {
        this.events = [...this.events, ...moreEvents];
        this.hasMoreEvents = moreEvents.length === 10;
      } else {
        this.hasMoreEvents = false;
      }
    } catch (error) {
      this.toastService.showError('Erro ao carregar mais eventos');
    } finally {
      this.isLoadingMore = false;
    }
  }

  getUserWelcomeMessage(): string {
    if (this.currentUser) {
      const hour = new Date().getHours();
      let greeting = 'Oi';
      
      if (hour < 12) {
        greeting = 'Bom dia';
      } else if (hour < 18) {
        greeting = 'Boa tarde';
      } else {
        greeting = 'Boa noite';
      }
      
      return `${greeting}, ${this.currentUser.displayName}!`;
    }
    return 'Bem-vindo ao Rolê Certo!';
  }

  hasEvents(): boolean {
    return this.events.length > 0;
  }

  trackByEventId(index: number, event: Event): string {
    return event.eventId;
  }
  
  // Removidas funções de navegação do carrossel
  // O carrossel agora usa scroll-snap para navegação arrastável
  
  // Navigation Methods
  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
  
  navigateToProfile(): void {
    this.router.navigate(['/perfil/me']);
  }
  
  // Event Methods
  buyTicket(eventId: string): void {
    // Navigate to ticket purchase or join event
    this.router.navigate(['/evento', eventId]);
  }
  
  viewEventDetails(eventId: string): void {
    this.router.navigate(['/evento', eventId]);
  }
  
  // Date formatting methods
  getEventDay(date: Date): string {
    return date.getDate().toString().padStart(2, '0');
  }
  
  getEventMonth(date: Date): string {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[date.getMonth()];
  }
  
  getEventYear(date: Date): string {
    return date.getFullYear().toString();
  }
}