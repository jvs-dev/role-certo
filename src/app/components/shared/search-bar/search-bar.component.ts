import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-search-bar',
  imports: [CommonModule, FormsModule],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss'
})
export class SearchBarComponent {
  @Output() searchChange = new EventEmitter<string>();
  @Output() clearSearch = new EventEmitter<void>();

  searchTerm = '';
  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.searchChange.emit(searchTerm);
    });
  }

  onSearchInput(): void {
    this.searchSubject.next(this.searchTerm);
  }

  onClearSearch(): void {
    this.searchTerm = '';
    this.clearSearch.emit();
  }

  hasSearchTerm(): boolean {
    return this.searchTerm.trim().length > 0;
  }
}
