import { HttpErrorResponse } from '@angular/common/http';
import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { DesignFileRoot, DesignsService } from '../designs.service';

@Component({
  selector: 'app-project-file-roots',
  imports: [FormsModule],
  templateUrl: './project-file-roots.component.html',
  styleUrl: './project-file-roots.component.scss',
})
export class ProjectFileRootsComponent {
  readonly projectId = input.required<number>();
  readonly roots = input.required<DesignFileRoot[]>();
  readonly canManage = input.required<boolean>();
  readonly rootsChange = output<DesignFileRoot[]>();

  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');

  constructor(private readonly designsService: DesignsService) {}

  protected addRoot(): void {
    const path = this.draft().trim();
    if (!path || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.designsService.addFileRoot(this.projectId(), path).subscribe({
      next: (root) => {
        this.rootsChange.emit([...this.roots(), root]);
        this.draft.set('');
        this.saving.set(false);
        this.message.set('Folder added.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to add this server folder.'));
      },
    });
  }

  protected removeRoot(root: DesignFileRoot): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    this.designsService.removeFileRoot(this.projectId(), root.id).subscribe({
      next: () => {
        this.rootsChange.emit(this.roots().filter((item) => item.id !== root.id));
        this.saving.set(false);
        this.message.set('Folder removed. The files were not deleted.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to remove this server folder.'));
      },
    });
  }

  private describeError(error: unknown, fallback: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }
    if (error.status === 403) {
      return 'You need PARTS_UPDATE in the DESIGN area to manage project folders.';
    }
    const response = error.error as unknown;
    if (typeof response === 'object' && response !== null && 'detail' in response
      && typeof response.detail === 'string') {
      return response.detail;
    }
    return fallback;
  }
}
