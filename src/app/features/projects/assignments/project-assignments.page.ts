import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthUser } from '../../auth/auth.models';
import { AdminApiService, AreaAccessLevel, FunctionalArea, ProjectAssignment } from '../../admin/admin-api.service';
import { Project, ProjectsService } from '../projects.service';

const TEAM_AREA_ORDER = ['DESIGN', 'PURCHASE', 'MANUFACTURING', 'STOCK', 'ELECTRICAL', 'CONTROLS', 'ASSEMBLY'];

@Component({
  selector: 'app-project-assignments-page',
  imports: [FormsModule],
  template: `
    <main class="team-page">
      <header class="page-header">
        <div>
          <p class="eyebrow">PROJECT ACCESS</p>
          <h1>Team assignments</h1>
          <p class="description">Choose a project, then set each team member's access area by area.</p>
        </div>
      </header>

      @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="notice success" role="status">{{ message() }}</p> }

      <section class="panel project-picker">
        <label for="project-select">Project</label>
        <select id="project-select" name="projectId" [ngModel]="selectedProjectId()"
          (ngModelChange)="selectProject($event)" [disabled]="loadingProjects()">
          <option [ngValue]="null">Select a project</option>
          @for (project of projects(); track project.id) {
            <option [ngValue]="project.id">{{ project.projectNumber }} — {{ project.projectName }}</option>
          }
        </select>
        @if (loadingProjects()) { <span role="status">Loading projects…</span> }
        @else if (projects().length === 0) { <span>No projects are available to you.</span> }
      </section>

      @if (selectedProjectId() !== null) {
        <section class="panel access-editor">
          <div class="section-heading">
            <div>
              <p class="eyebrow">ASSIGN ACCESS</p>
              <h2>{{ editingUserId() === null ? 'Add a team member' : 'Update team access' }}</h2>
            </div>
            @if (editingUserId() !== null) {
              <button class="button secondary" type="button" (click)="cancelEdit()">Cancel edit</button>
            }
          </div>

          <form (ngSubmit)="saveAssignment()">
            <label class="user-field">Team member
              <select name="userId" [ngModel]="selectedUserId()" (ngModelChange)="selectUser($event)"
                [disabled]="saving() || loadingProjectData()" required>
                <option [ngValue]="null">Select a user</option>
                @for (user of users(); track user.id) {
                  <option [ngValue]="user.id">{{ user.fullName }} — {{ user.email }}</option>
                }
              </select>
            </label>

            <div class="area-grid">
              @for (area of areas(); track area.code) {
                <label class="area-field">
                  <span>{{ area.name }}</span>
                  <select [name]="'access-' + area.code" [ngModel]="draftAccessValue(area.code)"
                    (ngModelChange)="setAreaAccess(area.code, $event)" [disabled]="saving()">
                    <option value="">No access</option>
                    <option value="READ_ONLY">Read only</option>
                    <option value="READ_WRITE">Read and write</option>
                  </select>
                </label>
              }
            </div>

            @if (loadingProjectData()) { <p role="status">Loading project team…</p> }
            <div class="form-actions">
              <button class="button primary" type="submit"
                [disabled]="saving() || loadingProjectData() || selectedUserId() === null">
                {{ saving() ? 'Saving…' : editingUserId() === null ? 'Assign team member' : 'Save access' }}
              </button>
            </div>
          </form>
        </section>

        <section class="panel team-list">
          <div class="section-heading">
            <div>
              <p class="eyebrow">PROJECT TEAM</p>
              <h2>Assigned members</h2>
            </div>
            <span class="member-count">{{ assignments().length }} members</span>
          </div>

          @if (loadingProjectData()) {
            <p class="empty-state" role="status">Loading assignments…</p>
          } @else if (assignments().length === 0) {
            <p class="empty-state">No team members have been assigned to this project.</p>
          } @else {
            @for (assignment of assignments(); track assignment.userId) {
              <article class="member-row">
                <div class="member-info">
                  <strong>{{ assignment.fullName }}</strong>
                  <span>{{ assignment.email }}</span>
                </div>
                <div class="member-access">
                  @for (area of areas(); track area.code) {
                    @if (assignment.areaAccess[area.code]) {
                      <span class="access-chip"
                        [class.read-only]="assignment.areaAccess[area.code] === 'READ_ONLY'"
                        [class.read-write]="assignment.areaAccess[area.code] === 'READ_WRITE'">
                        {{ area.name }} · {{ accessLabel(assignment.areaAccess[area.code]) }}
                      </span>
                    }
                  }
                  @if (!hasAreaAccess(assignment)) {
                    <span class="legacy-access">Legacy role access: {{ assignment.roles.join(', ') || 'No area access set' }}</span>
                  }
                </div>
                <div class="member-actions">
                  <button class="button secondary" type="button" (click)="editAssignment(assignment)">Edit</button>
                  @if (removingUserId() === assignment.userId) {
                    <button class="button danger" type="button" (click)="removeAssignment(assignment)"
                      [disabled]="saving()">Confirm remove</button>
                    <button class="button secondary" type="button" (click)="cancelRemove()">Cancel</button>
                  } @else {
                    <button class="button danger" type="button" (click)="confirmRemove(assignment.userId)">Remove</button>
                  }
                </div>
              </article>
            }
          }
        </section>
      }
    </main>
  `,
  styles: [`
    :host { display: block; }
    .team-page { max-width: 1180px; margin: 0 auto; padding: 28px clamp(16px, 3vw, 36px) 48px; color: #23324a; }
    .page-header { margin-bottom: 24px; }
    .eyebrow { margin: 0 0 7px; color: #5267a9; font-size: 11px; font-weight: 800; letter-spacing: .1em; }
    h1 { margin: 0; font-size: clamp(26px, 3vw, 34px); letter-spacing: -.03em; }
    h2 { margin: 0; font-size: 19px; }
    .description { margin: 8px 0 0; color: #69778c; }
    .panel { margin: 18px 0; padding: clamp(18px, 2.5vw, 26px); border: 1px solid #e1e7ef; border-radius: 14px; background: #fff; box-shadow: 0 8px 22px #1e34500a; }
    .project-picker { display: grid; grid-template-columns: minmax(110px, .25fr) minmax(240px, 1fr) auto; align-items: center; gap: 14px; }
    label { color: #35445c; font-size: 13px; font-weight: 700; }
    select { width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #cbd4e1; border-radius: 8px; background: white; color: #26364e; font: inherit; }
    .project-picker span { color: #778398; font-size: 12px; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
    .user-field { display: grid; max-width: 620px; gap: 8px; margin-bottom: 20px; }
    .area-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
    .area-field { display: grid; gap: 7px; padding: 12px; border: 1px solid #e8edf3; border-radius: 10px; background: #fbfcfe; }
    .form-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
    .button { min-height: 38px; padding: 8px 13px; border: 0; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    .button:disabled { cursor: not-allowed; opacity: .6; }
    .primary { color: #fff; background: #4057a5; }
    .secondary { color: #33435a; background: #edf1f6; }
    .danger { color: #a52d39; background: #fff0f1; }
    .member-count { color: #6f7d91; font-size: 13px; }
    .member-row { display: grid; grid-template-columns: minmax(180px, .8fr) minmax(240px, 1.8fr) auto; align-items: center; gap: 18px; padding: 18px 0; border-top: 1px solid #edf0f4; }
    .member-info { display: grid; gap: 5px; min-width: 0; }
    .member-info strong { overflow-wrap: anywhere; }
    .member-info span, .legacy-access { color: #6f7d91; font-size: 12px; overflow-wrap: anywhere; }
    .member-access { display: flex; flex-wrap: wrap; gap: 7px; }
    .access-chip { padding: 6px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .read-only { color: #6e5612; background: #fff5d5; }
    .read-write { color: #185b42; background: #def5e9; }
    .member-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; }
    .empty-state { margin: 0; padding: 22px 0; color: #778398; text-align: center; }
    .notice { margin: 16px 0; padding: 12px 15px; border-radius: 9px; }
    .error { color: #a52d39; background: #fff0f1; }
    .success { color: #197048; background: #e7f7ef; }
    @media (max-width: 800px) { .member-row { grid-template-columns: 1fr; gap: 12px; } .member-actions { justify-content: flex-start; } }
    @media (max-width: 560px) { .project-picker { grid-template-columns: 1fr; gap: 8px; } }
  `],
})
export class ProjectAssignmentsPage {
  private readonly api = inject(AdminApiService);
  private readonly projectsService = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly projects = signal<Project[]>([]);
  protected readonly users = signal<AuthUser[]>([]);
  protected readonly areas = signal<FunctionalArea[]>([]);
  protected readonly assignments = signal<ProjectAssignment[]>([]);
  protected readonly selectedProjectId = signal<number | null>(null);
  protected readonly selectedUserId = signal<number | null>(null);
  protected readonly editingUserId = signal<number | null>(null);
  protected readonly draftAccess = signal<Record<string, AreaAccessLevel | ''>>({});
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly loadingProjects = signal(false);
  protected readonly loadingProjectData = signal(false);
  protected readonly saving = signal(false);
  protected readonly removingUserId = signal<number | null>(null);

  constructor() {
    const routeProjectId = Number(this.route.snapshot.paramMap.get('projectId'));
    this.loadProjects(Number.isSafeInteger(routeProjectId) && routeProjectId > 0 ? routeProjectId : null);
  }

  protected selectProject(projectId: number | null): void {
    if (projectId === this.selectedProjectId()) {
      return;
    }
    this.selectedProjectId.set(projectId);
    this.resetEditor();
    this.assignments.set([]);
    if (projectId !== null) {
      this.loadProjectData(projectId);
    }
  }

  protected selectUser(userId: number | null): void {
    this.selectedUserId.set(userId);
    this.editingUserId.set(null);
    this.draftAccess.set({});
  }

  protected setAreaAccess(areaCode: string, value: string): void {
    if (value !== '' && value !== 'READ_ONLY' && value !== 'READ_WRITE') {
      return;
    }
    this.draftAccess.update((current) => ({ ...current, [areaCode]: value }));
  }

  protected saveAssignment(): void {
    const projectId = this.selectedProjectId();
    const userId = this.selectedUserId();
    if (projectId === null || userId === null || this.saving()) {
      return;
    }
    const areaAccess = Object.fromEntries(
      Object.entries(this.draftAccess()).filter((entry): entry is [string, AreaAccessLevel] => entry[1] !== ''),
    );
    if (Object.keys(areaAccess).length === 0) {
      this.error.set('Select at least one area and choose Read only or Read and write.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.api.assignUser(projectId, userId, areaAccess).subscribe({
      next: (assignment) => {
        this.assignments.update((items) => [
          ...items.filter((item) => item.userId !== assignment.userId),
          assignment,
        ].sort((a, b) => a.fullName.localeCompare(b.fullName)));
        this.message.set(`Access saved for ${assignment.fullName}.`);
        this.saving.set(false);
        this.resetEditor();
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error, 'Unable to save the team assignment.'));
        this.saving.set(false);
      },
    });
  }

  protected editAssignment(assignment: ProjectAssignment): void {
    this.selectedUserId.set(assignment.userId);
    this.editingUserId.set(assignment.userId);
    this.draftAccess.set({ ...assignment.areaAccess });
    this.error.set('');
    this.message.set('');
  }

  protected cancelEdit(): void {
    this.resetEditor();
  }

  protected confirmRemove(userId: number): void {
    this.removingUserId.set(userId);
  }

  protected cancelRemove(): void {
    this.removingUserId.set(null);
  }

  protected removeAssignment(assignment: ProjectAssignment): void {
    const projectId = this.selectedProjectId();
    if (projectId === null || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.api.removeAssignment(projectId, assignment.userId).subscribe({
      next: () => {
        this.assignments.update((items) => items.filter((item) => item.userId !== assignment.userId));
        this.message.set(`${assignment.fullName} was removed from this project.`);
        this.removingUserId.set(null);
        this.saving.set(false);
        if (this.selectedUserId() === assignment.userId) {
          this.resetEditor();
        }
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error, 'Unable to remove the project assignment.'));
        this.saving.set(false);
      },
    });
  }

  protected accessLabel(access: AreaAccessLevel): string {
    return access === 'READ_WRITE' ? 'Read and write' : 'Read only';
  }

  protected hasAreaAccess(assignment: ProjectAssignment): boolean {
    return Object.keys(assignment.areaAccess ?? {}).length > 0;
  }

  protected draftAccessValue(areaCode: string): AreaAccessLevel | '' {
    return this.draftAccess()[areaCode] || '';
  }

  private loadProjects(routeProjectId: number | null): void {
    this.loadingProjects.set(true);
    this.projectsService.searchProjects({
      page: 0,
      size: 100,
      sortBy: 'projectName',
      sortDirection: 'ASC',
    }).subscribe({
      next: (result) => {
        this.projects.set(result.content);
        this.loadingProjects.set(false);
        const selected = routeProjectId ?? result.content[0]?.id ?? null;
        if (selected !== null) {
          this.selectedProjectId.set(selected);
          this.loadProjectData(selected);
        }
      },
      error: (error: unknown) => {
        this.loadingProjects.set(false);
        this.error.set(this.describeError(error, 'Unable to load projects for team assignment.'));
      },
    });
  }

  private loadProjectData(projectId: number): void {
    this.loadingProjectData.set(true);
    this.error.set('');
    forkJoin({
      users: this.api.listProjectUsers(projectId),
      areas: this.api.listFunctionalAreas(),
      assignments: this.api.listAssignments(projectId),
    }).subscribe({
      next: (data) => {
        this.users.set(data.users);
        this.areas.set(data.areas
          .filter((area) => TEAM_AREA_ORDER.includes(area.code.toUpperCase()))
          .sort((a, b) => TEAM_AREA_ORDER.indexOf(a.code.toUpperCase())
            - TEAM_AREA_ORDER.indexOf(b.code.toUpperCase())));
        this.assignments.set(data.assignments.sort((a, b) => a.fullName.localeCompare(b.fullName)));
        this.loadingProjectData.set(false);
      },
      error: (error: unknown) => {
        this.loadingProjectData.set(false);
        this.error.set(this.describeError(error, 'Unable to load team assignments. You may not have assignment access to this project.'));
      },
    });
  }

  private resetEditor(): void {
    this.selectedUserId.set(null);
    this.editingUserId.set(null);
    this.draftAccess.set({});
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 0) {
      return 'Cannot reach the backend. Check that the server is running and try again.';
    }
    if (error.status === 403) {
      return 'You do not have permission to manage this project team.';
    }
    if (typeof error.error === 'object' && error.error !== null && 'detail' in error.error
      && typeof error.error.detail === 'string') {
      return error.error.detail;
    }
    return fallback;
  }
}
