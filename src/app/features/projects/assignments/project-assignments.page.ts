import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
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
      @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
      @if (message()) { <p class="notice success" role="status">{{ message() }}</p> }

      @if (selectedProjectId() === null) {
        <section class="project-selection" aria-labelledby="project-selection-title">
          <div class="project-section-heading">
            <div>
              <p class="eyebrow">YOUR WORKSPACE</p>
              <h2 id="project-selection-title">Choose a project</h2>
              <p class="section-description">Choose a project to manage its team and access.</p>
            </div>
            @if (!loadingProjects() && projects().length > 0) {
              <span class="project-count">{{ projects().length }} projects</span>
            }
          </div>

          @if (loadingProjects()) {
            <p class="project-state" role="status">Loading projects…</p>
          } @else if (projects().length === 0) {
            <p class="project-state">No projects are available to you.</p>
          } @else {
            <div class="project-grid">
              @for (project of projects(); track project.id) {
                <button class="project-card" type="button" (click)="selectProject(project.id)">
                  <span class="project-number">{{ project.projectNumber }}</span>
                  <strong class="project-name">{{ project.projectName }}</strong>
                  <span class="project-customer">{{ project.customerName }}</span>
                  @if (project.projectDescription) {
                    <span class="project-description">{{ project.projectDescription }}</span>
                  }
                  <span class="project-action">Manage team</span>
                </button>
              }
            </div>
          }
        </section>
      }

      @if (selectedProjectId() !== null) {
        <div class="workspace-heading">
          <div>
            <p class="eyebrow">{{ selectedProject()?.projectNumber }}</p>
            <h1>{{ selectedProject()?.projectName }}</h1>
          </div>
          <div class="workspace-actions">
            <button class="button secondary" type="button" (click)="selectProject(null)">Change project</button>
            <button class="button primary" type="button" (click)="openAddForm()"
              [attr.aria-expanded]="editorOpen()" aria-controls="team-member-editor"
              [disabled]="loadingProjectData() || saving() || (editorOpen() && editingUserId() !== null)">
              Add team member
            </button>
          </div>
        </div>
        <p class="workspace-description">Choose a project to manage its team and access.</p>

        @if (editorOpen()) {
          <section id="team-member-editor" class="panel access-editor">
            <div class="section-heading">
              <div>
                <p class="eyebrow">TEAM ACCESS</p>
                <h2 id="editor-title">{{ editingUserId() === null ? 'Add a team member' : 'Update team access' }}</h2>
              </div>
              <button class="button secondary" type="button" (click)="cancelEdit()">Close</button>
            </div>

            <form aria-labelledby="editor-title" (ngSubmit)="saveAssignment()">
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
                <button class="button secondary" type="button" (click)="cancelEdit()">Cancel</button>
                <button class="button primary" type="submit"
                  [disabled]="saving() || loadingProjectData() || selectedUserId() === null">
                  {{ saving() ? 'Saving…' : editingUserId() === null ? 'Assign team member' : 'Save access' }}
                </button>
              </div>
            </form>
          </section>
        }

        <section class="panel team-list" aria-labelledby="assigned-members-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">PROJECT TEAM</p>
              <h2 id="assigned-members-title">Assigned members</h2>
            </div>
            <span class="member-count">{{ assignments().length }} members</span>
          </div>

          @if (loadingProjectData()) {
            <p class="empty-state" role="status">Loading assignments…</p>
          } @else if (assignments().length === 0) {
            <p class="empty-state">No team members have been assigned to this project.</p>
          } @else {
            <div class="table-wrap">
              <table class="assignments-table">
                <thead>
                  <tr>
                    <th scope="col">Team member</th>
                    <th scope="col">Area access</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  @for (assignment of assignments(); track assignment.userId) {
                    <tr>
                      <td>
                        <div class="member-info">
                          <strong>{{ assignment.fullName }}</strong>
                          <span>{{ assignment.email }}</span>
                        </div>
                      </td>
                      <td>
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
                      </td>
                      <td>
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
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </main>
  `,
  styles: [`
    :host { display: block; }
    .team-page { max-width: 1440px; margin: 0 auto; padding: 28px clamp(18px, 2.4vw, 34px) 48px; color: #23324a; }
    .eyebrow { margin: 0 0 7px; color: #6574ad; font-size: 11px; font-weight: 800; letter-spacing: .1em; }
    h1 { margin: 0; font-size: clamp(26px, 3vw, 34px); letter-spacing: -.03em; }
    h2 { margin: 0; font-size: 19px; letter-spacing: -.015em; }
    .section-description { margin: 7px 0 0; color: #748197; font-size: 14px; }
    .project-selection { margin-bottom: 28px; }
    .project-section-heading, .workspace-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 14px; }
    .project-count { color: #78859a; font-size: 12px; }
    .project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
    .project-card { display: grid; min-width: 0; gap: 9px; padding: 17px 18px; border: 1px solid #e4e9f1; border-radius: 12px; background: #fff; color: inherit; text-align: left; cursor: pointer; transition: border-color .16s ease, background-color .16s ease; }
    .project-card:hover { border-color: #9daadd; background: #fbfcff; }
    .project-card:focus-visible { outline: 3px solid #aebaf0; outline-offset: 2px; }
    .project-number { color: #6675ad; font-size: 11px; font-weight: 800; letter-spacing: .04em; }
    .project-name { font-size: 15px; line-height: 1.4; }
    .project-customer { color: #758197; font-size: 12px; }
    .project-description { display: -webkit-box; overflow: hidden; color: #66748a; font-size: 12px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .project-action { margin-top: 3px; color: #5669ac; font-size: 12px; font-weight: 700; }
    .project-state { margin: 0; padding: 20px; border: 1px dashed #d9e0ea; border-radius: 12px; color: #78859a; text-align: center; }
    .workspace-heading { align-items: center; margin: 0; }
    .workspace-heading .eyebrow { margin-bottom: 5px; }
    .workspace-heading h1 { font-size: clamp(22px, 2.4vw, 30px); }
    .workspace-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; }
    .workspace-description { margin: 7px 0 20px; color: #748197; font-size: 14px; }
    .panel { min-width: 0; padding: clamp(18px, 2vw, 24px); border: 1px solid #e6eaf0; border-radius: 14px; background: #fff; }
    label { color: #35445c; font-size: 13px; font-weight: 700; }
    select { width: 100%; min-height: 42px; padding: 9px 11px; border: 1px solid #cbd4e1; border-radius: 8px; background: white; color: #26364e; font: inherit; }
    .access-editor { margin-bottom: 16px; }
    .section-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .user-field { display: grid; gap: 8px; margin-bottom: 20px; }
    .area-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; }
    .area-field { display: grid; gap: 7px; padding: 12px; border: 1px solid #e8edf3; border-radius: 10px; background: #fbfcfe; }
    .form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    .button { min-height: 38px; padding: 8px 13px; border: 0; border-radius: 8px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
    .button:disabled { cursor: not-allowed; opacity: .6; }
    .primary { color: #fff; background: #4057a5; }
    .secondary { color: #33435a; background: #edf1f6; }
    .danger { color: #a52d39; background: #fff0f1; }
    .member-count { color: #6f7d91; font-size: 13px; }
    .table-wrap { overflow-x: auto; }
    .assignments-table { width: 100%; border-collapse: collapse; text-align: left; }
    .assignments-table th { padding: 11px 12px; border-bottom: 1px solid #e9edf3; background: #f8f9fc; color: #69778d; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .assignments-table th:first-child { border-radius: 8px 0 0; }
    .assignments-table th:last-child { border-radius: 0 8px 0 0; }
    .assignments-table td { padding: 14px 12px; border-bottom: 1px solid #edf0f4; vertical-align: middle; }
    .assignments-table tbody tr:last-child td { border-bottom: 0; }
    .member-info { display: grid; min-width: 170px; gap: 5px; }
    .member-info strong { overflow-wrap: anywhere; }
    .member-info span, .legacy-access { color: #6f7d91; font-size: 12px; overflow-wrap: anywhere; }
    .member-access { display: flex; flex-wrap: wrap; gap: 7px; }
    .access-chip { padding: 6px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .read-only { color: #806b2b; background: #fbf5e5; }
    .read-write { color: #2f7057; background: #e8f4ed; }
    .member-actions { display: flex; min-width: 176px; flex-wrap: wrap; gap: 7px; }
    .empty-state { margin: 0; padding: 22px 0; color: #778398; text-align: center; }
    .notice { margin: 16px 0; padding: 12px 15px; border-radius: 9px; }
    .error { color: #a52d39; background: #fff0f1; }
    .success { color: #197048; background: #e7f7ef; }
    @media (max-width: 760px) {
      .team-page { padding-top: 22px; }
      .project-section-heading { align-items: flex-start; flex-direction: column; gap: 6px; }
      .workspace-heading { align-items: flex-start; flex-direction: column; }
      .workspace-actions { justify-content: flex-start; }
    }
    @media (max-width: 560px) {
      .team-page { padding: 20px 16px 36px; }
      .project-grid { grid-template-columns: 1fr; }
      .panel { padding: 16px; }
    }
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
  protected readonly selectedProject = computed(
    () => this.projects().find((project) => project.id === this.selectedProjectId()) ?? null,
  );
  protected readonly selectedUserId = signal<number | null>(null);
  protected readonly editingUserId = signal<number | null>(null);
  protected readonly editorOpen = signal(false);
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

  protected openAddForm(): void {
    if (this.editorOpen()) {
      return;
    }
    this.resetEditor();
    this.error.set('');
    this.message.set('');
    this.editorOpen.set(true);
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
    this.editorOpen.set(true);
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
        if (routeProjectId !== null) {
          this.selectedProjectId.set(routeProjectId);
          this.loadProjectData(routeProjectId);
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
    this.editorOpen.set(false);
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
