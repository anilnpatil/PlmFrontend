import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, concatMap, forkJoin, from, map, of, toArray } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import { Project, ProjectsService } from '../../projects/projects.service';
import { parseDesignPartFileName } from './design-part-file-name';
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

type Editor = 'main-assembly' | 'sub-assembly' | 'part' | 'bulk-part' | null;

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

interface BulkPartDraft extends PartDraft {
  fileName: string;
  mainAssemblyId: number;
  subAssemblyId: number | null;
}

interface BulkPartCreationResult {
  draft: BulkPartDraft;
  error: unknown | null;
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
  private readonly authService = inject(AuthService);
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
  protected readonly createPartStatuses = computed(() => this.partStatuses);
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
  protected readonly fileBrowserPurpose = signal<'add-parts' | 'edit-part'>('add-parts');
  protected readonly selectedServerFiles = signal<ReadonlyMap<string, DesignFileBrowserEntry>>(new Map());
  protected readonly bulkPartDrafts = signal<BulkPartDraft[]>([]);
  protected readonly editingPart = signal<DesignPart | null>(null);
  private fileBrowserContext: { mainAssemblyId: number; subAssemblyId: number | null } | null = null;
  protected assemblyDraft: AssemblyRequest = this.emptyAssemblyDraft();
  protected partDraft: PartDraft = this.emptyPartDraft();

  constructor() {
    effect((onCleanup) => {
      const error = this.error();
      const message = this.message();
      if (!error && !message) {
        return;
      }
      const timeout = window.setTimeout(() => {
        if (this.error() === error) {
          this.error.set('');
        }
        if (this.message() === message) {
          this.message.set('');
        }
      }, 5000);
      onCleanup(() => window.clearTimeout(timeout));
    });

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
    this.fileBrowserPurpose.set('add-parts');
    this.fileBrowserContext = { mainAssemblyId, subAssemblyId };
    this.selectedServerFiles.set(new Map());
    this.fileBrowserError.set('');
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
    this.fileBrowserPurpose.set('add-parts');
    this.fileBrowserOpen.set(true);
    this.loadServerFolder(this.fileRoots()[0].id, '');
  }

  protected browseFilesForEdit(): void {
    const part = this.editingPart();
    if (!part || part.mainAssemblyId === null) {
      this.error.set('The part must have a main assembly before a file can be attached.');
      return;
    }
    if (this.fileRoots().length === 0) {
      this.error.set('Register a project folder on the Design folders page before browsing for a design file.');
      return;
    }
    this.fileBrowserPurpose.set('edit-part');
    this.fileBrowserContext = {
      mainAssemblyId: part.mainAssemblyId,
      subAssemblyId: part.subAssemblyId,
    };
    this.fileBrowserError.set('');
    this.selectedServerFiles.set(new Map());
    this.fileBrowserOpen.set(true);
    this.loadServerFolder(this.fileRoots()[0].id, '');
  }

  protected closeFileBrowser(): void {
    this.fileBrowserOpen.set(false);
    this.fileBrowserContext = null;
    this.fileBrowserError.set('');
    this.selectedServerFiles.set(new Map());
  }

  protected isServerFileSelected(entry: DesignFileBrowserEntry): boolean {
    return entry.fullPath !== null && this.selectedServerFiles().has(entry.fullPath);
  }

  protected toggleServerFile(entry: DesignFileBrowserEntry, event: Event): void {
    if (!entry.fullPath || entry.directory) {
      return;
    }
    const selected = this.fileBrowserPurpose() === 'edit-part'
      ? new Map<string, DesignFileBrowserEntry>()
      : new Map(this.selectedServerFiles());
    if ((event.target as HTMLInputElement).checked) {
      selected.set(entry.fullPath, entry);
    } else {
      selected.delete(entry.fullPath);
    }
    this.selectedServerFiles.set(selected);
  }

  protected useSelectedServerFiles(): void {
    const context = this.fileBrowserContext;
    const selectedFiles = [...this.selectedServerFiles().values()];
    if (!context || selectedFiles.length === 0) {
      return;
    }
    if (this.fileBrowserPurpose() === 'edit-part') {
      if (selectedFiles.length !== 1 || !selectedFiles[0].fullPath) {
        this.fileBrowserError.set('Select exactly one server file to attach to this part.');
        return;
      }
      this.partDraft = { ...this.partDraft, filePath: selectedFiles[0].fullPath };
      this.closeFileBrowser();
      this.message.set(`File "${selectedFiles[0].name}" selected. Save changes to attach it to the part.`);
      return;
    }
    const drafts: BulkPartDraft[] = [];
    for (const entry of selectedFiles) {
      const result = this.partDraftFromServerFile(entry, context);
      if (typeof result === 'string') {
        this.fileBrowserError.set(result);
        return;
      }
      drafts.push(result);
    }
    this.bulkPartDrafts.set(drafts);
    this.editor.set('bulk-part');
    this.closeFileBrowser();
    this.message.set(`${drafts.length} file${drafts.length === 1 ? '' : 's'} selected. Review the parsed details before saving.`);
  }

  protected assemblyNumberFor(id: number): string {
    return this.mainAssemblies().find((assembly) => assembly.id === id)?.assemblyNumber ?? 'Unknown';
  }

  protected subAssemblyNumberFor(draft: BulkPartDraft): string {
    return this.subAssemblyNumberForIds(draft.mainAssemblyId, draft.subAssemblyId);
  }

  protected subAssemblyNumberForIds(mainAssemblyId: number, subAssemblyId: number | null): string {
    if (subAssemblyId === null) {
      return '—';
    }
    return this.mainAssemblies().find((assembly) => assembly.id === mainAssemblyId)?.subAssemblies
      .find((assembly) => assembly.id === subAssemblyId)?.assemblyNumber ?? 'Unknown';
  }

  protected currentUserEmail(): string {
    return this.authService.user()?.email ?? 'Current user unavailable';
  }

  protected editPart(part: DesignPart, event?: MouseEvent): void {
    const target = event?.target;
    if (target instanceof Element && target.closest('button, a, input, select, textarea')) {
      return;
    }
    if (this.saving() || this.updatingPartStatuses().has(part.id) || this.editingPart()?.id === part.id) {
      return;
    }
    if (this.editingPart()) {
      this.error.set('Save or cancel the current part before editing another part.');
      return;
    }
    if (!this.permissions().canUpdateParts) {
      return;
    }
    this.clearNotices();
    this.editingPart.set(part);
    this.partDraft = {
      partNumber: part.partNumber,
      partName: part.partName,
      quantity: part.quantity,
      description: part.description ?? '',
      make: part.make ?? '',
      modeOfPurchase: part.modeOfPurchase,
      partStatus: part.partStatus,
      filePath: part.filePath ?? '',
      startDate: part.startDate ?? '',
      completedDate: part.completedDate ?? '',
    };
  }

  protected onDraftPartStatusChange(status: PartStatus): void {
    this.partDraft.partStatus = status;
    this.partDraft.completedDate = status === 'READY_TO_PURCHASE' ? this.today() : '';
  }

  protected onBulkPartStatusChange(draft: BulkPartDraft, status: PartStatus): void {
    draft.partStatus = status;
    draft.completedDate = status === 'READY_TO_PURCHASE' ? this.today() : '';
  }

  protected removeBulkPart(index: number): void {
    this.bulkPartDrafts.update((drafts) => drafts.filter((_, itemIndex) => itemIndex !== index));
  }

  protected onBulkMainAssemblyChange(draft: BulkPartDraft, mainAssemblyId: number | null): void {
    if (mainAssemblyId === null) {
      return;
    }
    draft.mainAssemblyId = mainAssemblyId;
    draft.subAssemblyId = null;
  }

  protected saveBulkParts(form: NgForm): void {
    const drafts = this.bulkPartDrafts().map((draft) => ({
      ...draft,
      startDate: this.today(),
    }));
    if (form.invalid || this.saving() || drafts.length === 0) {
      form.control.markAllAsTouched();
      return;
    }
    this.bulkPartDrafts.set(drafts);
    this.clearNotices();
    this.saving.set(true);
    from(drafts).pipe(
      concatMap((draft) => this.designsService.createPart(
        this.projectId,
        this.partRequest(draft, draft.mainAssemblyId, draft.subAssemblyId),
      ).pipe(
        map((): BulkPartCreationResult => ({ draft, error: null })),
        catchError((error: unknown) => of({ draft, error })),
      )),
      toArray(),
    ).subscribe({
      next: (results) => {
        this.saving.set(false);
        const failed = results.filter((result) => result.error !== null);
        const createdCount = results.length - failed.length;
        if (createdCount > 0) {
          this.loadWorkspace();
        }
        if (failed.length === 0) {
          this.editor.set(null);
          this.bulkPartDrafts.set([]);
          this.message.set(`${createdCount} part${createdCount === 1 ? '' : 's'} created.`);
          return;
        }
        this.bulkPartDrafts.set(failed.map((result) => result.draft));
        this.error.set(
          `Created ${createdCount} of ${results.length} parts. Failed: ${failed.map(({ draft, error }) =>
            `${draft.fileName} (${this.describeError(error, 'Unable to save this part.')})`).join('; ')}`,
        );
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to save the selected parts.'));
      },
    });
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
    const request = this.partRequest(this.partDraft, mainAssemblyId, subAssemblyId);
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

  protected savePartEdit(form: NgForm): void {
    const part = this.editingPart();
    if (!part || form.invalid || this.saving()) {
      form.control.markAllAsTouched();
      return;
    }
    if (part.mainAssemblyId === null) {
      this.error.set('This part is missing its main assembly and cannot be updated.');
      return;
    }
    this.saving.set(true);
    this.designsService.updatePart(
      this.projectId,
      part.id,
      this.partRequest(this.partDraft, part.mainAssemblyId, part.subAssemblyId),
    ).subscribe({
      next: (updatedPart) => {
        this.replacePart(updatedPart);
        this.saving.set(false);
        this.editingPart.set(null);
        this.message.set(`Part ${updatedPart.partNumber} updated.`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, `Unable to update part ${part.partNumber}.`));
      },
    });
  }

  protected savePartEditFromKeyboard(event: Event, form: NgForm): void {
    if (!(event.target instanceof HTMLInputElement)
      && !(event.target instanceof HTMLSelectElement)
      && !(event.target instanceof HTMLTextAreaElement)) {
      return;
    }
    event.preventDefault();
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    this.savePartEdit(form);
  }

  protected cancelEditor(): void {
    this.editor.set(null);
    this.editingPart.set(null);
    this.bulkPartDrafts.set([]);
    this.error.set('');
  }

  protected selectedMainAssembly(): DesignMainAssembly | undefined {
    return this.mainAssemblies().find((assembly) => assembly.id === this.selectedMainAssemblyId());
  }

  private partDraftFromServerFile(
    entry: DesignFileBrowserEntry,
    context: { mainAssemblyId: number; subAssemblyId: number | null },
  ): BulkPartDraft | string {
    if (!entry.fullPath) {
      return `The selected file "${entry.name}" does not have a server path.`;
    }
    const parsedName = parseDesignPartFileName(entry.name);
    if (!parsedName) {
      return `The file "${entry.name}" must use the format main-subassembly-partnumber_part name.extension.`;
    }
    let mainAssemblyId = context.mainAssemblyId;
    let subAssemblyId = context.subAssemblyId;

    if (parsedName.mainAssemblyNumber !== null && parsedName.subAssemblyNumber !== null) {
      const { mainAssemblyNumber, subAssemblyNumber } = parsedName;
      const mainAssembly = this.mainAssemblies().find(
        (assembly) => assembly.assemblyNumber.toLowerCase() === mainAssemblyNumber.toLowerCase(),
      );
      if (!mainAssembly) {
        return `No main assembly numbered "${mainAssemblyNumber}" exists for "${entry.name}". Create it before importing this file.`;
      }
      const normalizedSubAssemblyNumber = subAssemblyNumber.toLowerCase();
      const subAssembly = mainAssembly.subAssemblies.find((assembly) => {
        const number = assembly.assemblyNumber.toLowerCase();
        return number === normalizedSubAssemblyNumber
          || number === `${mainAssembly.assemblyNumber.toLowerCase()}-${normalizedSubAssemblyNumber}`
          || number.endsWith(`-${normalizedSubAssemblyNumber}`);
      });
      if (!subAssembly) {
        return `No subassembly numbered "${subAssemblyNumber}" exists under main assembly "${mainAssemblyNumber}". Create it before importing "${entry.name}".`;
      }
      mainAssemblyId = mainAssembly.id;
      subAssemblyId = subAssembly.id;
    }

    return {
      ...this.emptyPartDraft(),
      fileName: entry.name,
      mainAssemblyId,
      subAssemblyId,
      partNumber: parsedName.partNumber,
      partName: parsedName.partName,
      filePath: entry.fullPath,
    };
  }

  private partRequest(
    draft: PartDraft,
    mainAssemblyId: number,
    subAssemblyId: number | null,
  ): DesignPartRequest {
    return {
      ...draft,
      mainAssemblyId,
      subAssemblyId,
      partNumber: draft.partNumber.trim(),
      partName: draft.partName.trim(),
      description: draft.description.trim(),
      make: draft.make.trim(),
      filePath: draft.filePath.trim(),
      startDate: draft.startDate || null,
      completedDate: draft.completedDate || null,
    };
  }

  protected purchaseModeLabel(value: ModeOfPurchase | null): string {
    return this.purchaseModes.find((mode) => mode.value === value)?.label ?? '—';
  }

  protected partStatusLabel(value: PartStatus | null): string {
    return this.partStatuses.find((status) => status.value === value)?.label ?? 'Not started';
  }

  protected updatePartStatus(part: DesignPart, value: string): void {
    if (!this.permissions().canUpdateParts
      || this.updatingPartStatuses().has(part.id)) {
      return;
    }
    const nextStatus = this.partStatuses.find((status) => status.value === value)?.value;
    if (!nextStatus) {
      this.error.set('Select a valid part status.');
      return;
    }
    this.error.set('');
    this.message.set('');
    this.updatingPartStatuses.update((ids) => new Set(ids).add(part.id));
    this.designsService.updatePartStatus(this.projectId, part.id, nextStatus).subscribe({
      next: (updatedPart) => {
        this.replacePart(updatedPart);
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

  private replacePart(updatedPart: DesignPart): void {
    this.mainAssemblies.update((assemblies) => assemblies.map((mainAssembly) => ({
      ...mainAssembly,
      parts: mainAssembly.parts.map((part) => part.id === updatedPart.id ? updatedPart : part),
      subAssemblies: mainAssembly.subAssemblies.map((subAssembly) => ({
        ...subAssembly,
        parts: subAssembly.parts.map((part) => part.id === updatedPart.id ? updatedPart : part),
      })),
    })));
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
      startDate: this.today(),
      completedDate: '',
    };
  }

  private today(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
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
    if (typeof error.error === 'object' && error.error !== null && 'detail' in error.error
      && typeof error.error.detail === 'string') {
      return error.error.detail;
    }
    if (error.status === 403) {
      return 'The server denied this design update. Confirm your Design access is Read and write for this project.';
    }
    return fallback;
  }

  private showFileError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.error.set('You need project view access to open or download this file.');
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
