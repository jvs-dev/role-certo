import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EventService } from '../../../services/event.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { Event, EventFormData } from '../../../models/interfaces';

declare var L: any;

@Component({
  selector: 'app-event-form',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss'
})
export class EventFormComponent implements OnInit, AfterViewInit {
  eventForm: FormGroup;
  currentStep = 1;
  maxSteps = 3;
  imagePreview: string | null = null;
  isLoading = false;
  isVerifyingLocation = false;
  locationVerified = false;
  isEditMode = false;
  eventId: string | null = null;
  submitError = false;

  // Recurring event options
  weekDays = [
    { value: 'monday', label: 'Segunda' },
    { value: 'tuesday', label: 'Terça' },
    { value: 'wednesday', label: 'Quarta' },
    { value: 'thursday', label: 'Quinta' },
    { value: 'friday', label: 'Sexta' },
    { value: 'saturday', label: 'Sábado' },
    { value: 'sunday', label: 'Domingo' }
  ];

  // Map properties
  private map: any;
  isMapInitialized = false;
  marker: any;
  geocodingResults: any[] = [];
  geocodingError = '';

  constructor(
    private fb: FormBuilder,
    private eventService: EventService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private loadingService: LoadingService,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
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

  ngAfterViewInit(): void {
    // Initialize map after view is ready
    if (isPlatformBrowser(this.platformId)) {
      // Use a longer timeout to ensure DOM is fully ready
      setTimeout(() => {
        this.initializeMap();
      }, 500);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      // Remove the map-loaded class when component is destroyed
      const mapElement = document.getElementById('event-map');
      if (mapElement) {
        mapElement.classList.remove('map-loaded');
      }
      this.map.remove();
    }
  }

  private createForm(): FormGroup {
    const form = this.fb.group({
      eventName: ['', [Validators.required, Validators.minLength(3)]],
      location: this.fb.group({
        address: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required]
      }),
      coordinates: [null],
      eventDate: [''], // Removed Validators.required - will be conditionally validated
      eventTime: ['', Validators.required],
      minAge: [18, [Validators.required, Validators.min(0), Validators.max(99)]],
      maxParticipants: [50, [Validators.required, Validators.min(1)]],
      whatsappLink: ['', [Validators.required, Validators.pattern(/^https?:\/\/(wa\.me|chat\.whatsapp\.com)\/.+/)]],
      details: [''],
      privacy: ['aberta', Validators.required],
      imageUrl: ['', [Validators.pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)]], // Optional image URL with validation
      // Recurring event fields
      isRecurring: [false],
      recurrenceType: [''],
      weeklyDays: this.fb.array([]),
      monthlyDays: ['']
    });

    // Add value change listeners for recurring event controls
    form.get('isRecurring')?.valueChanges.subscribe(value => {
      if (!value) {
        // When not recurring, make date required
        form.get('eventDate')?.setValidators(Validators.required);
        form.get('eventDate')?.updateValueAndValidity();
        form.get('recurrenceType')?.setValue('');
        (form.get('weeklyDays') as FormArray).clear();
        form.get('monthlyDays')?.setValue('');
      } else {
        // When recurring, remove date requirement
        form.get('eventDate')?.clearValidators();
        form.get('eventDate')?.updateValueAndValidity();
      }
    });

    form.get('recurrenceType')?.valueChanges.subscribe(value => {
      if (value !== 'weekly') {
        (form.get('weeklyDays') as FormArray).clear();
      }
      if (value !== 'monthly') {
        form.get('monthlyDays')?.setValue('');
      }
    });

    return form;
  }

  // Custom validator for recurring events
  private recurringEventValidator(formGroup: FormGroup) {
    const isRecurring = formGroup.get('isRecurring')?.value;
    const recurrenceType = formGroup.get('recurrenceType')?.value;
    const weeklyDays = formGroup.get('weeklyDays')?.value;
    const monthlyDays = formGroup.get('monthlyDays')?.value;

    if (!isRecurring) {
      return null;
    }

    if (!recurrenceType) {
      return { recurrenceTypeRequired: true };
    }

    if (recurrenceType === 'weekly' && (!weeklyDays || weeklyDays.length === 0)) {
      return { weeklyDaysRequired: true };
    }

    if (recurrenceType === 'monthly') {
      if (!monthlyDays) {
        return { monthlyDaysRequired: true };
      }
      
      // Validate monthly days format
      const days = monthlyDays.split(',').map((day: string) => day.trim());
      for (const day of days) {
        const dayNum = parseInt(day, 10);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
          return { invalidMonthlyDays: true };
        }
      }
    }

    return null;
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
      if (this.currentStep === 1 && this.validateCurrentStep()) {
        this.currentStep++;
        // Re-initialize map when entering step 2
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            this.initializeMap();
          }, 300);
        }
      } else if (this.currentStep > 1 && this.validateCurrentStep()) {
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
    const step1Fields = ['eventName', 'eventTime'];
    const step2Fields = ['minAge', 'maxParticipants', 'whatsappLink'];
    
    let fieldsToValidate: string[] = [];
    
    switch (this.currentStep) {
      case 1:
        fieldsToValidate = [...step1Fields];
        
        // For non-recurring events, we also need to validate the date
        const isRecurring = this.eventForm.get('isRecurring')?.value;
        if (!isRecurring) {
          fieldsToValidate.push('eventDate');
        }
        
        // Also validate recurring event fields if needed
        if (isRecurring) {
          const recurrenceType = this.eventForm.get('recurrenceType')?.value;
          if (!recurrenceType) {
            this.toastService.showError('Selecione o tipo de recorrência.');
            return false;
          }
          
          if (recurrenceType === 'weekly') {
            const weeklyDays = this.eventForm.get('weeklyDays') as FormArray;
            if (!weeklyDays || weeklyDays.length === 0) {
              this.toastService.showError('Selecione pelo menos um dia da semana para eventos semanais.');
              return false;
            }
          } else if (recurrenceType === 'monthly') {
            const monthlyDays = this.eventForm.get('monthlyDays')?.value;
            if (!monthlyDays) {
              this.toastService.showError('Informe os dias do mês para eventos mensais.');
              return false;
            }
            
            // Validate monthly days format
            const days = monthlyDays.split(',').map((day: string) => day.trim());
            let valid = true;
            for (const day of days) {
              const dayNum = parseInt(day, 10);
              if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
                this.toastService.showError('Dias do mês devem ser números entre 1 e 31.');
                valid = false;
                break;
              }
            }
            
            if (!valid) {
              return false;
            }
          }
        }
        break;
      case 2:
        // For step 2, we need to validate that coordinates are selected
        if (!this.eventForm.get('coordinates')?.value) {
          this.submitError = true;
          this.toastService.showError('Por favor, selecione a localização no mapa.');
          return false;
        }
        fieldsToValidate = []; // No specific fields to validate for location step
        break;
      case 3:
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
    
    // Reset submit error if validation passes
    if (this.currentStep === 2 && this.eventForm.get('coordinates')?.value) {
      this.submitError = false;
    }
    
    return true;
  }

  private getFieldLabel(field: string): string {
    const labels: { [key: string]: string } = {
      'eventName': 'Nome do Evento',
      'eventDate': 'Data do Evento',
      'eventTime': 'Hora do Evento',
      'minAge': 'Idade Mínima',
      'maxParticipants': 'Número Máximo de Participantes',
      'whatsappLink': 'Link do WhatsApp',
      'imageUrl': 'URL da Imagem',
      'recurrenceType': 'Tipo de Recorrência',
      'monthlyDays': 'Dias do Mês'
    };
    return labels[field] || field;
  }

  // Override the hasError method to handle the date field conditionally
  hasError(field: string): boolean {
    const control = this.eventForm.get(field);
    
    // Special handling for eventDate - it's not required for recurring events
    if (field === 'eventDate') {
      const isRecurring = this.eventForm.get('isRecurring')?.value;
      if (isRecurring) {
        return false; // Date is not required for recurring events
      }
    }
    
    // Special handling for weeklyDays FormArray
    if (field === 'weeklyDays') {
      const weeklyDays = this.eventForm.get('weeklyDays') as FormArray;
      const isRecurring = this.eventForm.get('isRecurring')?.value;
      const recurrenceType = this.eventForm.get('recurrenceType')?.value;
      
      // Only validate weeklyDays if it's a recurring weekly event
      if (isRecurring && recurrenceType === 'weekly') {
        return !!(weeklyDays && weeklyDays.invalid && (weeklyDays.touched || weeklyDays.dirty));
      }
      return false;
    }
    
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getError(field: string): string {
    const control = this.eventForm.get(field);
    
    // Special handling for weeklyDays FormArray
    if (field === 'weeklyDays') {
      const weeklyDays = this.eventForm.get('weeklyDays') as FormArray;
      const isRecurring = this.eventForm.get('isRecurring')?.value;
      const recurrenceType = this.eventForm.get('recurrenceType')?.value;
      
      // Only validate weeklyDays if it's a recurring weekly event
      if (isRecurring && recurrenceType === 'weekly' && weeklyDays && weeklyDays.errors && (weeklyDays.touched || weeklyDays.dirty)) {
        if (weeklyDays.errors['required']) {
          return 'Selecione pelo menos um dia da semana';
        }
      }
      return '';
    }
    
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
      if (control.errors['recurrenceTypeRequired']) {
        return 'Selecione o tipo de recorrência';
      }
      if (control.errors['weeklyDaysRequired']) {
        return 'Selecione pelo menos um dia da semana';
      }
      if (control.errors['monthlyDaysRequired']) {
        return 'Informe os dias do mês';
      }
      if (control.errors['invalidMonthlyDays']) {
        return 'Dias do mês devem ser números entre 1 e 31';
      }
    }
    return '';
  }

  // Method to check if a day is selected
  isDaySelected(day: string): boolean {
    const weeklyDays = this.eventForm.get('weeklyDays')?.value || [];
    return weeklyDays.includes(day);
  }

  // Method to handle weekly day selection
  onWeekDayChange(day: string, event: any): void {
    const weeklyDays = this.eventForm.get('weeklyDays') as FormArray;
    const isChecked = event.target.checked;
    
    if (isChecked) {
      // Add day to array if not already present
      if (!weeklyDays.value.includes(day)) {
        weeklyDays.push(this.fb.control(day));
      }
    } else {
      // Remove day from array
      const index = weeklyDays.value.indexOf(day);
      if (index > -1) {
        weeklyDays.removeAt(index);
      }
    }
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

  // New methods for map functionality
  private initializeMap(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.currentStep !== 2) return; // Only initialize on step 2

    try {
      // Load Leaflet dynamically
      import('leaflet').then(leaflet => {
        L = leaflet.default || leaflet;

        // Fix marker icons for webpack
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Create map centered on Salvador, Brazil
        const mapElement = document.getElementById('event-map');
        if (mapElement) {
          // Add loaded class to hide loading indicator
          mapElement.classList.add('map-loaded');
          
          // If map already exists, remove it first
          if (this.map) {
            this.map.remove();
            this.map = null;
            this.marker = null;
          }
          
          this.map = L.map('event-map').setView([-12.9714, -38.5014], 12);

          // Add tile layer
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
          }).addTo(this.map);

          // Add click event to set marker
          this.map.on('click', (e: any) => {
            this.updateMapPosition(e.latlng.lat, e.latlng.lng);
            // Reverse geocode to get address
            this.reverseGeocode(e.latlng.lat, e.latlng.lng);
          });

          // Add a hint message to the map
          L.control.attribution({
            position: 'bottomright',
            prefix: '<span style="background: rgba(255,255,255,0.8); padding: 2px 6px; border-radius: 4px;">Clique no mapa para selecionar a localização</span>'
          }).addTo(this.map);

          this.isMapInitialized = true;
          
          // If we have existing coordinates, update the map
          if (this.eventForm.get('coordinates')?.value) {
            const coords = this.eventForm.get('coordinates')?.value;
            this.updateMapPosition(coords.lat, coords.lng);
          }
        } else {
          console.warn('Map element not found');
          // Retry after a short delay
          setTimeout(() => {
            if (!this.isMapInitialized) {
              this.initializeMap();
            }
          }, 1000);
        }
      }).catch(error => {
        console.error('Error loading Leaflet:', error);
        this.toastService.showError('Erro ao carregar o mapa. Por favor, recarregue a página.');
      });
    } catch (error) {
      console.error('Error initializing map:', error);
      this.toastService.showError('Erro ao inicializar o mapa. Por favor, recarregue a página.');
    }
  }

  private updateMapPosition(lat: number, lng: number): void {
    if (!this.map) return;
    
    // Update form coordinates
    this.eventForm.patchValue({
      coordinates: { lat, lng }
    });
    
    // Remove existing marker if present
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }
    
    // Add new marker with custom icon like in add-pico component
    const markerIcon = L.divIcon({
      html: `
        <div style="
          width: 30px;
          height: 30px;
          background: #8B5CF6;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          position: relative;
          box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(45deg);
            font-size: 14px;
            line-height: 1;
          ">🎉</div>
        </div>
      `,
      className: 'custom-event-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });

    this.marker = L.marker([lat, lng], { icon: markerIcon })
      .addTo(this.map)
      .bindPopup('Localização do Evento')
      .openPopup();
    
    // Center map on marker
    this.map.setView([lat, lng], 15);
    
    // Reset submit error since we now have coordinates
    this.submitError = false;
  }

  async geocodeAddress(): Promise<void> {
    const locationGroup = this.eventForm.get('location');
    if (!locationGroup) return;

    const address = locationGroup.get('address')?.value;
    const city = locationGroup.get('city')?.value;
    const state = locationGroup.get('state')?.value;

    if (!address) {
      this.geocodingError = 'Por favor, insira um endereço.';
      return;
    }

    const fullAddress = city && state ? `${address}, ${city}, ${state}, Brazil` : `${address}, Brazil`;
    this.isVerifyingLocation = true;
    this.geocodingError = '';

    try {
      // Using Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullAddress)}&countrycodes=BR&limit=5`
      );
      
      const results = await response.json();
      
      if (results.length > 0) {
        this.geocodingResults = results;
        // Use the first result automatically for better UX
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lng = parseFloat(firstResult.lon);
        
        this.updateMapPosition(lat, lng);
        
        // Also update the form fields with the geocoded address
        if (firstResult.address) {
          const road = firstResult.address.road || firstResult.address.pedestrian || '';
          const houseNumber = firstResult.address.house_number || '';
          const geocodedCity = firstResult.address.city || firstResult.address.town || firstResult.address.village || '';
          const geocodedState = firstResult.address.state || firstResult.address['state_district'] || '';
          
          // Create a more structured address if we have the components
          if (road) {
            const formattedAddress = houseNumber ? `${road}, ${houseNumber}` : road;
            locationGroup.patchValue({
              address: formattedAddress,
              city: city || geocodedCity,
              state: state || geocodedState
            });
          }
        }
      } else {
        this.geocodingError = 'Endereço não encontrado. Tente ser mais específico.';
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      this.geocodingError = 'Erro ao buscar endereço. Tente novamente.';
    } finally {
      this.isVerifyingLocation = false;
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      
      const result = await response.json();
      
      if (result && result.display_name) {
        const locationGroup = this.eventForm.get('location');
        if (locationGroup) {
          // Update the full address field
          locationGroup.patchValue({
            address: result.display_name
          });
          
          // Also try to parse structured address if available
          if (result.address) {
            const road = result.address.road || result.address.pedestrian || '';
            const houseNumber = result.address.house_number || '';
            const city = result.address.city || result.address.town || result.address.village || '';
            const state = result.address.state || result.address['state_district'] || '';
            
            // Create a more structured address if we have the components
            if (road) {
              const address = houseNumber ? `${road}, ${houseNumber}` : road;
              locationGroup.patchValue({
                address: address,
                city: city,
                state: state
              });
            } else {
              // Fallback to display_name if we can't parse structured components
              locationGroup.patchValue({
                address: result.display_name,
                city: city,
                state: state
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  }

  selectGeocodingResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    this.updateMapPosition(lat, lng);
    this.geocodingResults = [];
    
    // Update form with address details
    if (result.display_name) {
      const locationGroup = this.eventForm.get('location');
      if (locationGroup) {
        locationGroup.patchValue({
          address: result.display_name
        });
        
        // Also try to parse structured address if available
        if (result.address) {
          const road = result.address.road || result.address.pedestrian || '';
          const houseNumber = result.address.house_number || '';
          const city = result.address.city || result.address.town || result.address.village || '';
          const state = result.address.state || result.address['state_district'] || '';
          
          // Create a more structured address if we have the components
          if (road) {
            const address = houseNumber ? `${road}, ${houseNumber}` : road;
            locationGroup.patchValue({
              address: address,
              city: city,
              state: state
            });
          } else {
            // Fallback to display_name if we can't parse structured components
            locationGroup.patchValue({
              address: result.display_name,
              city: city,
              state: state
            });
          }
        }
      }
    }
    
    // Show success message
    this.toastService.showSuccess('Localização selecionada com sucesso!');
  }

  async onSubmit(): Promise<void> {
    // Validate that coordinates are selected before submitting
    if (!this.eventForm.get('coordinates')?.value) {
      this.submitError = true;
      this.toastService.showError('Por favor, selecione a localização no mapa.');
      return;
    }
    
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
        
        // For recurring events, we set a default date (today) since the field is not required
        // But the important thing is that isRecurring is set to true
        let eventDate = formValue.eventDate;
        
        // If it's a recurring event and no date was provided, use today's date
        if (formValue.isRecurring && !eventDate) {
          eventDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
        }
        
        // Prepare event data, excluding undefined values
        const eventData: any = {
          eventName: formValue.eventName,
          location: {
            address: formValue.location.address,
            city: formValue.location.city,
            state: formValue.location.state
          },
          coordinates: formValue.coordinates || null,
          eventDate: eventDate,
          eventTime: formValue.eventTime,
          minAge: formValue.minAge,
          maxParticipants: formValue.maxParticipants,
          whatsappLink: formValue.whatsappLink,
          details: formValue.details,
          privacy: formValue.privacy,
          imageUrl: formValue.imageUrl || undefined
        };
        
        // Add recurring event fields only if they have values
        if (formValue.isRecurring) {
          eventData.isRecurring = true;
          
          if (formValue.recurrenceType) {
            eventData.recurrenceType = formValue.recurrenceType;
          }
          
          if (formValue.weeklyDays && formValue.weeklyDays.length > 0) {
            eventData.weeklyDays = formValue.weeklyDays;
          }
          
          if (formValue.monthlyDays) {
            eventData.monthlyDays = formValue.monthlyDays;
          }
        }
        
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
      
      // Prepare event data, excluding undefined values
      const eventData: any = {
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
      
      // Add recurring event fields only if they have values
      if (formValue.isRecurring) {
        eventData.isRecurring = true;
        
        if (formValue.recurrenceType) {
          eventData.recurrenceType = formValue.recurrenceType;
        }
        
        if (formValue.weeklyDays && formValue.weeklyDays.length > 0) {
          eventData.weeklyDays = formValue.weeklyDays;
        }
        
        if (formValue.monthlyDays) {
          eventData.monthlyDays = formValue.monthlyDays;
        }
      } else {
        // If not recurring, explicitly set these fields to false/empty
        eventData.isRecurring = false;
      }

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

  // Method to determine submit button text
  getSubmitButtonText(): string {
    return this.isEditMode ? 'Atualizar Evento' : 'Criar Evento';
  }

  // Method to determine page title
  getPageTitle(): string {
    return this.isEditMode ? 'Editar Evento' : 'Criar Novo Evento';
  }
}