import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-login-form',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss'
})
export class LoginFormComponent {
  loginForm: FormGroup;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private loadingService: LoadingService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid) {
      this.loadingService.show('login');
      try {
        const { email, password } = this.loginForm.value;
        await this.authService.signInWithEmail(email, password);
        this.toastService.showSuccess('Login realizado com sucesso!');
        this.router.navigate(['/home']);
      } catch (error: any) {
        this.toastService.showError('Erro no login', this.getErrorMessage(error));
      } finally {
        this.loadingService.hide('login');
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loadingService.show('google-login');
    try {
      await this.authService.signInWithGoogle();
      this.toastService.showSuccess('Login com Google realizado com sucesso!');
      this.router.navigate(['/home']);
    } catch (error: any) {
      this.toastService.showError('Erro no login com Google', this.getErrorMessage(error));
    } finally {
      this.loadingService.hide('google-login');
    }
  }

  private getErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Usuário não encontrado.';
      case 'auth/wrong-password':
        return 'Senha incorreta.';
      case 'auth/invalid-email':
        return 'Email inválido.';
      case 'auth/user-disabled':
        return 'Conta desabilitada.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Tente novamente mais tarde.';
      default:
        return 'Erro desconhecido. Tente novamente.';
    }
  }

  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return 'Este campo é obrigatório';
      }
      if (field.errors['email']) {
        return 'Email inválido';
      }
      if (field.errors['minlength']) {
        return 'Senha deve ter pelo menos 6 caracteres';
      }
    }
    return '';
  }
}
