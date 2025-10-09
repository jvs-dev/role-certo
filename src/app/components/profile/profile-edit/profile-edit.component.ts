import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';
import { User, UserProfile } from '../../../models/interfaces';

@Component({
  selector: 'app-profile-edit',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss'
})
export class ProfileEditComponent implements OnInit, OnDestroy {
  profileForm: FormGroup;
  currentUser: User | null = null;
  isLoading = false;
  isSaving = false;
  imagePreview: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {
    this.profileForm = this.createForm();
  }

  ngOnInit(): void {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.populateForm(user);
        } else {
          this.router.navigate(['/auth']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      bio: ['', [Validators.maxLength(500)]],
      location: this.fb.group({
        city: [''],
        state: ['']
      }),
      photoURL: ['', [Validators.pattern(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i)]]
    });
  }

  private populateForm(user: User): void {
    this.profileForm.patchValue({
      displayName: user.displayName || '',
      bio: user.bio || '',
      location: {
        city: user.location?.city || '',
        state: user.location?.state || ''
      },
      photoURL: user.photoURL || ''
    });
    
    if (user.photoURL) {
      this.imagePreview = user.photoURL;
    }
  }

  onImageUrlChange(): void {
    const imageUrl = this.profileForm.get('photoURL')?.value;
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

  async saveProfile(): Promise<void> {
    if (this.profileForm.valid && !this.isSaving) {
      this.isSaving = true;
      this.loadingService.show('saving-profile');
      
      try {
        const formValue = this.profileForm.value;
        const profileData: Partial<User> = {
          displayName: formValue.displayName,
          bio: formValue.bio,
          location: {
            city: formValue.location.city,
            state: formValue.location.state
          },
          photoURL: formValue.photoURL || ''
        };
        
        await this.authService.updateUserProfile(profileData);
        
        this.toastService.showSuccess('Perfil atualizado com sucesso!');
        this.router.navigate(['/perfil/me']);
        
      } catch (error) {
        console.error('Error updating profile:', error);
        this.toastService.showError('Erro ao atualizar perfil. Tente novamente.');
      } finally {
        this.isSaving = false;
        this.loadingService.hide('saving-profile');
      }
    } else {
      this.toastService.showError('Por favor, preencha todos os campos obrigatórios.');
      this.markAllFieldsAsTouched();
    }
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.profileForm.controls).forEach(key => {
      const control = this.profileForm.get(key);
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

  navigateBack(): void {
    this.router.navigate(['/perfil/me']);
  }

  // Helper methods for template
  hasError(field: string): boolean {
    const control = this.profileForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getError(field: string): string {
    const control = this.profileForm.get(field);
    if (control && control.errors && (control.dirty || control.touched)) {
      if (control.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (control.errors['minlength']) {
        return `Mínimo de ${control.errors['minlength'].requiredLength} caracteres`;
      }
      if (control.errors['maxlength']) {
        return `Máximo de ${control.errors['maxlength'].requiredLength} caracteres`;
      }
      if (control.errors['pattern']) {
        return 'Formato de URL inválido';
      }
    }
    return '';
  }

  getCharacterCount(field: string): number {
    const control = this.profileForm.get(field);
    return control?.value?.length || 0;
  }
}
