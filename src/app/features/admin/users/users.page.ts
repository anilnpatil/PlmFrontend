import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthUser } from '../../auth/auth.models';
import { AdminApiService, Role } from '../admin-api.service';

@Component({
  selector: 'app-users-page',
  imports: [FormsModule, RouterLink],
  template: `
    <main class="admin-page">
      <header class="page-header">
        <div><p>ADMINISTRATION</p><h1>User management</h1></div>
        <a class="back-button" routerLink="/">← Overview</a>
      </header>
      <form class="panel form" (ngSubmit)="saveUser()" #form="ngForm">
        <h2>{{ editingId() === null ? 'Create account' : 'Update account' }}</h2>
        <label>Full name<input name="fullName" [(ngModel)]="fullName" required maxlength="120" /></label>
        @if (editingId() === null) {
          <label>Email<input name="email" type="email" [(ngModel)]="email" required email /></label>
        }
        <label>{{ editingId() === null ? 'Initial password' : 'New password (optional)' }}
          <input name="password" type="password" [(ngModel)]="password"
            [required]="editingId() === null" [minlength]="password ? 12 : null" />
        </label>
        <div class="role-field">
          <span class="field-label">Roles</span>
          <details class="role-picker">
            <summary>{{ roleSelectionLabel() }}</summary>
            <div class="role-options">
              @for (role of roles(); track role.id) {
                <label class="role-option">
                  <input type="checkbox" [ngModel]="selectedRoleCodes.includes(role.code)"
                    (ngModelChange)="toggleRole(role.code, $event)" [ngModelOptions]="{standalone: true}" />
                  <span>{{ role.name }} <small>({{ role.code }})</small></span>
                </label>
              } @empty {
                <span class="no-roles">No roles available.</span>
              }
            </div>
          </details>
          @if (selectedRoleCodes.length) {
            <div class="selected-roles" aria-label="Selected roles">
              @for (roleCode of selectedRoleCodes; track roleCode) {
                <span class="role-chip">{{ roleCode }}</span>
              }
            </div>
          }
        </div>
        <div class="actions">
          <button [disabled]="form.invalid || busy()">{{ editingId() === null ? 'Create user' : 'Save changes' }}</button>
          @if (editingId() !== null) { <button type="button" class="secondary" (click)="reset()">Cancel</button> }
        </div>
      </form>
      @if (message()) { <p class="message" role="status">{{ message() }}</p> }
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      <section class="panel">
        <h2>Accounts</h2>
        @if (users().length === 0) { <p>No users found.</p> }
        @for (user of users(); track user.id) {
          <article class="user-row">
            <div><strong>{{ user.fullName }}</strong><span>{{ user.email }}</span></div>
            <div><span>{{ user.roles.join(', ') || 'No roles' }}</span>
              <span class="status" [class.inactive]="!user.active">{{ user.active ? 'Active' : 'Inactive' }}</span></div>
            <div class="actions">
              <button type="button" class="secondary" [disabled]="busy()" (click)="edit(user)">Edit</button>
              <button type="button" [disabled]="busy()" (click)="toggleStatus(user)">
                {{ user.active ? 'Deactivate' : 'Activate' }}
              </button>
            </div>
          </article>
        }
      </section>
    </main>
  `,
  styles: [`
    .admin-page { max-width: 900px; margin: 40px auto; padding: 0 24px; color: #24324a; }
    header p { color: #5267a9; font-size: 12px; font-weight: 700; letter-spacing: .08em; }
    h1 { margin-top: 4px; } h2 { margin: 0 0 18px; font-size: 18px; }
    .page-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .back-button { padding: 8px 12px; border: 1px solid #d6dce7; border-radius: 7px; color: #344158; background: white; font-size: 14px; text-decoration: none; }
    .back-button:hover { background: #f5f7fb; }
    .panel { margin: 20px 0; padding: 22px; border: 1px solid #e1e6ee; border-radius: 12px; background: white; }
    .form { display: grid; gap: 12px; }
    label { display: grid; gap: 6px; font-size: 14px; font-weight: 600; }
    input { padding: 10px; border: 1px solid #cbd3e0; border-radius: 7px; font: inherit; }
    .role-field { display: grid; gap: 8px; }
    .field-label { font-size: 14px; font-weight: 600; }
    .role-picker { position: relative; width: fit-content; min-width: 190px; }
    .role-picker summary { padding: 9px 12px; border: 1px solid #cbd3e0; border-radius: 7px; cursor: pointer; list-style: none; }
    .role-picker summary::-webkit-details-marker { display: none; }
    .role-picker summary::after { content: '▾'; float: right; margin-left: 18px; color: #64728a; }
    .role-picker[open] summary { border-color: #4057a5; border-radius: 7px 7px 0 0; }
    .role-options { position: absolute; z-index: 1; top: 100%; left: 0; box-sizing: border-box; width: max(100%, 260px); max-height: 240px; overflow-y: auto; padding: 6px; border: 1px solid #cbd3e0; border-top: 0; border-radius: 0 0 7px 7px; background: white; box-shadow: 0 8px 18px #1b2b4518; }
    .role-option { display: flex; align-items: center; gap: 9px; padding: 8px; border-radius: 5px; cursor: pointer; font-weight: 400; }
    .role-option:hover { background: #f5f7fb; }
    .role-option input { margin: 0; accent-color: #4057a5; }
    .role-option small, .no-roles { color: #64728a; font-size: 12px; }
    .no-roles { display: block; padding: 8px; }
    .selected-roles { display: flex; flex-wrap: wrap; gap: 6px; }
    .role-chip { padding: 4px 8px; border-radius: 999px; color: #344158; background: #e9edf4; font-size: 12px; }
    button { padding: 10px 14px; border: 0; border-radius: 7px; color: white; background: #4057a5; font: inherit; cursor: pointer; }
    .secondary { color: #344158; background: #e9edf4; } .actions { display: flex; gap: 8px; }
    button:disabled { opacity: .6; }
    .user-row { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 16px; padding: 14px 0; border-top: 1px solid #edf0f4; }
    .user-row div { display: grid; gap: 5px; } .user-row span { color: #64728a; font-size: 13px; }
    .status { color: #197048 !important; } .status.inactive { color: #a52d39 !important; }
    .error { color: #a52d39; } .message { color: #197048; }
    @media (max-width: 650px) { .user-row { grid-template-columns: 1fr; } }
  `],
})
export class UsersPage {
  private readonly api = inject(AdminApiService);
  protected readonly users = signal<AuthUser[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly editingId = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected fullName = '';
  protected email = '';
  protected password = '';
  protected selectedRoleCodes: string[] = [];

  constructor() {
    forkJoin({ users: this.api.listUsers(), roles: this.api.listRoles() }).subscribe({
      next: ({ users, roles }) => {
        this.users.set(users);
        this.roles.set(roles);
      },
      error: () => this.error.set('Unable to load administration data.'),
    });
  }

  protected saveUser(): void {
    this.busy.set(true);
    this.error.set('');
    const request = this.editingId() === null
      ? this.api.createUser({
          fullName: this.fullName.trim(),
          email: this.email.trim(),
          password: this.password,
          roleCodes: this.selectedRoleCodes,
        })
      : this.api.updateUser(this.editingId()!, {
          fullName: this.fullName.trim(),
          ...(this.password ? { password: this.password } : {}),
          roleCodes: this.selectedRoleCodes,
        });
    request.subscribe({
      next: (user) => {
        this.users.update((users) => this.editingId() === null
          ? [...users, user]
          : users.map((item) => item.id === user.id ? user : item));
        this.message.set(this.editingId() === null ? 'User account created.' : 'User account updated.');
        this.reset();
        this.busy.set(false);
      },
      error: () => {
        this.error.set('Unable to create user. Check the email and role codes.');
        this.busy.set(false);
      },
    });
  }

  protected edit(user: AuthUser): void {
    this.editingId.set(user.id);
    this.fullName = user.fullName;
    this.email = user.email;
    this.password = '';
    this.selectedRoleCodes = [...user.roles];
  }

  protected reset(): void {
    this.editingId.set(null);
    this.fullName = '';
    this.email = '';
    this.password = '';
    this.selectedRoleCodes = [];
  }

  protected toggleStatus(user: AuthUser): void {
    this.busy.set(true);
    this.api.updateUserStatus(user.id, !user.active).subscribe({
      next: (updated) => {
        this.users.update((users) => users.map((item) => item.id === updated.id ? updated : item));
        this.busy.set(false);
      },
      error: () => {
        this.error.set('Unable to update account status.');
        this.busy.set(false);
      },
    });
  }

  protected toggleRole(roleCode: string, selected: boolean): void {
    this.selectedRoleCodes = selected
      ? [...this.selectedRoleCodes, roleCode]
      : this.selectedRoleCodes.filter((code) => code !== roleCode);
  }

  protected roleSelectionLabel(): string {
    return this.selectedRoleCodes.length
      ? `${this.selectedRoleCodes.length} role${this.selectedRoleCodes.length === 1 ? '' : 's'} selected`
      : 'Select roles';
  }
}
