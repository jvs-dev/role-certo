import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { EventService } from '../../../services/event.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { User, Event } from '../../../models/interfaces';

@Component({
  selector: 'app-profile-page',
  imports: [CommonModule, RouterModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  user: User | null = null;
  currentUser: User | null = null;
  userEvents: { created: Event[], attending: Event[] } = { created: [], attending: [] };
  isLoading = true;
  isOwnProfile = false;
  activeTab: 'created' | 'attending' = 'created';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private eventService: EventService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const userId = params['id'];
      
      this.authService.currentUser$
        .pipe(takeUntil(this.destroy$))
        .subscribe(currentUser => {
          console.log('Current user changed:', currentUser);
          this.currentUser = currentUser;
          
          if (userId) {
            console.log('Loading user profile for ID:', userId);
            this.loadUserProfile(userId);
          } else {
            console.log('Loading current user profile');
            // If no ID provided, show current user's profile
            this.loadCurrentUserProfile();
          }
        });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private checkProfileOwnership(): void {
    if (this.currentUser && this.user) {
      this.isOwnProfile = this.currentUser.uid === this.user.uid;
    }
  }

  private async loadCurrentUserProfile(): Promise<void> {
    if (this.currentUser) {
      this.isLoading = true;
      this.loadingService.show('profile');
      
      try {
        this.user = this.currentUser;
        this.isOwnProfile = true;
        await this.loadUserEvents(this.currentUser.uid);
      } catch (error) {
        console.error('Error loading current user profile:', error);
        this.toastService.showError('Erro ao carregar perfil');
      } finally {
        this.isLoading = false;
        this.loadingService.hide('profile');
      }
    } else {
      this.router.navigate(['/auth']);
    }
  }

  private async loadUserProfile(userId: string): Promise<void> {
    this.isLoading = true;
    this.loadingService.show('profile');
    
    try {
      // For now, we'll use the current user data since we don't have a separate getUserById method
      // In a real app, you'd want to fetch user data by ID from Firestore
      if (this.currentUser && this.currentUser.uid === userId) {
        this.user = this.currentUser;
      } else {
        // Navigate to current user's profile if trying to access different user
        this.router.navigate(['/perfil/me']);
        return;
      }
      
      this.checkProfileOwnership();
      await this.loadUserEvents(userId);
    } catch (error) {
      console.error('Error loading user profile:', error);
      this.toastService.showError('Erro ao carregar perfil');
    } finally {
      this.isLoading = false;
      this.loadingService.hide('profile');
    }
  }

  private async loadUserEvents(userId: string): Promise<void> {
    try {
      console.log('Loading events for user:', userId);
      this.userEvents = await this.eventService.getUserEvents(userId);
      console.log('Loaded user events:', this.userEvents);
    } catch (error) {
      console.error('Error loading user events:', error);
      this.toastService.showError('Erro ao carregar eventos do usuário');
      // Set empty events to prevent template errors
      this.userEvents = { created: [], attending: [] };
    }
  }

  setActiveTab(tab: 'created' | 'attending'): void {
    this.activeTab = tab;
  }

  navigateToEventDetails(eventId: string): void {
    this.router.navigate(['/evento', eventId]);
  }

  navigateToEditProfile(): void {
    this.router.navigate(['/perfil/editar']);
  }

  navigateToHome(): void {
    this.router.navigate(['/home']);
  }

  // Utility methods for template
  formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getEventStatusClass(event: Event): string {
    const now = new Date();
    if (event.eventDate < now) return 'event-past';
    if (event.participants.length >= event.maxParticipants) return 'event-full';
    return 'event-upcoming';
  }

  getEventStatusText(event: Event): string {
    const now = new Date();
    if (event.eventDate < now) return 'Finalizado';
    if (event.participants.length >= event.maxParticipants) return 'Lotado';
    
    const diffTime = event.eventDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Amanhã';
    return `Em ${diffDays} dias`;
  }

  getTotalEventsCount(): number {
    return this.userEvents.created.length + this.userEvents.attending.length;
  }

  getActiveEventsCount(): number {
    const now = new Date();
    const activeCreated = this.userEvents.created.filter(event => event.eventDate > now).length;
    const activeAttending = this.userEvents.attending.filter(event => event.eventDate > now).length;
    return activeCreated + activeAttending;
  }
}
