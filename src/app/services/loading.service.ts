import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  public loading$ = this.loadingSubject.asObservable();

  private loadingMap = new Map<string, boolean>();

  show(key: string = 'global'): void {
    this.loadingMap.set(key, true);
    this.updateLoadingState();
  }

  hide(key: string = 'global'): void {
    this.loadingMap.delete(key);
    this.updateLoadingState();
  }

  private updateLoadingState(): void {
    const isLoading = this.loadingMap.size > 0;
    this.loadingSubject.next(isLoading);
  }

  isLoading(key?: string): boolean {
    if (key) {
      return this.loadingMap.has(key);
    }
    return this.loadingSubject.value;
  }
}