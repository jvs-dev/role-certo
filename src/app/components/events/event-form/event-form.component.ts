import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { Event, EventFormData } from '../../../models/interfaces';

@Component({
  selector: 'app-event-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss'
})
export class EventFormComponent implements OnInit {
  eventForm: FormGroup;
  currentStep = 1;
  maxSteps = 3;
  imagePreview: string | null = null;
  isLoading = false;
  isVerifyingLocation = false;
  locationVerified = false;
  isEditMode = false;
  eventId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private http: HttpClient
  ) {
    this.eventForm = this.createForm();
  }

  ngOnInit(): void {
    // Check if we're in edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.eventId = params['id'];
        this.loadEventData();
      }
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      eventName: ['', [Validators.required, Validators.minLength(3)]],
      location: this.fb.group({
        address: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required]
      }),
      coordinates: [null],
      eventDate: ['', Validators.required],
      eventTime: ['', Validators.required],
      minAge: [18, [Validators.required, Validators.min(0), Validators.max(99)]],
      maxParticipants: [50, [Validators.required, Validators.min(1)]],
      whatsappLink: ['', [Validators.required, Validators.pattern(/^https?:\/\/(wa\.me|chat\.whatsapp\.com)\/.+/)]],
      details: [''],
      privacy: ['aberta', Validators.required],
      imageUrl: ['', [Validators.pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)]] // Optional image URL with validation
    });
  }

  private async loadEventData(): Promise<void> {
    if (!this.eventId) return;

    this.isLoading = true;
    this.loadingService.show('loading-event');

    try {
      const event = await this.eventService.getEvent(this.eventId);
      
      if (!event) {
        this.toastService.showError('Evento não encontrado');
        this.router.navigate(['/home']);
        return;
      }

      // Check if current user is the creator
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser || event.creatorId !== currentUser.uid) {
        this.toastService.showError('Você não tem permissão para editar este evento');
        this.router.navigate(['/evento', this.eventId]);
        return;
      }

      // Format date for the form (YYYY-MM-DD)
      const formattedDate = event.eventDate.toISOString().split('T')[0];
      
      // Set form values
      this.eventForm.patchValue({
        eventName: event.eventName,
        location: {
          address: event.location.address,
          city: event.location.city,
          state: event.location.state
        },
        coordinates: event.coordinates || null,
        eventDate: formattedDate,
        eventTime: event.eventTime,
        minAge: event.minAge,
        maxParticipants: event.maxParticipants,
        whatsappLink: event.whatsappLink,
        details: event.details,
        privacy: event.privacy,
        imageUrl: event.imageUrl || ''
      });

      // Update image preview if imageUrl exists
      if (event.imageUrl) {
        this.imagePreview = event.imageUrl;
      }

      // Set location verified flag if coordinates exist
      this.locationVerified = !!event.coordinates;

      this.toastService.showSuccess('Dados do evento carregados com sucesso!');
    } catch (error) {
      console.error('Error loading event data:', error);
      this.toastService.showError('Erro ao carregar dados do evento');
      this.router.navigate(['/home']);
    } finally {
      this.isLoading = false;
      this.loadingService.hide('loading-event');
    }
  }

  nextStep(): void {
    if (this.currentStep < this.maxSteps) {
      if (this.validateCurrentStep()) {
        this.currentStep++;
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  private validateCurrentStep(): boolean {
    const step1Fields = ['eventName', 'location', 'eventDate', 'eventTime'];
    const step2Fields = ['minAge', 'maxParticipants', 'whatsappLink'];
    
    let fieldsToValidate: string[] = [];
    
    switch (this.currentStep) {
      case 1:
        fieldsToValidate = step1Fields;
        break;
      case 2:
        fieldsToValidate = step2Fields;
        break;
      default:
        return true;
    }

    for (const field of fieldsToValidate) {
      const control = this.eventForm.get(field);
      if (control && control.invalid) {
        control.markAsTouched();
        this.toastService.showError(`Por favor, preencha o campo ${this.getFieldLabel(field)} corretamente.`);
        return false;
      }
    }
    
    return true;
  }

  private getFieldLabel(field: string): string {
    const labels: { [key: string]: string } = {
      'eventName': 'Nome do Evento',
      'location': 'Localização',
      'eventDate': 'Data do Evento',
      'eventTime': 'Hora do Evento',
      'minAge': 'Idade Mínima',
      'maxParticipants': 'Número Máximo de Participantes',
      'whatsappLink': 'Link do WhatsApp',
      'imageUrl': 'URL da Imagem'
    };
    return labels[field] || field;
  }

  onImageUrlChange(): void {
    const imageUrl = this.eventForm.get('imageUrl')?.value;
    if (imageUrl && this.isValidImageUrl(imageUrl)) {
      this.imagePreview = imageUrl;
    } else {
      this.imagePreview = null;
    }
  }

  private isValidImageUrl(url: string): boolean {
    const imagePattern = /\.(jpg|jpeg|png|gif|webp)$/i;
    try {
      new URL(url);
      return imagePattern.test(url);
    } catch {
      return false;
    }
  }

  async verifyLocation(): Promise<void> {
    const locationGroup = this.eventForm.get('location');
    if (!locationGroup) return;

    const address = locationGroup.get('address')?.value;
    const city = locationGroup.get('city')?.value;
    const state = locationGroup.get('state')?.value;

    if (!address || !city || !state) {
      this.toastService.showError('Preencha todos os campos de endereço.');
      return;
    }

    this.isVerifyingLocation = true;
    this.locationVerified = false;

    try {
      const fullAddress = `${address}, ${city}, ${state}, Brazil`;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddress)}&format=json&limit=1`;
      
      const response = await this.http.get<any[]>(url, {
        headers: { 'User-Agent': 'BoomfestApp/1.0' }
      }).toPromise();

      if (response && response.length > 0) {
        const result = response[0];
        this.eventForm.patchValue({
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon)
          }
        });
        this.locationVerified = true;
        this.toastService.showSuccess('Localização verificada com sucesso!');
      } else {
        this.toastService.showError('Endereço não encontrado. Verifique os dados.');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      this.toastService.showError('Erro ao verificar localização.');
    } finally {
      this.isVerifyingLocation = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.isEditMode) {
      this.updateEvent();
    } else {
      this.createEvent();
    }
  }

  async createEvent(): Promise<void> {
    if (this.eventForm.valid) {
      this.isLoading = true;
      this.loadingService.show('creating-event');
      
      try {
        const currentUser = this.authService.getCurrentUser();
        if (!currentUser) {
          this.toastService.showError('Você precisa estar logado para criar um evento.');
          this.router.navigate(['/auth']);
          return;
        }
        
        const formValue = this.eventForm.value;
        const eventData: EventFormData = {
          eventName: formValue.eventName,
          location: {
            address: formValue.location.address,
            city: formValue.location.city,
            state: formValue.location.state
          },
          coordinates: formValue.coordinates || null,
          eventDate: formValue.eventDate,
          eventTime: formValue.eventTime,
          minAge: formValue.minAge,
          maxParticipants: formValue.maxParticipants,
          whatsappLink: formValue.whatsappLink,
          details: formValue.details,
          privacy: formValue.privacy,
          imageUrl: formValue.imageUrl || undefined // Include imageUrl if provided
        };
        
        const eventId = await this.eventService.createEvent(
          eventData, 
          currentUser.uid, 
          currentUser.displayName || currentUser.email || 'Anonymous',
          currentUser.photoURL || ''
        );
        
        this.toastService.showSuccess('Evento criado com sucesso!');
        this.router.navigate(['/evento', eventId]);
        
      } catch (error) {
        console.error('Error creating event:', error);
        this.toastService.showError('Erro ao criar evento. Tente novamente.');
      } finally {
        this.isLoading = false;
        this.loadingService.hide('creating-event');
      }
    } else {
      this.toastService.showError('Por favor, preencha todos os campos obrigatórios.');
      this.markAllFieldsAsTouched();
    }
  }

  async updateEvent(): Promise<void> {
    if (!this.eventId || !this.eventForm.valid) {
      if (!this.eventForm.valid) {
        this.toastService.showError('Por favor, preencha todos os campos obrigatórios.');
        this.markAllFieldsAsTouched();
      }
      return;
    }

    this.isLoading = true;
    this.loadingService.show('updating-event');

    try {
      const formValue = this.eventForm.value;
      const eventData: Partial<EventFormData> = {
        eventName: formValue.eventName,
        location: {
          address: formValue.location.address,
          city: formValue.location.city,
          state: formValue.location.state
        },
        coordinates: formValue.coordinates || null,
        eventDate: formValue.eventDate,
        eventTime: formValue.eventTime,
        minAge: formValue.minAge,
        maxParticipants: formValue.maxParticipants,
        whatsappLink: formValue.whatsappLink,
        details: formValue.details,
        privacy: formValue.privacy,
        imageUrl: formValue.imageUrl || undefined
      };

      await this.eventService.updateEvent(this.eventId, eventData);

      this.toastService.showSuccess('Evento atualizado com sucesso!');
      this.router.navigate(['/evento', this.eventId]);
    } catch (error) {
      console.error('Error updating event:', error);
      this.toastService.showError('Erro ao atualizar evento. Tente novamente.');
    } finally {
      this.isLoading = false;
      this.loadingService.hide('updating-event');
    }
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.eventForm.controls).forEach(key => {
      const control = this.eventForm.get(key);
      if (control) {
        control.markAsTouched();
        if (control instanceof FormGroup) {
          Object.keys(control.controls).forEach(nestedKey => {
            control.get(nestedKey)?.markAsTouched();
          });
        }
      }
    });
  }

  // Helper methods for template
  hasError(field: string): boolean {
    const control = this.eventForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getError(field: string): string {
    const control = this.eventForm.get(field);
    if (control && control.errors && (control.dirty || control.touched)) {
      if (control.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (control.errors['minlength']) {
        return `Mínimo de ${control.errors['minlength'].requiredLength} caracteres`;
      }
      if (control.errors['pattern']) {
        return 'Formato inválido';
      }
      if (control.errors['min']) {
        return `Valor mínimo: ${control.errors['min'].min}`;
      }
      if (control.errors['max']) {
        return `Valor máximo: ${control.errors['max'].max}`;
      }
    }
    return '';
  }

  // Method to determine submit button text
  getSubmitButtonText(): string {
    return this.isEditMode ? 'Atualizar Evento' : 'Criar Evento';
  }

  // Method to determine page title
  getPageTitle(): string {
    return this.isEditMode ? 'Editar Evento' : 'Criar Novo Evento';
  }
}