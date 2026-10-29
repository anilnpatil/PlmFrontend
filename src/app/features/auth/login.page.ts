import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from './auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  template: `
    <main class="login-page">
      <form class="login-card" (ngSubmit)="submit()" #form="ngForm">
        <p class="eyebrow">PROJECT LIFECYCLE MANAGEMENT</p>
        <h1>Sign in</h1>
        <p class="intro">Use your PLM account to continue.</p>
        @if (sessionMessage()) {
          <p class="session-message" role="status">{{ sessionMessage() }}</p>
        }
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="username"
          [(ngModel)]="email" required email />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password"
          [(ngModel)]="password" required />
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || submitting()">
          {{ submitting() ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .login-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f5f7fb; }
    .login-card { box-sizing: border-box; width: min(100%, 420px); padding: 36px; display: grid; gap: 12px; background: #fff; border: 1px solid #e4e8ef; border-radius: 16px; box-shadow: 0 16px 48px #1b2b4514; }
    .eyebrow { margin: 0; color: #5267a9; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
    h1 { margin: 4px 0 0; color: #17233b; }
    .intro { margin: 0 0 8px; color: #617087; }
    .session-message { margin: 0 0 4px; padding: 10px 12px; border-radius: 8px; background: #fff7e6; color: #8a5a00; font-size: 14px; }
    label { color: #344158; font-size: 14px; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid #cbd3e0; border-radius: 8px; font: inherit; }
    button { margin-top: 8px; padding: 12px; border: 0; border-radius: 8px; background: #4057a5; color: white; font: inherit; font-weight: 700; cursor: pointer; }
    button:disabled { opacity: .6; cursor: wait; }
    .error { margin: 0; color: #a52d39; font-size: 14px; }
  `],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected email = '';
  protected password = '';
  protected readonly error = signal('');
  protected readonly submitting = signal(false);
  protected readonly sessionMessage = signal(
    this.route.snapshot.queryParamMap.get('reason') === 'idle'
      || this.auth.sessionExpiredByIdle()
      ? 'You were signed out after 5 minutes of inactivity.'
      : '',
  );

  protected submit(): void {
    this.error.set('');
    this.submitting.set(true);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        void this.router.navigateByUrl('/');
      },
      error: (error: unknown) => {
        this.error.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? 'Email or password is incorrect, or the account is inactive.'
            : 'Unable to sign in. Please try again later.',
        );
        this.submitting.set(false);
      },
      complete: () => this.submitting.set(false),
    });
  }
}
