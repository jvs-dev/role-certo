import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginFormComponent } from '../login-form/login-form.component';
import { RegisterFormComponent } from '../register-form/register-form.component';

@Component({
  selector: 'app-auth-page',
  imports: [CommonModule, LoginFormComponent, RegisterFormComponent],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss'
})
export class AuthPageComponent {
  isLoginMode = true;

  toggleMode(): void {
    this.isLoginMode = !this.isLoginMode;
  }
}
