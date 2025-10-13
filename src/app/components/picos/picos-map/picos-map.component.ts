import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { PicoService } from '../../../services/pico.service';
import { Pico } from '../../../models/interfaces';

declare var L: any;

@Component({
  selector: 'app-picos-map',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './picos-map.component.html',
  styleUrl: './picos-map.component.scss'
})
export class PicosMapComponent implements OnInit, OnDestroy {
  picos: Pico[] = [];
  isLoading = true;
  private map: any;
  private markers: any[] = [];

  constructor(
    private picoService: PicoService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      await this.loadPicos();
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        this.initializeMap();
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private async loadPicos(): Promise<void> {
    try {
      this.picos = await this.picoService.getAllPicos();
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading picos:', error);
      this.isLoading = false;
    }
  }

  private initializeMap(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      // Import Leaflet dynamically
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
        if (!this.map) {
          this.map = L.map('map').setView([-12.9714, -38.5014], 13); // Default to Salvador

          // Add tile layer
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
          }).addTo(this.map);

          // Add markers for picos
          this.addPicoMarkers();
        }
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private addPicoMarkers(): void {
    if (!this.map || !this.picos) return;

    // Clear existing markers
    this.markers.forEach(marker => marker.remove());
    this.markers = [];

    // Add marker for each pico
    this.picos.forEach(pico => {
      if (pico.coordinates) {
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

        const marker = L.marker([pico.coordinates.lat, pico.coordinates.lng], { icon: markerIcon })
          .addTo(this.map)
          .bindPopup(`
            <div class="pico-popup">
              <h3>${pico.picoName}</h3>
              <p><i class="bi bi-geo-alt-fill"></i> ${pico.location}</p>
              <p><i class="bi bi-star-fill"></i> ${pico.averageRating > 0 ? pico.averageRating.toFixed(1) : 'Sem avaliações'} (${pico.ratingCount})</p>
              <a href="/picos/${pico.picoId}" class="popup-link">Ver Detalhes</a>
            </div>
          `);

        this.markers.push(marker);
      }
    });
  }

  // Navigation methods
  navigateToPicos(): void {
    this.router.navigate(['/picos']);
  }

  navigateToAddPico(): void {
    this.router.navigate(['/adicionar-pico']);
  }
}