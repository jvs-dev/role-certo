import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-register-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register-form.component.html',
  styleUrl: './register-form.component.scss'
})
export class RegisterFormComponent {
  registerForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {
    this.registerForm = this.fb.group({
      displayName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.valid) {
      this.loadingService.show('register');
      try {
        const { email, password, displayName } = this.registerForm.value;
        await this.authService.signUp(email, password, displayName);
        this.toastService.showSuccess('Conta criada com sucesso!', 'Bem-vindo ao Rolê Certo.');
        this.router.navigate(['/perfil/me']);
      } catch (error: any) {
        this.toastService.showError('Erro no cadastro', this.getErrorMessage(error));
      } finally {
        this.loadingService.hide('register');
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  async signUpWithGoogle(): Promise<void> {
    this.loadingService.show('google-register');
    try {
      await this.authService.signInWithGoogle();
      this.toastService.showSuccess('Conta criada com Google!');
      this.router.navigate(['/perfil/me']);
    } catch (error: any) {
      this.toastService.showError('Erro no cadastro com Google', this.getErrorMessage(error));
    } finally {
      this.loadingService.hide('google-register');
    }
  }

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'Este email já está em uso.';
      case 'auth/invalid-email':
        return 'Email inválido.';
      case 'auth/weak-password':
        return 'Senha muito fraca.';
      case 'auth/operation-not-allowed':
        return 'Operação não permitida.';
      default:
        return 'Erro desconhecido. Tente novamente.';
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.registerForm.controls).forEach(key => {
      this.registerForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (field.errors['email']) {
        return 'Email inválido';
      }
      if (field.errors['minlength']) {
        if (fieldName === 'displayName') {
          return 'Nome deve ter pelo menos 2 caracteres';
        }
        return 'Senha deve ter pelo menos 6 caracteres';
      }
      if (field.errors['passwordMismatch']) {
        return 'Senhas não coincidem';
      }
    }
    return '';
  }
}
