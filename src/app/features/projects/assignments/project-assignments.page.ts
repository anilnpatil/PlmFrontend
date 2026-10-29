import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthUser } from '../../auth/auth.models';
import { AdminApiService, FunctionalArea, ProjectAssignment, Role } from '../../admin/admin-api.service';

@Component({
  selector: 'app-project-assignments-page',
  imports: [FormsModule],
  template: `
    <main class="admin-page">
      <header><p>PROJECT ACCESS</p><h1>Project team assignments</h1><span>Project {{ projectId }}</span></header>
      <form class="panel form" (ngSubmit)="assign()" #form="ngForm">
        <h2>Assign a user</h2>
        <label>User
          <select name="userId" [(ngModel)]="userId" required>
            <option [ngValue]="null">Select a user</option>
            @for (user of users(); track user.id) { <option [ngValue]="user.id">{{ user.fullName }} — {{ user.email }}</option> }
          </select>
        </label>
        <label>Role codes (comma separated)<input name="roles" [(ngModel)]="roleCodes" placeholder="DESIGNER" /></label>
        <label>Functional-area codes (comma separated)<input name="areas" [(ngModel)]="areaCodes" placeholder="DESIGN" /></label>
        <small>Available roles: {{ roleCodeList() }}</small>
        <small>Available areas: {{ areaCodeList() }}</small>
        <button [disabled]="form.invalid || busy()">Save assignment</button>
      </form>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="message" role="status">{{ message() }}</p> }
      <section class="panel">
        <h2>Assigned team</h2>
        @for (assignment of assignments(); track assignment.userId) {
          <article class="assignment-row">
            <div><strong>{{ assignment.fullName }}</strong><span>{{ assignment.email }}</span></div>
            <div><span>Roles: {{ assignment.roles.join(', ') }}</span>
              <span>Areas: {{ assignment.functionalAreas.join(', ') }}</span></div>
            <button type="button" class="secondary" (click)="remove(assignment.userId)">Remove</button>
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
    input, select { padding: 10px; border: 1px solid #cbd3e0; border-radius: 7px; font: inherit; }
    button { padding: 10px 14px; border: 0; border-radius: 7px; color: white; background: #4057a5; font: inherit; cursor: pointer; }
    .secondary { color: #344158; background: #e9edf4; }
    .assignment-row { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 16px; padding: 14px 0; border-top: 1px solid #edf0f4; }
    .assignment-row div { display: grid; gap: 5px; } .assignment-row span { color: #64728a; font-size: 13px; }
    .error { color: #a52d39; } .message { color: #197048; }
    @media (max-width: 650px) { .assignment-row { grid-template-columns: 1fr; } }
  `],
})
export class ProjectAssignmentsPage {
  private readonly api = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));
  protected readonly users = signal<AuthUser[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly areas = signal<FunctionalArea[]>([]);
  protected readonly assignments = signal<ProjectAssignment[]>([]);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected userId: number | null = null;
  protected roleCodes = '';
  protected areaCodes = '';

  constructor() {
    forkJoin({
      users: this.api.listProjectUsers(this.projectId),
      roles: this.api.listRoles(),
      areas: this.api.listFunctionalAreas(),
      assignments: this.api.listAssignments(this.projectId),
    }).subscribe({
      next: (data) => {
        this.users.set(data.users);
        this.roles.set(data.roles);
        this.areas.set(data.areas);
        this.assignments.set(data.assignments);
      },
      error: () => this.error.set('Unable to load project assignment data.'),
    });
  }

  protected assign(): void {
    if (this.userId === null) {
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.api.assignUser(this.projectId, this.userId, this.parseCodes(this.roleCodes), this.parseCodes(this.areaCodes))
      .subscribe({
        next: (assignment) => {
          this.assignments.update((items) => [
            ...items.filter((item) => item.userId !== assignment.userId),
            assignment,
          ]);
          this.message.set('Project assignment saved.');
          this.busy.set(false);
        },
        error: () => {
          this.error.set('Unable to save assignment. Check the selected user, roles, and areas.');
          this.busy.set(false);
        },
      });
  }

  protected remove(userId: number): void {
    this.api.removeAssignment(this.projectId, userId).subscribe({
      next: () => this.assignments.update((items) => items.filter((item) => item.userId !== userId)),
      error: () => this.error.set('Unable to remove the project assignment.'),
    });
  }

  private parseCodes(value: string): string[] {
    return value.split(',').map((code) => code.trim().toUpperCase()).filter(Boolean);
  }

  protected roleCodeList(): string {
    return this.roles().map((role) => role.code).join(', ');
  }

  protected areaCodeList(): string {
    return this.areas().map((area) => area.code).join(', ');
  }
}
