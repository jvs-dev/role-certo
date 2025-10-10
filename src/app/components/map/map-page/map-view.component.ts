import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { EventService } from '../../../services/event.service';
import { Event } from '../../../models/interfaces';

declare var L: any;

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.scss'
})
export class MapViewComponent implements OnInit, AfterViewInit, OnDestroy {
  private map: any;
  
  events: Event[] = [];
  isLoading = true;

  constructor(
    private eventService: EventService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    await this.loadEvents();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Delay to ensure DOM is completely ready
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

  private async loadEvents(): Promise<void> {
    try {
      const allEvents = await this.eventService.getEvents(undefined, 100);
      this.events = allEvents.filter(event => event.coordinates);
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading events:', error);
      this.isLoading = false;
    }
  }

  private async initializeMap(): Promise<void> {
    try {
      // Load Leaflet dynamically
      const leaflet = await import('leaflet');
      L = leaflet.default || leaflet;

      // Fix marker icons for webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Create map with exact Leaflet documentation syntax
      this.map = L.map('map').setView([-12.9714, -38.5014], 12);

      // Add tile layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(this.map);

      // Force map refresh
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          this.addEventMarkers();
          this.getUserLocation();
        }
      }, 100);

    } catch (error) {
      console.error('Error initializing map:', error);
    }
  }

  private addEventMarkers(): void {
    if (!this.map || !L) return;

    this.events.forEach(event => {
      if (event.coordinates) {
        // Create custom purple marker using divIcon (avoids btoa encoding issues)
        const purpleIcon = L.divIcon({
          html: `
            <div style="
              width: 25px;
              height: 25px;
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
                font-size: 12px;
                line-height: 1;
              ">🎉</div>
            </div>
          `,
          className: 'custom-event-marker',
          iconSize: [25, 25],
          iconAnchor: [12, 24],
          popupAnchor: [0, -24]
        });

        L.marker([event.coordinates.lat, event.coordinates.lng], { icon: purpleIcon })
          .addTo(this.map)
          .bindPopup(`
            <div style="padding: 10px;">
              <h4 style="margin: 0 0 10px 0; color: #8B5CF6; font-weight: bold;">
                <i class="bi bi-calendar-event"></i> ${event.eventName}
              </h4>
              <p style="margin: 5px 0; color: #555;">
                <i class="bi bi-geo-alt-fill" style="color: #8B5CF6;"></i> ${event.location.city}, ${event.location.state}
              </p>
              <p style="margin: 5px 0; color: #555;">
                <i class="bi bi-calendar3" style="color: #8B5CF6;"></i> ${new Date(event.eventDate).toLocaleDateString('pt-BR')}
              </p>
              <p style="margin: 5px 0; color: #555;">
                <i class="bi bi-clock" style="color: #8B5CF6;"></i> ${event.eventTime}
              </p>
              <a href="/evento/${event.eventId}" style="display: inline-block; margin-top: 10px; padding: 8px 15px; background: #8B5CF6; color: white; text-decoration: none; border-radius: 5px; font-weight: 600; transition: background 0.3s;" onmouseover="this.style.background='#7C3AED'" onmouseout="this.style.background='#8B5CF6'">Ver Detalhes</a>
            </div>
          `);
      }
    });
  }

  private getUserLocation(): void {
    if (!navigator.geolocation || !this.map) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        // Create custom blue marker for user location using divIcon
        const userIcon = L.divIcon({
          html: `
            <div style="
              width: 25px;
              height: 25px;
              background: #3B82F6;
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              position: relative;
              box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
            ">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(45deg);
                width: 8px;
                height: 8px;
                background: white;
                border-radius: 50%;
              "></div>
            </div>
          `,
          className: 'custom-user-marker',
          iconSize: [25, 25],
          iconAnchor: [12, 24],
          popupAnchor: [0, -24]
        });

        // Add user marker
        L.marker([lat, lng], { icon: userIcon })
          .addTo(this.map)
          .bindPopup(`
            <div style="text-align: center; padding: 12px;">
              <h4 style="margin: 0 0 5px 0; color: #3B82F6; font-weight: bold;">
                <i class="bi bi-geo-alt-fill"></i> Você está aqui!
              </h4>
              <p style="margin: 0; color: #666; font-size: 0.9em;">Sua localização atual</p>
            </div>
          `)
          .openPopup();

        // Center map on user
        this.map.setView([lat, lng], 14);
      },
      (error) => {
        console.log('Geolocation not available:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }
}