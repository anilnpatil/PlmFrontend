import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { Project, ProjectRequest, ProjectsService } from './projects.service';

interface ProjectDraft {
  projectNumber: string;
  projectName: string;
  projectDescription: string;
  customerName: string;
  customerAddress: string;
  targetStartDate: string;
  targetEndDate: string;
}

function emptyDraft(): ProjectDraft {
  return {
    projectNumber: '',
    projectName: '',
    projectDescription: '',
    customerName: '',
    customerAddress: '',
    targetStartDate: '',
    targetEndDate: '',
  };
}

@Component({
  selector: 'app-projects-page',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './projects.page.html',
  styleUrl: './projects.page.scss',
})
export class ProjectsPage {
  protected readonly auth = inject(AuthService);
  private readonly projectsService = inject(ProjectsService);

  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly deleteConfirmationId = signal<number | null>(null);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);

  protected projectNumberFilter = '';
  protected projectNameFilter = '';
  protected customerNameFilter = '';
  protected draft = emptyDraft();

  constructor() {
    this.loadProjects();
  }

  protected search(): void {
    this.page.set(0);
    this.loadProjects();
  }

  protected changePage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.page.set(page);
      this.loadProjects();
    }
  }

  protected startCreate(): void {
    this.editingId.set(null);
    this.draft = emptyDraft();
    this.formOpen.set(true);
    this.error.set('');
    this.message.set('');
  }

  protected startEdit(project: Project): void {
    this.editingId.set(project.id);
    this.draft = {
      projectNumber: project.projectNumber,
      projectName: project.projectName,
      projectDescription: project.projectDescription ?? '',
      customerName: project.customerName,
      customerAddress: project.customerAddress ?? '',
      targetStartDate: project.targetStartDate ?? '',
      targetEndDate: project.targetEndDate ?? '',
    };
    this.formOpen.set(true);
    this.error.set('');
    this.message.set('');
  }

  protected cancelForm(): void {
    this.formOpen.set(false);
    this.editingId.set(null);
  }

  protected save(form: NgForm): void {
    if (form.invalid || this.saving()) {
      form.control.markAllAsTouched();
      return;
    }

    const request = this.toRequest(this.draft);
    const editingId = this.editingId();
    this.saving.set(true);
    this.error.set('');
    this.message.set('');

    const operation = editingId === null
      ? this.projectsService.createProject(request)
      : this.projectsService.updateProject(editingId, request);

    operation.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.editingId.set(null);
        this.message.set(editingId === null ? 'Project created.' : 'Project updated.');
        this.loadProjects();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to save the project.'));
      },
    });
  }

  protected deleteProject(project: Project): void {
    if (this.deleteConfirmationId() !== project.id) {
      this.deleteConfirmationId.set(project.id);
      return;
    }

    this.error.set('');
    this.message.set('');
    this.projectsService.deleteProject(project.id).subscribe({
      next: () => {
        this.deleteConfirmationId.set(null);
        this.message.set('Project deleted.');
        if (this.projects().length === 1 && this.page() > 0) {
          this.page.update((current) => current - 1);
        }
        this.loadProjects();
      },
      error: (error: unknown) => {
        this.deleteConfirmationId.set(null);
        this.error.set(this.describeError(error, 'Unable to delete the project.'));
      },
    });
  }

  protected cancelDelete(): void {
    this.deleteConfirmationId.set(null);
  }

  protected canCreateProjects(): boolean {
    return this.auth.hasPermission('PROJECT_CREATE');
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.error.set('');
    this.projectsService.searchProjects({
      projectNumber: this.projectNumberFilter.trim() || undefined,
      projectName: this.projectNameFilter.trim() || undefined,
      customerName: this.customerNameFilter.trim() || undefined,
      page: this.page(),
      size: 10,
      sortBy: 'createdAt',
      sortDirection: 'DESC',
    }).subscribe({
      next: (result) => {
        this.projects.set(result.content);
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.describeError(error, 'Unable to load projects.'));
      },
    });
  }

  private toRequest(draft: ProjectDraft): ProjectRequest {
    return {
      projectNumber: draft.projectNumber.trim(),
      projectName: draft.projectName.trim(),
      projectDescription: draft.projectDescription.trim(),
      customerName: draft.customerName.trim(),
      customerAddress: draft.customerAddress.trim(),
      targetStartDate: draft.targetStartDate || null,
      targetEndDate: draft.targetEndDate || null,
    };
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 0) {
      return 'Cannot reach the backend. Check that the server is running and try again.';
    }
    if (error.status === 403) {
      return 'You do not have permission to perform this project action.';
    }
    const response = error.error as unknown;
    if (typeof response === 'string' && response.trim()) {
      return response;
    }
    if (typeof response === 'object' && response !== null && 'message' in response
      && typeof response.message === 'string') {
      return response.message;
    }
    return fallback;
  }
}
