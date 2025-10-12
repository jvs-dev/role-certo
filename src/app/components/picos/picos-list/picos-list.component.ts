import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PicoService } from '../../../services/pico.service';
import { Pico } from '../../../models/interfaces';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-picos-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './picos-list.component.html',
  styleUrl: './picos-list.component.scss'
})
export class PicosListComponent implements OnInit {
  picos: Pico[] = [];
  filteredPicos: Pico[] = [];
  isLoading = true;
  searchQuery = '';
  sortBy: 'recent' | 'rating' = 'recent';

  constructor(
    private picoService: PicoService,
    private authService: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadPicos();
  }

  private async loadPicos(): Promise<void> {
    try {
      this.picos = await this.picoService.getAllPicos();
      this.filteredPicos = [...this.picos];
      this.isLoading = false;
    } catch (error) {
      console.error('Error loading picos:', error);
      this.isLoading = false;
    }
  }

  onSearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredPicos = [...this.picos];
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredPicos = this.picos.filter(pico => 
      pico.picoName.toLowerCase().includes(query)
    );
  }

  onSortChange(sortType: 'recent' | 'rating'): void {
    this.sortBy = sortType;
    
    if (sortType === 'recent') {
      this.filteredPicos = [...this.picos];
    } else {
      this.filteredPicos = [...this.picos].sort((a, b) => {
        if (b.averageRating !== a.averageRating) {
          return b.averageRating - a.averageRating;
        }
        return b.ratingCount - a.ratingCount;
      });
    }
  }

  getFirstPhoto(photos: string[]): string {
    if (photos && photos.length > 0 && photos[0].trim() !== '') {
      return photos[0];
    }
    return 'https://placehold.co/600x400/1a1a2e/969696?text=No+Image';
  }

  onErrorImage(event: any): void {
    event.target.src = 'https://placehold.co/600x400/1a1a2e/969696?text=No+Image';
  }

  getStars(rating: number): number[] {
    return Array(Math.floor(rating)).fill(0);
  }
}