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
  DesignFileBrowserEntry,
  DesignFileBrowserResponse,
  DesignFileRoot,
  DesignPermissions,
  ModeOfPurchase,
  PartStatus,
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
  modeOfPurchase: ModeOfPurchase;
  partStatus: PartStatus;
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
    canUpdateParts: false,
  });
  protected readonly fileRoots = signal<DesignFileRoot[]>([]);
  protected readonly purchaseModes: Array<{ value: ModeOfPurchase; label: string }> = [
    { value: 'PURCHASE', label: 'Purchase' },
    { value: 'MANUFACTURE', label: 'Manufacture' },
    { value: 'STOCK', label: 'Stock' },
  ];
  protected readonly partStatuses: Array<{ value: PartStatus; label: string }> = [
    { value: 'NOT_STARTED', label: 'Not started' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'READY_TO_PURCHASE', label: 'Ready to purchase' },
  ];
  protected readonly rowsByMainAssembly = computed(() => {
    const result = new Map<number, RegisterRow[]>();
    for (const mainAssembly of this.mainAssemblies()) {
      result.set(mainAssembly.id, this.buildRows(mainAssembly));
    }
    return result;
  });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly updatingPartStatuses = signal<ReadonlySet<number>>(new Set());
  protected readonly editor = signal<Editor>(null);
  protected readonly selectedMainAssemblyId = signal<number | null>(null);
  protected readonly selectedSubAssemblyId = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly fileBrowserOpen = signal(false);
  protected readonly fileBrowserLoading = signal(false);
  protected readonly fileBrowser = signal<DesignFileBrowserResponse | null>(null);
  protected readonly fileBrowserError = signal('');
  private fileBrowserContext: { mainAssemblyId: number; subAssemblyId: number | null } | null = null;
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

  protected selectPathToAddPart(mainAssemblyId: number, subAssemblyId: number | null = null): void {
    if (this.fileRoots().length === 0) {
      this.error.set('Register a project folder on the Design folders page before browsing for a design file.');
      return;
    }
    this.fileBrowserContext = { mainAssemblyId, subAssemblyId };
    this.clearNotices();
    this.fileBrowserOpen.set(true);
    this.loadServerFolder(this.fileRoots()[0].id, '');
  }

  protected browseFilesFromForm(): void {
    const mainAssemblyId = this.selectedMainAssemblyId();
    if (mainAssemblyId === null) {
      this.error.set('Select a main assembly before browsing for a server file.');
      return;
    }
    if (this.fileRoots().length === 0) {
      this.error.set('Register a project folder on the Design folders page before browsing for a design file.');
      return;
    }
    this.fileBrowserContext = {
      mainAssemblyId,
      subAssemblyId: this.selectedSubAssemblyId(),
    };
    this.fileBrowserOpen.set(true);
    this.loadServerFolder(this.fileRoots()[0].id, '');
  }

  protected closeFileBrowser(): void {
    this.fileBrowserOpen.set(false);
    this.fileBrowserContext = null;
    this.fileBrowserError.set('');
  }

  protected openServerFolder(path: string): void {
    const browser = this.fileBrowser();
    if (browser) {
      this.loadServerFolder(browser.selectedRootId, path);
    }
  }

  protected goToParentFolder(): void {
    const browser = this.fileBrowser();
    if (browser?.parentDirectory !== null && browser) {
      this.loadServerFolder(browser.selectedRootId, browser.parentDirectory);
    }
  }

  protected changeServerRoot(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (Number.isSafeInteger(value) && value >= 0) {
      this.loadServerFolder(value, '');
    }
  }

  protected selectServerFile(entry: DesignFileBrowserEntry): void {
    const context = this.fileBrowserContext;
    if (!context || entry.directory || !entry.fullPath) {
      return;
    }
    const fileName = entry.name;
    const extensionIndex = fileName.lastIndexOf('.');
    const baseName = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
    const matchedName = /^(\S+)\s+(.+)$/.exec(baseName.trim());
    this.selectedMainAssemblyId.set(context.mainAssemblyId);
    this.selectedSubAssemblyId.set(context.subAssemblyId);
    this.partDraft = {
      ...this.emptyPartDraft(),
      partNumber: matchedName?.[1] ?? baseName.trim(),
      partName: matchedName?.[2]?.trim() ?? '',
      filePath: entry.fullPath,
    };
    this.editor.set('part');
    this.closeFileBrowser();
    this.message.set('Server file selected. Full path, part number, and part name were filled in; verify the details before saving.');
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
      modeOfPurchase: this.partDraft.modeOfPurchase,
      partStatus: this.partDraft.partStatus,
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

  protected purchaseModeLabel(value: ModeOfPurchase | null): string {
    return this.purchaseModes.find((mode) => mode.value === value)?.label ?? '—';
  }

  protected partStatusLabel(value: PartStatus | null): string {
    return this.partStatuses.find((status) => status.value === value)?.label ?? 'Not started';
  }

  protected updatePartStatus(part: DesignPart, event: Event): void {
    if (!this.permissions().canUpdateParts || this.updatingPartStatuses().has(part.id)) {
      return;
    }
    const nextStatus = (event.target as HTMLSelectElement).value as PartStatus;
    if (!this.partStatuses.some((status) => status.value === nextStatus)) {
      this.error.set('Select a valid part status.');
      return;
    }
    this.error.set('');
    this.message.set('');
    this.updatingPartStatuses.update((ids) => new Set(ids).add(part.id));
    this.designsService.updatePartStatus(this.projectId, part.id, nextStatus).subscribe({
      next: (updatedPart) => {
        this.mainAssemblies.update((assemblies) => assemblies.map((mainAssembly) => ({
          ...mainAssembly,
          parts: mainAssembly.parts.map((item) => item.id === updatedPart.id ? updatedPart : item),
          subAssemblies: mainAssembly.subAssemblies.map((subAssembly) => ({
            ...subAssembly,
            parts: subAssembly.parts.map((item) => item.id === updatedPart.id ? updatedPart : item),
          })),
        })));
        this.updatingPartStatuses.update((ids) => {
          const next = new Set(ids);
          next.delete(part.id);
          return next;
        });
        this.message.set(`Status updated for ${updatedPart.partNumber}.`);
      },
      error: (error: unknown) => {
        this.updatingPartStatuses.update((ids) => {
          const next = new Set(ids);
          next.delete(part.id);
          return next;
        });
        this.error.set(this.describeError(error, `Unable to update status for ${part.partNumber}.`));
        this.loadWorkspace();
      },
    });
  }

  protected rowsFor(mainAssemblyId: number): RegisterRow[] {
    return this.rowsByMainAssembly().get(mainAssemblyId) ?? [];
  }

  protected selectedRootPath(): string {
    const browser = this.fileBrowser();
    return browser?.roots.find((root) => root.id === browser.selectedRootId)?.path ?? '';
  }

  private loadServerFolder(rootId: number, path: string): void {
    this.fileBrowserLoading.set(true);
    this.fileBrowserError.set('');
    this.designsService.browseServerFiles(this.projectId, rootId, path).subscribe({
      next: (browser) => {
        this.fileBrowser.set(browser);
        this.fileBrowserLoading.set(false);
      },
      error: (error: unknown) => {
        this.fileBrowserLoading.set(false);
        this.fileBrowserError.set(this.describeError(error, 'Unable to browse the server design files.'));
      },
    });
  }

  protected openPartFile(part: DesignPart): void {
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      this.error.set('Allow pop-ups to open this file in a new tab.');
      return;
    }
    popup.opener = null;
    this.clearNotices();
    this.designsService.partFile(this.projectId, part.id, false).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        popup.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: unknown) => {
        popup.close();
        this.showFileError(error);
      },
    });
  }

  protected downloadPartFile(part: DesignPart): void {
    this.clearNotices();
    this.designsService.partFile(this.projectId, part.id, true).subscribe({
      next: (file) => {
        const url = URL.createObjectURL(file);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = part.filePath?.split(/[\\/]/).pop() || `${part.partNumber}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: unknown) => {
        this.showFileError(error);
      },
    });
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
        if (workspace.permissions.canReadParts) {
          this.designsService.fileRoots(this.projectId).subscribe({
            next: (result) => this.fileRoots.set(result.roots),
            error: (error: unknown) => {
              this.error.set(this.describeError(error, 'Unable to load project server folders.'));
            },
          });
        } else {
          this.fileRoots.set([]);
        }
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
      modeOfPurchase: 'PURCHASE',
      partStatus: 'NOT_STARTED',
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

  private showFileError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.error.set('Your project role needs PARTS_READ or PARTS_UPDATE in the DESIGN area to open or download this file.');
      return;
    }
    if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
      this.error.set(this.describeError(
        error,
        'Unable to access the server file. Check that the file exists and the application server can read it.',
      ));
      return;
    }

    void error.error.text().then((body) => {
      try {
        const problem: unknown = JSON.parse(body);
        if (typeof problem === 'object' && problem !== null
          && 'detail' in problem && typeof problem.detail === 'string') {
          this.error.set(problem.detail);
          return;
        }
      } catch {
        this.error.set('Unable to access the server file. Check that the file exists and the application server can read it.');
        return;
      }
      this.error.set('Unable to access the server file. Check that the file exists and the application server can read it.');
    });
  }
}
