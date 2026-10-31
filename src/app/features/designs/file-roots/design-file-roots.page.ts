import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, throwError } from 'rxjs';

import { Project, ProjectsService } from '../../projects/projects.service';
import { ProjectFileRootsComponent } from './project-file-roots.component';
import { DesignFileRoot, DesignFileRootsResponse, DesignsService } from '../designs.service';

interface ProjectFolders {
  project: Project;
  roots: DesignFileRoot[];
  canManage: boolean;
  canAccessDesign: boolean;
}

@Component({
  selector: 'app-design-file-roots-page',
  imports: [FormsModule, RouterLink, ProjectFileRootsComponent],
  templateUrl: './design-file-roots.page.html',
  styleUrl: './design-file-roots.page.scss',
})
export class DesignFileRootsPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly designsService = inject(DesignsService);

  protected readonly projects = signal<ProjectFolders[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected projectNumberFilter = '';
  protected projectNameFilter = '';
  protected customerNameFilter = '';

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

  protected updateRoots(projectId: number, roots: DesignFileRoot[]): void {
    this.projects.update((projects) => projects.map((item) =>
      item.project.id === projectId ? { ...item, roots } : item));
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
        this.page.set(result.page);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        if (result.content.length === 0) {
          this.projects.set([]);
          this.loading.set(false);
          return;
        }
        forkJoin(result.content.map((project) =>
          this.designsService.fileRoots(project.id).pipe(
            map((response) => this.toProjectFolders(project, response, true)),
            catchError((error: unknown) => {
              if (error instanceof HttpErrorResponse && error.status === 403) {
                return of(this.toProjectFolders(project, { roots: [], canManage: false }, false));
              }
              return throwError(() => error);
            }),
          )))
          .subscribe({
            next: (projects) => {
              this.projects.set(projects);
              this.loading.set(false);
            },
            error: (error: unknown) => {
              this.loading.set(false);
              this.error.set(this.describeError(error, 'Unable to load project folders.'));
            },
          });
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.describeError(error, 'Unable to load projects.'));
      },
    });
  }

  private toProjectFolders(
    project: Project,
    result: DesignFileRootsResponse,
    canAccessDesign: boolean,
  ): ProjectFolders {
    return {
      project,
      roots: result.roots,
      canManage: result.canManage,
      canAccessDesign,
    };
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 0) {
      return 'Cannot reach the backend. Check that the server is running and try again.';
    }
    const response = error.error as unknown;
    if (typeof response === 'object' && response !== null
      && 'detail' in response && typeof response.detail === 'string') {
      return response.detail;
    }
    return fallback;
  }
}
