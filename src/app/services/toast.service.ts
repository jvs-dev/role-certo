import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  private toasts: ToastMessage[] = [];

  showSuccess(title: string, message?: string, duration?: number): void {
    this.show('success', title, message, duration);
  }

  showError(title: string, message?: string, duration?: number): void {
    this.show('error', title, message, duration);
  }

  showWarning(title: string, message?: string, duration?: number): void {
    this.show('warning', title, message, duration);
  }

  showInfo(title: string, message?: string, duration?: number): void {
    this.show('info', title, message, duration);
  }

  private show(type: ToastMessage['type'], title: string, message?: string, duration = 5000): void {
    const toast: ToastMessage = {
      id: this.generateId(),
      type,
      title,
      message,
      duration
    };

    this.toasts.push(toast);
    this.toastsSubject.next([...this.toasts]);

    // Auto remove after duration
    if (duration > 0) {
      setTimeout(() => {
        this.remove(toast.id);
      }, duration);
    }
  }

  remove(id: string): void {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
    this.toastsSubject.next([...this.toasts]);
  }

  clear(): void {
    this.toasts = [];
    this.toastsSubject.next([]);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}