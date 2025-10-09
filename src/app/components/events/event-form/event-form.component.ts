import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { EventFormData } from '../../../models/interfaces';

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

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {
    this.eventForm = this.createForm();
  }

  ngOnInit(): void {
    // Initialize form validation and setup
  }

  private createForm(): FormGroup {
    return this.fb.group({
      eventName: ['', [Validators.required, Validators.minLength(3)]],
      location: this.fb.group({
        address: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required]
      }),
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
}
