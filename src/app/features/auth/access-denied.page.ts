import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <main class="denied">
      <h1>Access denied</h1>
      <p>Your account is not authorized to open this page.</p>
      <a routerLink="/">Return to workspace</a>
    </main>
  `,
  styles: [`
    .denied { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: 8px; padding: 24px; color: #24324a; text-align: center; }
    h1, p { margin: 0; }
  `],
})
export class AccessDeniedPage {}
