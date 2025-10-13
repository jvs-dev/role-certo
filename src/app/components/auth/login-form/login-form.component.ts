import { Component, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { LoadingService } from '../../../services/loading.service';

@Component({
  selector: 'app-login-form',
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss'
})
export class LoginFormComponent implements OnDestroy {
  loginForm: FormGroup;
  isLoading = false;
  showPassword = false; // Add this property for password visibility toggle
  showResetPasswordForm = false; // Add this property for password reset form visibility
  resetEmail = ''; // Add this property for reset email input
  resetSuccess = false; // Add this property for reset success message
  private isBrowser: boolean;
  private autoLoginAttempted = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private loadingService: LoadingService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });

    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });

    // Load saved credentials if they exist
    this.loadSavedCredentials();
    
    // Wait for auth to be ready, then attempt auto-login
    if (this.isBrowser) {
      // Wait a bit for Firebase to initialize, then check auth state
      setTimeout(() => {
        this.checkAuthStateAndAutoLogin();
      }, 500);
    }
  }

  ngOnDestroy(): void {
    // Component cleanup if needed
  }

  // Add this method to toggle password visibility
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.valid) {
      this.loadingService.show('login');
      try {
        const { email, password, rememberMe } = this.loginForm.value;
        
        console.log('Attempting login with rememberMe:', rememberMe);
        
        await this.authService.signInWithEmail(email, password, rememberMe);
        
        // Handle remember me functionality AFTER successful login
        if (rememberMe) {
          console.log('Saving credentials to localStorage');
          this.saveCredentials(email, password);
        } else {
          console.log('Clearing saved credentials');
          this.clearSavedCredentials();
        }
        
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

  // Add this method to handle password reset
  async onResetPassword(): Promise<void> {
    if (!this.resetEmail) {
      this.toastService.showError('Por favor, insira seu email.');
      return;
    }

    this.loadingService.show('reset-password');
    try {
      await this.authService.sendPasswordResetEmail(this.resetEmail);
      this.resetSuccess = true;
      this.toastService.showSuccess('Email de redefinição de senha enviado com sucesso!');
    } catch (error: any) {
      this.toastService.showError('Erro ao enviar email', this.getPasswordResetErrorMessage(error));
    } finally {
      this.loadingService.hide('reset-password');
    }
  }

  // Add this method to toggle password reset form visibility
  toggleResetPasswordForm(): void {
    this.showResetPasswordForm = !this.showResetPasswordForm;
    this.resetSuccess = false;
    this.resetEmail = '';
  }

  private getPasswordResetErrorMessage(error: any): string {
    switch (error.code) {
      case 'auth/user-not-found':
        return 'Nenhum usuário encontrado com este email.';
      case 'auth/invalid-email':
        return 'Email inválido.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Tente novamente mais tarde.';
      default:
        return 'Erro ao enviar email de redefinição. Tente novamente.';
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loadingService.show('google-login');
    try {
      await this.authService.signInWithGoogle();
      
      // Clear saved credentials when using Google sign-in
      // as Google handles its own session management
      this.clearSavedCredentials();
      
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

  private loadSavedCredentials(): void {
    if (!this.isBrowser) return;
    
    const savedCredentials = localStorage.getItem('rememberedCredentials');
    if (savedCredentials) {
      try {
        const credentials = JSON.parse(savedCredentials);
        this.loginForm.patchValue({
          email: credentials.email,
          password: credentials.password,
          rememberMe: true
        });
      } catch (error) {
        console.error('Error loading saved credentials:', error);
        this.clearSavedCredentials();
      }
    }
  }

  private saveCredentials(email: string, password: string): void {
    if (!this.isBrowser) return;
    
    const credentials = { email, password };
    localStorage.setItem('rememberedCredentials', JSON.stringify(credentials));
  }

  private clearSavedCredentials(): void {
    if (!this.isBrowser) return;
    
    localStorage.removeItem('rememberedCredentials');
  }

  private async attemptAutoLogin(): Promise<void> {
    if (!this.isBrowser || this.autoLoginAttempted) return;
    
    this.autoLoginAttempted = true;
    
    // Check for saved credentials
    const savedCredentials = localStorage.getItem('rememberedCredentials');
    if (!savedCredentials) {
      console.log('No saved credentials found');
      return;
    }
    
    try {
      const credentials = JSON.parse(savedCredentials);
      console.log('Found saved credentials, attempting auto-login');
      
      this.loadingService.show('auto-login');
      
      // Set persistence BEFORE attempting sign in
      await this.authService.signInWithEmail(credentials.email, credentials.password, true);
      
      console.log('Auto-login successful');
      this.toastService.showSuccess('Bem-vindo de volta!');
      this.router.navigate(['/home']);
    } catch (error: any) {
      console.error('Auto-login failed:', error);
      // Clear invalid credentials
      this.clearSavedCredentials();
      this.loginForm.patchValue({
        email: '',
        password: '',
        rememberMe: false
      });
    } finally {
      this.loadingService.hide('auto-login');
    }
  }

  private async checkAuthStateAndAutoLogin(): Promise<void> {
    if (this.autoLoginAttempted) return;
    
    // First, check if Firebase Auth already has a session
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      console.log('User already authenticated via Firebase, redirecting to home');
      this.router.navigate(['/home']);
      return;
    }
    
    // If no Firebase session, attempt auto-login with saved credentials
    await this.attemptAutoLogin();
  }
}