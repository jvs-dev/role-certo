import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PicoService } from '../../../services/pico.service';
import { AuthService } from '../../../services/auth.service';
import { Pico, Review, ReviewFormData } from '../../../models/interfaces';

declare var L: any;

@Component({
  selector: 'app-pico-details',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './pico-details.component.html',
  styleUrl: './pico-details.component.scss'
})
export class PicoDetailsComponent implements OnInit, OnDestroy {
  pico: Pico | null = null;
  reviews: Review[] = [];
  currentUserReview: Review | null = null;
  isLoading = true;
  isMapInitialized = false;
  private map: any;
  currentImageIndex = 0;
  
  // Review form data
  reviewForm: ReviewFormData = {
    rating: 0,
    comment: '',
    media: [''] // Start with one empty field for media
  };
  
  isSubmitting = false;
  submitError = '';
  
  // Expose authService to template
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private picoService: PicoService,
    public authService: AuthService, // Changed to public
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit(): Promise<void> {
    const picoId = this.route.snapshot.paramMap.get('id');
    if (picoId) {
      await this.loadPicoData(picoId);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private async loadPicoData(picoId: string): Promise<void> {
    try {
      // Load pico data
      this.pico = await this.picoService.getPico(picoId);
      
      if (!this.pico) {
        // Pico not found, redirect to picos list
        this.router.navigate(['/picos']);
        return;
      }
      
      // Load reviews
      this.reviews = await this.picoService.getAllReviews(picoId);
      
      // Check if current user has already reviewed this pico
      const currentUser = this.authService.getCurrentUser();
      if (currentUser) {
        this.currentUserReview = await this.picoService.getUserReview(picoId, currentUser.uid);
      }
      
      this.isLoading = false;
      
      // Initialize map after view is ready
      if (isPlatformBrowser(this.platformId)) {
        setTimeout(() => {
          this.initializeMap();
        }, 100);
      }
    } catch (error) {
      console.error('Error loading pico data:', error);
      this.isLoading = false;
    }
  }

  private initializeMap(): void {
    if (!isPlatformBrowser(this.platformId) || !this.pico || this.isMapInitialized) {
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

        // Create map
        const mapElement = document.getElementById('pico-map');
        if (mapElement && !this.map && this.pico) {
          this.map = L.map('pico-map').setView([this.pico.coordinates.lat, this.pico.coordinates.lng], 15);

          // Add tile layer
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
          }).addTo(this.map);

          // Add marker for pico location
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

          L.marker([this.pico.coordinates.lat, this.pico.coordinates.lng], { icon: markerIcon })
            .addTo(this.map)
            .bindPopup(`
              <div style="padding: 10px;">
                <h4 style="margin: 0 0 10px 0; color: #8B5CF6; font-weight: bold;">
                  ${this.pico.picoName}
                </h4>
                <p style="margin: 5px 0; color: #555;">
                  ${this.pico.location}
                </p>
              </div>
            `);

          this.isMapInitialized = true;
        }
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  nextImage(): void {
    if (this.pico && this.pico.photos.length > 1) {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.pico.photos.length;
    }
  }

  prevImage(): void {
    if (this.pico && this.pico.photos.length > 1) {
      this.currentImageIndex = (this.currentImageIndex - 1 + this.pico.photos.length) % this.pico.photos.length;
    }
  }

  getStars(rating: number): number[] {
    return Array(Math.floor(rating)).fill(0);
  }

  onErrorImage(event: any): void {
    event.target.src = 'https://placehold.co/600x400/cccccc/969696?text=No+Image';
  }

  addMediaField(): void {
    this.reviewForm.media.push('');
  }

  removeMediaField(index: number): void {
    if (this.reviewForm.media.length > 1) {
      this.reviewForm.media.splice(index, 1);
    }
  }

  async submitReview(): Promise<void> {
    if (!this.pico || !this.authService.getCurrentUser()) {
      return;
    }

    // Validate form
    if (this.reviewForm.rating < 1 || this.reviewForm.rating > 5) {
      this.submitError = 'Por favor, selecione uma avaliação de 1 a 5 estrelas.';
      return;
    }
    
    // Comment is now required
    if (!this.reviewForm.comment || this.reviewForm.comment.trim() === '') {
      this.submitError = 'Por favor, adicione um comentário descrevendo sua experiência.';
      return;
    }

    // Filter out empty media URLs
    this.reviewForm.media = this.reviewForm.media.filter(url => url.trim() !== '');

    this.isSubmitting = true;
    this.submitError = '';

    try {
      const currentUser = this.authService.getCurrentUser()!;
      await this.picoService.addReview(
        this.pico.picoId,
        this.reviewForm,
        currentUser.uid,
        currentUser.displayName,
        currentUser.photoURL
      );

      // Reload reviews and user review
      this.reviews = await this.picoService.getAllReviews(this.pico.picoId);
      this.currentUserReview = await this.picoService.getUserReview(this.pico.picoId, currentUser.uid);

      // Reset form
      this.reviewForm = {
        rating: 0,
        comment: '',
        media: ['']
      };

      // Reload pico data to update average rating
      this.pico = await this.picoService.getPico(this.pico.picoId);
    } catch (error) {
      console.error('Error submitting review:', error);
      this.submitError = 'Erro ao enviar avaliação. Por favor, tente novamente.';
    } finally {
      this.isSubmitting = false;
    }
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

  hasInvalidUrls(): boolean {
    return this.reviewForm.media.some(url => url.trim() !== '' && !this.isUrlValid(url));
  }

  isUserAuthenticated(): boolean {
    return !!this.authService.getCurrentUser();
  }

  // Navigation methods
  navigateToPicos(): void {
    this.router.navigate(['/picos']);
  }

  // Helper method to get first photo
  getFirstPhoto(photos: string[]): string {
    if (photos && photos.length > 0) {
      return photos[0];
    }
    return 'https://placehold.co/600x400/cccccc/969696?text=No+Image';
  }

  // Share functionality
  sharePico(): void {
    if (navigator.share && this.pico) {
      navigator.share({
        title: this.pico.picoName,
        text: this.pico.description,
        url: window.location.href
      }).catch(error => {
        console.log('Sharing failed', error);
        this.copyToClipboard();
      });
    } else {
      this.copyToClipboard();
    }
  }

  private copyToClipboard(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copiado para a área de transferência!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      // Fallback: prompt user to copy manually
      prompt('Copie o link abaixo:', url);
    });
  }
}