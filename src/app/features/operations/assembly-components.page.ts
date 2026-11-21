import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Project, ProjectsService } from '../projects/projects.service';
import {
  AssemblyComponent,
  AssemblyStatus,
  OperationsService,
} from './operations.service';

interface AssemblyPartGroup {
  key: string;
  label: string;
  parts: AssemblyComponent[];
}

interface MainAssemblyGroup {
  id: number;
  number: string;
  name: string;
  partCount: number;
  subAssemblies: AssemblyPartGroup[];
}

@Component({
  selector: 'app-assembly-components-page',
  imports: [RouterLink],
  templateUrl: './assembly-components.page.html',
  styleUrls: ['./operational-components.page.scss', './assembly-components.page.scss'],
})
export class AssemblyComponentsPage {
  private readonly operationsService = inject(OperationsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));
  protected readonly project = signal<Project | null>(null);
  protected readonly components = signal<AssemblyComponent[]>([]);
  protected readonly savingPartIds = signal<ReadonlySet<number>>(new Set<number>());
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly groups = computed(() => this.groupComponents(this.components()));
  protected readonly inProgressCount = computed(() =>
    this.components().filter((component) => component.assemblyStatus === 'IN_PROGRESS').length);
  protected readonly completedCount = computed(() =>
    this.components().filter((component) => component.assemblyStatus === 'COMPLETED').length);

  constructor() {
    if (!Number.isSafeInteger(this.projectId) || this.projectId < 1) {
      this.error.set('The project ID in this URL is invalid.');
      this.loading.set(false);
      return;
    }
    this.loadComponents();
  }

  protected startAssembly(component: AssemblyComponent): void {
    if (component.assemblyStatus !== 'NOT_STARTED' || component.assemblyStartDate) {
      return;
    }
    this.updateProgress(component, 'start');
  }

  protected completeAssembly(component: AssemblyComponent): void {
    if (component.assemblyStatus !== 'IN_PROGRESS' || !component.assemblyStartDate
        || component.assemblyCompleteDate) {
      return;
    }
    this.updateProgress(component, 'complete');
  }

  protected isSaving(component: AssemblyComponent): boolean {
    return this.savingPartIds().has(component.designPartId);
  }

  private updateProgress(component: AssemblyComponent, action: 'start' | 'complete'): void {
    const designPartId = component.designPartId;
    if (this.isSaving(component)) {
      return;
    }
    this.setSaving(designPartId, true);
    this.error.set('');
    this.message.set('');
    const update = action === 'start'
      ? this.operationsService.startAssemblyComponent(this.projectId, designPartId)
      : this.operationsService.completeAssemblyComponent(this.projectId, designPartId);
    update.subscribe({
      next: (updated) => {
        this.components.update((components) => components.map((component) =>
          component.designPartId === updated.designPartId ? updated : component));
        this.setSaving(designPartId, false);
        this.message.set(action === 'start'
          ? `Assembly started for ${updated.partNumber}.`
          : `Assembly completed for ${updated.partNumber}.`);
      },
      error: (error: unknown) => {
        this.setSaving(designPartId, false);
        this.error.set(this.describeError(error, 'Unable to save assembly progress.'));
      },
    });
  }

  protected sourceLabel(component: AssemblyComponent): string {
    switch (component.modeOfPurchase) {
      case 'MANUFACTURE':
        return 'Manufacturing';
      case 'STOCK':
        return 'Project stock';
      case 'PURCHASE':
      case null:
        return 'Purchase';
    }
  }

  protected statusLabel(status: AssemblyStatus): string {
    switch (status) {
      case 'NOT_STARTED':
        return 'Not started';
      case 'IN_PROGRESS':
        return 'In progress';
      case 'COMPLETED':
        return 'Completed';
    }
  }

  private setSaving(designPartId: number, saving: boolean): void {
    const savingPartIds = new Set(this.savingPartIds());
    if (saving) {
      savingPartIds.add(designPartId);
    } else {
      savingPartIds.delete(designPartId);
    }
    this.savingPartIds.set(savingPartIds);
  }

  private loadComponents(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      project: this.projectsService.getProject(this.projectId),
      components: this.operationsService.assemblyComponents(this.projectId),
    }).subscribe({
      next: (result) => {
        this.project.set(result.project);
        this.components.set(result.components);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.describeError(error, 'Unable to load assembly components.'));
      },
    });
  }

  private groupComponents(components: AssemblyComponent[]): MainAssemblyGroup[] {
    const mainGroups = new Map<number, MainAssemblyGroup>();
    const partGroups = new Map<string, AssemblyPartGroup>();

    for (const component of components) {
      let mainGroup = mainGroups.get(component.mainAssemblyId);
      if (!mainGroup) {
        mainGroup = {
          id: component.mainAssemblyId,
          number: component.mainAssemblyNumber,
          name: component.mainAssemblyName,
          partCount: 0,
          subAssemblies: [],
        };
        mainGroups.set(component.mainAssemblyId, mainGroup);
      }
      mainGroup.partCount += 1;

      const key = component.subAssemblyId === null
        ? `main-${component.mainAssemblyId}`
        : `sub-${component.subAssemblyId}`;
      let partGroup = partGroups.get(key);
      if (!partGroup) {
        partGroup = {
          key,
          label: component.subAssemblyId === null
            ? 'Main assembly parts'
            : `${component.subAssemblyNumber ?? ''} ${component.subAssemblyName ?? ''}`.trim(),
          parts: [],
        };
        partGroups.set(key, partGroup);
        mainGroup.subAssemblies.push(partGroup);
      }
      partGroup.parts.push(component);
    }

    return [...mainGroups.values()];
  }

  private describeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'You do not have permission to access or update assembly progress.';
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'The selected project or assembly component could not be found.';
    }
    if (error instanceof HttpErrorResponse && error.error?.detail) {
      return String(error.error.detail);
    }
    return fallback;
  }
}
