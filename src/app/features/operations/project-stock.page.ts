import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Project, ProjectsService } from '../projects/projects.service';
import {
  AvailabilityStatus,
  OperationsService,
  ProjectStockComponent,
} from './operations.service';

@Component({
  selector: 'app-project-stock-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './project-stock.page.html',
  styleUrl: './operational-components.page.scss',
})
export class ProjectStockPage {
  private readonly operationsService = inject(OperationsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));
  protected readonly project = signal<Project | null>(null);
  protected readonly components = signal<ProjectStockComponent[]>([]);
  protected readonly selectedPartId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected totalWeightKg: number | null = null;
  protected availabilityStatus: AvailabilityStatus = 'AVAILABLE';
  protected readonly availabilityStatuses: Array<{ value: AvailabilityStatus; label: string }> = [
    { value: 'AVAILABLE', label: 'Available' },
    { value: 'UNAVAILABLE', label: 'Unavailable' },
  ];

  constructor() {
    if (!Number.isSafeInteger(this.projectId) || this.projectId < 1) {
      this.error.set('The project ID in this URL is invalid.');
      this.loading.set(false);
      return;
    }
    this.loadComponents();
  }

  protected startEditing(component: ProjectStockComponent): void {
    this.selectedPartId.set(component.designPartId);
    this.totalWeightKg = component.totalWeightKg;
    this.availabilityStatus = component.availabilityStatus;
    this.error.set('');
    this.message.set('');
  }

  protected cancelEditing(): void {
    this.selectedPartId.set(null);
  }

  protected saveStock(): void {
    const designPartId = this.selectedPartId();
    if (designPartId === null || this.saving()) {
      return;
    }
    if (this.totalWeightKg === null || !Number.isFinite(this.totalWeightKg) || this.totalWeightKg < 0) {
      this.error.set('Enter a valid total stock weight in kilograms.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.operationsService.updateProjectStock(this.projectId, designPartId, {
      totalWeightKg: this.totalWeightKg,
      availabilityStatus: this.availabilityStatus,
    }).subscribe({
      next: (updated) => {
        this.components.update((components) => components.map((component) =>
          component.designPartId === updated.designPartId ? updated : component));
        this.saving.set(false);
        this.selectedPartId.set(null);
        this.message.set(`Project stock saved for ${updated.partNumber}.`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to save the project stock item.'));
      },
    });
  }

  private loadComponents(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      project: this.projectsService.getProject(this.projectId),
      components: this.operationsService.projectStockComponents(this.projectId),
    }).subscribe({
      next: (result) => {
        this.project.set(result.project);
        this.components.set(result.components);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.describeError(error, 'Unable to load project stock.'));
      },
    });
  }

  private describeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'You do not have permission to access project stock.';
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'The selected project or component could not be found.';
    }
    if (error instanceof HttpErrorResponse && error.error?.detail) {
      return String(error.error.detail);
    }
    return fallback;
  }
}
