import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Project, ProjectsService } from '../../projects/projects.service';
import {
  AssemblyRequest,
  DesignMainAssembly,
  DesignPart,
  DesignPartRequest,
  DesignPermissions,
  DesignSubAssembly,
  DesignsService,
} from '../designs.service';

type Editor = 'main-assembly' | 'sub-assembly' | 'part' | null;

interface RegisterRow {
  part: DesignPart | null;
  subAssembly: DesignSubAssembly | null;
  mainAssemblyFirst: boolean;
  mainAssemblyRowSpan: number;
  subAssemblyFirst: boolean;
  subAssemblyRowSpan: number;
}

interface PartDraft {
  partNumber: string;
  partName: string;
  quantity: number;
  description: string;
  make: string;
  filePath: string;
  startDate: string;
  completedDate: string;
}

@Component({
  selector: 'app-design-parts-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './design-parts.page.html',
  styleUrl: './design-parts.page.scss',
})
export class DesignPartsPage {
  private readonly designsService = inject(DesignsService);
  private readonly projectsService = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));

  protected readonly project = signal<Project | null>(null);
  protected readonly mainAssemblies = signal<DesignMainAssembly[]>([]);
  protected readonly permissions = signal<DesignPermissions>({
    canCreateAssembly: false,
    canCreatePart: false,
    canReadParts: false,
  });
  protected readonly rowsByMainAssembly = computed(() => {
    const result = new Map<number, RegisterRow[]>();
    for (const mainAssembly of this.mainAssemblies()) {
      result.set(mainAssembly.id, this.buildRows(mainAssembly));
    }
    return result;
  });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly editor = signal<Editor>(null);
  protected readonly selectedMainAssemblyId = signal<number | null>(null);
  protected readonly selectedSubAssemblyId = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected assemblyDraft: AssemblyRequest = this.emptyAssemblyDraft();
  protected partDraft: PartDraft = this.emptyPartDraft();

  constructor() {
    if (!Number.isSafeInteger(this.projectId) || this.projectId < 1) {
      this.error.set('The project ID in this URL is invalid.');
      this.loading.set(false);
      return;
    }
    this.loadWorkspace();
  }

  protected startMainAssembly(): void {
    this.assemblyDraft = this.emptyAssemblyDraft();
    this.editor.set('main-assembly');
    this.clearNotices();
  }

  protected startSubAssembly(mainAssemblyId: number): void {
    this.selectedMainAssemblyId.set(mainAssemblyId);
    this.assemblyDraft = this.emptyAssemblyDraft();
    this.editor.set('sub-assembly');
    this.clearNotices();
  }

  protected startPart(mainAssemblyId: number | null = null, subAssemblyId: number | null = null): void {
    this.selectedMainAssemblyId.set(mainAssemblyId);
    this.selectedSubAssemblyId.set(subAssemblyId);
    this.partDraft = this.emptyPartDraft();
    this.editor.set('part');
    this.clearNotices();
  }

  protected onMainAssemblyChange(id: number | null): void {
    this.selectedMainAssemblyId.set(id);
    this.selectedSubAssemblyId.set(null);
  }

  protected saveAssembly(form: NgForm): void {
    if (form.invalid || this.saving()) {
      form.control.markAllAsTouched();
      return;
    }
    const request: AssemblyRequest = {
      assemblyNumber: this.assemblyDraft.assemblyNumber.trim(),
      name: this.assemblyDraft.name.trim(),
      description: this.assemblyDraft.description.trim(),
    };
    const isMainAssembly = this.editor() === 'main-assembly';
    const mainAssemblyId = this.selectedMainAssemblyId();
    if (!isMainAssembly && mainAssemblyId === null) {
      this.error.set('Select a main assembly for this subassembly.');
      return;
    }

    this.saving.set(true);
    const onSaved = (): void => {
        this.saving.set(false);
        this.editor.set(null);
        this.message.set(isMainAssembly ? 'Main assembly created.' : 'Subassembly created.');
        this.loadWorkspace();
    };
    const onError = (error: unknown): void => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to save the assembly.'));
    };
    if (isMainAssembly) {
      this.designsService.createMainAssembly(this.projectId, request).subscribe({
        next: onSaved,
        error: onError,
      });
      return;
    }
    if (mainAssemblyId === null) {
      this.saving.set(false);
      this.error.set('Select a main assembly for this subassembly.');
      return;
    }
    this.designsService.createSubAssembly(this.projectId, mainAssemblyId, request).subscribe({
      next: onSaved,
      error: onError,
    });
  }

  protected savePart(form: NgForm): void {
    if (form.invalid || this.saving()) {
      form.control.markAllAsTouched();
      return;
    }
    const mainAssemblyId = this.selectedMainAssemblyId();
    if (mainAssemblyId === null) {
      this.error.set('Select a main assembly for this part.');
      return;
    }
    const subAssemblyId = this.selectedSubAssemblyId();
    const request: DesignPartRequest = {
      ...this.partDraft,
      mainAssemblyId,
      subAssemblyId,
      partNumber: this.partDraft.partNumber.trim(),
      partName: this.partDraft.partName.trim(),
      description: this.partDraft.description.trim(),
      make: this.partDraft.make.trim(),
      filePath: this.partDraft.filePath.trim(),
      startDate: this.partDraft.startDate || null,
      completedDate: this.partDraft.completedDate || null,
    };
    this.saving.set(true);
    this.designsService.createPart(this.projectId, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.editor.set(null);
        this.message.set('Part created.');
        this.loadWorkspace();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to save the part.'));
      },
    });
  }

  protected cancelEditor(): void {
    this.editor.set(null);
  }

  protected selectedMainAssembly(): DesignMainAssembly | undefined {
    return this.mainAssemblies().find((assembly) => assembly.id === this.selectedMainAssemblyId());
  }

  protected rowsFor(mainAssemblyId: number): RegisterRow[] {
    return this.rowsByMainAssembly().get(mainAssemblyId) ?? [];
  }

  private loadWorkspace(): void {
    this.loading.set(true);
    forkJoin({
      project: this.projectsService.getProject(this.projectId),
      workspace: this.designsService.workspace(this.projectId),
    }).subscribe({
      next: ({ project, workspace }) => {
        this.project.set(project);
        this.mainAssemblies.set(workspace.mainAssemblies);
        this.permissions.set(workspace.permissions);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.describeError(error, 'Unable to load this project design workspace.'));
      },
    });
  }

  private buildRows(mainAssembly: DesignMainAssembly): RegisterRow[] {
    const groups: Array<{ subAssembly: DesignSubAssembly | null; parts: Array<DesignPart | null> }> = [
      ...(mainAssembly.parts.length > 0
        ? [{ subAssembly: null, parts: mainAssembly.parts }]
        : []),
      ...mainAssembly.subAssemblies.map((subAssembly) => ({
        subAssembly,
        parts: subAssembly.parts.length > 0 ? subAssembly.parts : [null],
      })),
    ];
    if (groups.length === 0) {
      groups.push({ subAssembly: null, parts: [null] });
    }

    const totalRows = groups.reduce((count, group) => count + group.parts.length, 0);
    const rows: RegisterRow[] = [];
    groups.forEach((group, groupIndex) => {
      group.parts.forEach((part, partIndex) => {
        rows.push({
          part,
          subAssembly: group.subAssembly,
          mainAssemblyFirst: groupIndex === 0 && partIndex === 0,
          mainAssemblyRowSpan: totalRows,
          subAssemblyFirst: partIndex === 0,
          subAssemblyRowSpan: group.parts.length,
        });
      });
    });
    return rows;
  }

  private emptyAssemblyDraft(): AssemblyRequest {
    return { assemblyNumber: '', name: '', description: '' };
  }

  private emptyPartDraft(): PartDraft {
    return {
      partNumber: '',
      partName: '',
      quantity: 1,
      description: '',
      make: '',
      filePath: '',
      startDate: '',
      completedDate: '',
    };
  }

  private clearNotices(): void {
    this.error.set('');
    this.message.set('');
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 0) {
      return 'Cannot reach the backend. Check that the server is running and try again.';
    }
    if (error.status === 403) {
      return 'You do not have the required permission for this project action.';
    }
    if (typeof error.error === 'object' && error.error !== null && 'detail' in error.error
      && typeof error.error.detail === 'string') {
      return error.error.detail;
    }
    return fallback;
  }
}
