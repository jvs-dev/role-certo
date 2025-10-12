import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PicoService } from '../../../services/pico.service';
import { AuthService } from '../../../services/auth.service';
import { Pico, PicoFormData } from '../../../models/interfaces';

declare var L: any;

@Component({
  selector: 'app-add-pico',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './add-pico.component.html',
  styleUrl: './add-pico.component.scss'
})
export class AddPicoComponent implements OnInit, OnDestroy {
  // Form steps
  currentStep = 1;
  totalSteps = 3;
  
  // Form data
  picoForm: PicoFormData = {
    picoName: '',
    description: '',
    location: '',
    coordinates: null,
    photos: ['', '']
  };
  
  // Image previews
  imagePreviews: string[] = [];
  
  // Geocoding
  isGeocoding = false;
  geocodingError = '';
  geocodingResults: any[] = [];
  
  // Map
  private map: any;
  isMapInitialized = false;
  marker: any;
  
  // Form state
  isSubmitting = false;
  submitError = '';
  isEditMode = false;
  picoId: string | null = null;
  existingPico: Pico | null = null;
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private picoService: PicoService,
    private authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit(): Promise<void> {
    // Check if we're in edit mode
    this.picoId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.picoId;
    
    if (this.isEditMode && this.picoId) {
      await this.loadPicoData(this.picoId);
    }
    
    // Initialize previews for existing photos
    this.updateImagePreviews();
    
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
      this.map.remove();
    }
  }

  private async loadPicoData(picoId: string): Promise<void> {
    try {
      const pico = await this.picoService.getPico(picoId);
      if (pico) {
        this.existingPico = pico;
        this.picoForm = {
          picoName: pico.picoName,
          description: pico.description,
          location: pico.location,
          coordinates: pico.coordinates,
          photos: [...pico.photos]
        };
        
        // Ensure at least two photo fields
        while (this.picoForm.photos.length < 2) {
          this.picoForm.photos.push('');
        }
        
        // Update previews
        this.updateImagePreviews();
      }
    } catch (error) {
      console.error('Error loading pico data:', error);
    }
  }

  // Update image previews when photo URLs change
  onPhotoUrlChange(index: number): void {
    this.updateImagePreviews();
  }

  // Update all image previews
  private updateImagePreviews(): void {
    this.imagePreviews = this.picoForm.photos
      .filter(url => url.trim() !== '')
      .map(url => this.isUrlValid(url) ? url : '');
  }

  private initializeMap(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

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
        const mapElement = document.getElementById('add-pico-map');
        if (mapElement) {
          // If map already exists, remove it first
          if (this.map) {
            this.map.remove();
            this.map = null;
            this.marker = null;
          }
          
          this.map = L.map('add-pico-map').setView([-12.9714, -38.5014], 12);

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

          this.isMapInitialized = true;
          
          // If we have existing coordinates, update the map
          if (this.picoForm.coordinates) {
            this.updateMapPosition(
              this.picoForm.coordinates.lat, 
              this.picoForm.coordinates.lng
            );
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
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private updateMapPosition(lat: number, lng: number): void {
    if (!this.map) return;
    
    // Update form coordinates
    this.picoForm.coordinates = { lat, lng };
    
    // Remove existing marker if present
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }
    
    // Add new marker
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
          ">🏔️</div>
        </div>
      `,
      className: 'custom-pico-marker',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });

    this.marker = L.marker([lat, lng], { icon: markerIcon })
      .addTo(this.map)
      .bindPopup('Localização do Pico')
      .openPopup();
    
    // Center map on marker
    this.map.setView([lat, lng], 15);
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      // Re-initialize map when entering step 3
      if (this.currentStep === 3 && isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this.initializeMap();
        }, 300);
      }
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  addPhotoField(): void {
    this.picoForm.photos.push('');
  }

  removePhotoField(index: number): void {
    if (this.picoForm.photos.length > 2) {
      this.picoForm.photos.splice(index, 1);
      this.updateImagePreviews();
    }
  }

  async geocodeAddress(): Promise<void> {
    if (!this.picoForm.location.trim()) {
      this.geocodingError = 'Por favor, insira um endereço.';
      return;
    }

    this.isGeocoding = true;
    this.geocodingError = '';

    try {
      // Using Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.picoForm.location)}&countrycodes=BR&limit=5`
      );
      
      const results = await response.json();
      
      if (results.length > 0) {
        this.geocodingResults = results;
        // Use the first result
        const firstResult = results[0];
        const lat = parseFloat(firstResult.lat);
        const lng = parseFloat(firstResult.lon);
        
        this.updateMapPosition(lat, lng);
      } else {
        this.geocodingError = 'Endereço não encontrado. Tente ser mais específico.';
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      this.geocodingError = 'Erro ao buscar endereço. Tente novamente.';
    } finally {
      this.isGeocoding = false;
    }
  }

  private async reverseGeocode(lat: number, lng: number): Promise<void> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      
      const result = await response.json();
      
      if (result && result.display_name) {
        this.picoForm.location = result.display_name;
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  }

  selectGeocodingResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    this.picoForm.location = result.display_name;
    this.updateMapPosition(lat, lng);
    this.geocodingResults = [];
  }

  isUrlValid(url: string): boolean {
    if (!url.trim()) return true; // Empty URLs are not considered invalid for optional fields
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  onErrorImage(event: any): void {
    event.target.src = 'https://placehold.co/600x400/cccccc/969696?text=No+Image';
  }

  hasValidPhotos(): boolean {
    // Filter out empty photo URLs
    const nonEmptyPhotos = this.picoForm.photos.filter(url => url.trim() !== '');
    
    // Check if we have at least 2 photos and all are valid URLs
    if (nonEmptyPhotos.length < 2) {
      return false;
    }
    
    return nonEmptyPhotos.every(url => this.isUrlValid(url));
  }

  // Helper methods for template
  hasNonEmptyPhotos(): boolean {
    return this.picoForm.photos.some(url => url.trim() !== '');
  }

  getNonEmptyPhotosCount(): number {
    return this.picoForm.photos.filter(url => url.trim() !== '').length;
  }

  hasInvalidUrlsInForm(): boolean {
    return this.picoForm.photos.some(url => url.trim() !== '' && !this.isUrlValid(url));
  }

  async submitForm(): Promise<void> {
    // Validate form
    if (!this.picoForm.picoName.trim()) {
      this.submitError = 'Por favor, insira o nome do pico.';
      return;
    }
    
    if (!this.picoForm.description.trim()) {
      this.submitError = 'Por favor, insira a descrição do pico.';
      return;
    }
    
    if (!this.picoForm.location.trim()) {
      this.submitError = 'Por favor, insira a localização do pico.';
      return;
    }
    
    if (!this.picoForm.coordinates) {
      this.submitError = 'Por favor, selecione a localização no mapa.';
      return;
    }
    
    if (!this.hasValidPhotos()) {
      this.submitError = 'Por favor, insira pelo menos duas URLs de fotos válidas.';
      return;
    }
    
    // Filter out empty photo URLs
    const validPhotos = this.picoForm.photos.filter(url => url.trim() !== '');
    
    this.isSubmitting = true;
    this.submitError = '';

    try {
      const currentUser = this.authService.getCurrentUser();
      if (!currentUser) {
        throw new Error('Usuário não autenticado');
      }
      
      const formData: PicoFormData = {
        ...this.picoForm,
        photos: validPhotos
      };
      
      if (this.isEditMode && this.picoId) {
        // Update existing pico
        await this.picoService.updatePico(this.picoId, formData);
      } else {
        // Create new pico
        await this.picoService.createPico(formData, currentUser.uid, currentUser.displayName);
      }
      
      // Redirect to picos list
      this.router.navigate(['/picos']);
    } catch (error) {
      console.error('Error submitting form:', error);
      this.submitError = 'Erro ao salvar pico. Por favor, tente novamente.';
    } finally {
      this.isSubmitting = false;
    }
  }
}