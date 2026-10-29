import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Project, ProjectsService } from '../../projects/projects.service';

@Component({
  selector: 'app-design-projects-dashboard',
  imports: [RouterLink],
  templateUrl: './design-dashboard.page.html',
  styleUrl: './design-dashboard.page.scss',
})
export class DesignProjectsDashboardPage {
  private readonly projectsService = inject(ProjectsService);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);

  constructor() {
    this.loadProjects();
  }

  protected changePage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.page.set(page);
      this.loadProjects();
    }
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.error.set('');
    this.projectsService.searchProjects({
      page: this.page(),
      size: 12,
      sortBy: 'projectName',
      sortDirection: 'ASC',
    }).subscribe({
      next: (result) => {
        this.projects.set(result.content);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'You do not have permission to view projects.'
          : 'Unable to load projects for the Design workspace.');
      },
    });
  }
}
