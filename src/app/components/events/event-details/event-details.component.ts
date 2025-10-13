import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { Event, User } from '../../../models/interfaces';

@Component({
  selector: 'app-event-details',
  imports: [CommonModule, RouterModule],
  templateUrl: './event-details.component.html',
  styleUrl: './event-details.component.scss'
})
export class EventDetailsComponent implements OnInit, OnDestroy {
  event: Event | null = null;
  currentUser: User | null = null;
  isLoading = true;
  isJoining = false;
  isLeaving = false;
  eventId: string = '';
  
  // Computed properties
  get isUserParticipating(): boolean {
    return this.currentUser && this.event ? 
      this.event.participants.includes(this.currentUser.uid) : false;
  }
  
  get isEventCreator(): boolean {
    return this.currentUser && this.event ? 
      this.event.creatorId === this.currentUser.uid : false;
  }
  
  get spotsAvailable(): number {
    return this.event ? 
      Math.max(0, this.event.maxParticipants - this.event.participants.length) : 0;
  }
  
  get isEventFull(): boolean {
    return this.spotsAvailable === 0;
  }
  
  get eventProgress(): number {
    return this.event ? 
      (this.event.participants.length / this.event.maxParticipants) * 100 : 0;
  }
  
  get isEventPast(): boolean {
    // Recurring events never expire
    if (this.event && this.event.isRecurring) {
      return false;
    }
    
    return this.event ? this.event.eventDate < new Date() : false;
  }
  
  get daysUntilEvent(): number {
    if (!this.event) return 0;
    
    // For recurring events, show a special value
    if (this.event.isRecurring) {
      return -1; // Special value to indicate recurring event
    }
    
    const diffTime = this.event.eventDate.getTime() - new Date().getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private eventService: EventService,
    private authService: AuthService,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.eventId = params['id'];
      if (this.eventId) {
        this.loadEventDetails();
      }
    });

    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadEventDetails(): Promise<void> {
    this.isLoading = true;
    this.loadingService.show('event-details');
    
    try {
      this.event = await this.eventService.getEvent(this.eventId);
      
      if (!this.event) {
        this.toastService.showError('Evento não encontrado');
        this.router.navigate(['/home']);
        return;
      }
    } catch (error) {
      console.error('Error loading event details:', error);
      this.toastService.showError('Erro ao carregar detalhes do evento');
      this.router.navigate(['/home']);
    } finally {
      this.isLoading = false;
      this.loadingService.hide('event-details');
    }
  }

  async joinEvent(): Promise<void> {
    if (!this.currentUser || !this.event || this.isJoining) {
      return;
    }

    if (this.isEventFull) {
      this.toastService.showWarning('Este evento está lotado!');
      return;
    }

    if (this.isEventPast) {
      this.toastService.showWarning('Este evento já aconteceu!');
      return;
    }

    this.isJoining = true;
    
    try {
      await this.eventService.joinEvent(this.event.eventId, this.currentUser.uid);
      
      // Update local state
      this.event.participants.push(this.currentUser.uid);
      
      this.toastService.showSuccess('Você confirmou presença no evento!');
    } catch (error) {
      console.error('Error joining event:', error);
      this.toastService.showError('Erro ao confirmar presença. Tente novamente.');
    } finally {
      this.isJoining = false;
    }
  }

  async leaveEvent(): Promise<void> {
    if (!this.currentUser || !this.event || this.isLeaving) {
      return;
    }

    this.isLeaving = true;
    
    try {
      await this.eventService.leaveEvent(this.event.eventId, this.currentUser.uid);
      
      // Update local state
      const index = this.event.participants.indexOf(this.currentUser.uid);
      if (index > -1) {
        this.event.participants.splice(index, 1);
      }
      
      this.toastService.showSuccess('Você cancelou sua presença no evento.');
    } catch (error) {
      console.error('Error leaving event:', error);
      this.toastService.showError('Erro ao cancelar presença. Tente novamente.');
    } finally {
      this.isLeaving = false;
    }
  }

  async deleteEvent(): Promise<void> {
    if (!this.isEventCreator || !this.event) {
      return;
    }

    // Confirm with user before deletion
    const confirmed = confirm('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.');
    if (!confirmed) {
      return;
    }

    try {
      this.loadingService.show('delete-event');
      await this.eventService.deleteEvent(this.event.eventId);
      this.toastService.showSuccess('Evento excluído com sucesso!');
      this.router.navigate(['/home']);
    } catch (error) {
      console.error('Error deleting event:', error);
      this.toastService.showError('Erro ao excluir evento. Tente novamente.');
    } finally {
      this.loadingService.hide('delete-event');
    }
  }

  openWhatsAppGroup(): void {
    if (this.event?.whatsappLink) {
      window.open(this.event.whatsappLink, '_blank');
    }
  }

  // Navigation methods
  navigateToHome(): void {
    this.router.navigate(['/home']);
  }

  shareEvent(): void {
    if (navigator.share && this.event) {
      navigator.share({
        title: this.event.eventName,
        text: `Confira este evento: ${this.event.eventName}`,
        url: window.location.href
      }).catch(console.error);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          this.toastService.showSuccess('Link do evento copiado!');
        })
        .catch(() => {
          this.toastService.showError('Erro ao copiar link');
        });
    }
  }

  editEvent(): void {
    if (this.isEventCreator) {
      this.router.navigate(['/evento', this.eventId, 'editar']);
    }
  }

  // Utility method to format weekly days for display
  formatWeeklyDays(weeklyDays: string[]): string {
    if (!weeklyDays || weeklyDays.length === 0) {
      return '';
    }
    
    const dayNames: { [key: string]: string } = {
      'monday': 'Segunda',
      'tuesday': 'Terça',
      'wednesday': 'Quarta',
      'thursday': 'Quinta',
      'friday': 'Sexta',
      'saturday': 'Sábado',
      'sunday': 'Domingo'
    };
    
    return weeklyDays.map(day => dayNames[day] || day).join(', ');
  }

  // Utility methods for template
  formatDate(date: Date): string {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getEventStatusText(): string {
    if (this.isEventPast && !this.event?.isRecurring) return 'Evento Finalizado';
    if (this.isEventFull) return 'Evento Lotado';
    if (this.event?.isRecurring) return 'Evento Recorrente';
    if (this.daysUntilEvent === 0) return 'Hoje!';
    if (this.daysUntilEvent === 1) return 'Amanhã';
    return `Em ${this.daysUntilEvent} dias`;
  }

  getEventStatusClass(): string {
    if (this.isEventPast && !this.event?.isRecurring) return 'status-past';
    if (this.isEventFull) return 'status-full';
    if (this.event?.isRecurring) return 'status-recurring';
    if (this.daysUntilEvent <= 1) return 'status-soon';
    return 'status-upcoming';
  }
}