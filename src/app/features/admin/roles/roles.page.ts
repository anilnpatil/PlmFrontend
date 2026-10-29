import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { AdminApiService, Role } from '../admin-api.service';

@Component({
  selector: 'app-roles-page',
  imports: [FormsModule],
  template: `
    <main class="admin-page">
      <header><p>ADMINISTRATION</p><h1>Roles and permissions</h1></header>
      <form class="panel form" (ngSubmit)="save()" #form="ngForm">
        <h2>{{ editingId() === null ? 'Create role' : 'Update role' }}</h2>
        <label>Role code<input name="code" [(ngModel)]="code" required pattern="[A-Z][A-Z0-9_]{1,79}" /></label>
        <label>Name<input name="name" [(ngModel)]="name" required maxlength="120" /></label>
        <label>Description<input name="description" [(ngModel)]="description" maxlength="500" /></label>
        <label>Permission codes (comma separated)<textarea name="permissions" [(ngModel)]="permissionCodes" rows="4"></textarea></label>
        <div class="actions">
          <button [disabled]="form.invalid || busy()">Save role</button>
          @if (editingId() !== null) { <button type="button" class="secondary" (click)="reset()">Cancel</button> }
        </div>
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="message" role="status">{{ message() }}</p> }
      <section class="panel">
        <h2>Configured roles</h2>
        @for (role of roles(); track role.id) {
          <article class="role-row">
            <div><strong>{{ role.name }} ({{ role.code }})</strong><p>{{ role.description }}</p>
              <small>{{ role.permissions.join(', ') || 'No permissions' }}</small></div>
            <button type="button" class="secondary" (click)="edit(role)">Edit</button>
          </article>
        }
      </section>
    </main>
  `,
  styles: [`
    .admin-page { max-width: 900px; margin: 40px auto; padding: 0 24px; color: #24324a; }
    header p { color: #5267a9; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
    h1 { margin-top: 4px; } h2 { margin: 0 0 18px; font-size: 18px; }
    .panel { margin: 20px 0; padding: 22px; border: 1px solid #e1e6ee; border-radius: 12px; background: white; }
    .form { display: grid; gap: 12px; } label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
    input, textarea { padding: 10px; border: 1px solid #cbd3e0; border-radius: 7px; font: inherit; }
    button { padding: 10px 14px; border: 0; border-radius: 7px; color: white; background: #4057a5; font: inherit; cursor: pointer; }
    .secondary { color: #344158; background: #e9edf4; } .actions { display: flex; gap: 10px; }
    .role-row { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid #edf0f4; }
    .role-row p { margin: 5px 0; } .role-row small { color: #64728a; }
    .error { color: #a52d39; } .message { color: #197048; }
  `],
})
export class RolesPage {
  private readonly api = inject(AdminApiService);
  protected readonly roles = signal<Role[]>([]);
  protected readonly editingId = signal<number | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected code = '';
  protected name = '';
  protected description = '';
  protected permissionCodes = '';

  constructor() {
    this.load();
  }

  protected save(): void {
    const request = {
      code: this.code.trim().toUpperCase(),
      name: this.name.trim(),
      description: this.description.trim(),
      permissionCodes: this.permissionCodes.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean),
    };
    this.busy.set(true);
    this.error.set('');
    const request$ = this.editingId() === null
      ? this.api.createRole(request)
      : this.api.updateRole(this.editingId()!, request);
    request$.subscribe({
      next: () => {
        this.message.set('Role saved.');
        this.reset();
        this.load();
        this.busy.set(false);
      },
      error: () => {
        this.error.set('Unable to save role. Check role and permission codes.');
        this.busy.set(false);
      },
    });
  }

  protected edit(role: Role): void {
    this.editingId.set(role.id);
    this.code = role.code;
    this.name = role.name;
    this.description = role.description ?? '';
    this.permissionCodes = role.permissions.join(', ');
  }

  protected reset(): void {
    this.editingId.set(null);
    this.code = '';
    this.name = '';
    this.description = '';
    this.permissionCodes = '';
  }

  private load(): void {
    this.api.listRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => this.error.set('Unable to load roles.'),
    });
  }
}
