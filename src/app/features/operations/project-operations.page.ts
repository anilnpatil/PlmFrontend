import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { Project, ProjectsService } from '../projects/projects.service';

type OperationFlow = 'purchase' | 'manufacturing' | 'stock' | 'assembly';

function operationFlow(value: unknown): OperationFlow {
  if (value === 'purchase' || value === 'manufacturing' || value === 'stock' || value === 'assembly') {
    return value;
  }
  throw new Error('Project operations route is missing a valid workflow type.');
}

@Component({
  selector: 'app-project-operations-page',
  imports: [RouterLink],
  templateUrl: './project-operations.page.html',
  styleUrl: './operational-components.page.scss',
})
export class ProjectOperationsPage {
  private readonly projectsService = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly flow = operationFlow(this.route.snapshot.data['workflow']);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  constructor() {
    this.loadProjects();
  }

  protected get heading(): string {
    return this.flow === 'purchase'
      ? 'Purchase projects'
      : this.flow === 'manufacturing'
        ? 'Manufacturing projects'
        : this.flow === 'stock'
          ? 'Stock projects'
          : 'Assembly projects';
  }

  protected get actionLabel(): string {
    switch (this.flow) {
      case 'purchase':
        return 'Open Purchase';
      case 'manufacturing':
        return 'Open Manufacturing';
      case 'stock':
        return 'Open Stock';
      case 'assembly':
        return 'Open Assembly';
    }
  }

  private loadProjects(): void {
    this.projectsService.searchProjects({
      page: 0,
      size: 100,
      sortBy: 'projectName',
      sortDirection: 'ASC',
    }).subscribe({
      next: (page) => {
        this.projects.set(page.content);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(error instanceof HttpErrorResponse && error.status === 403
          ? 'You do not have permission to view projects.'
          : 'Unable to load projects for component operations.');
      },
    });
  }
}
