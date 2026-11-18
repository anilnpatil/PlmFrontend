import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { SupplierFormComponent } from './supplier-form.component';
import { Supplier, SupplierServiceType, SupplierUpsertRequest, SuppliersService } from './suppliers.service';

type ActiveFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-suppliers-page',
  imports: [FormsModule, SupplierFormComponent],
  templateUrl: './suppliers.page.html',
  styleUrl: './suppliers.page.scss',
})
export class SuppliersPage {
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly page = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly totalElements = signal(0);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editingSupplier = signal<Supplier | null>(null);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected query = '';
  protected activeFilter: ActiveFilter = 'active';

  private readonly suppliersService = inject(SuppliersService);
  private readonly searchTerms = new Subject<string>();
  private readonly pageSize = 20;

  constructor() {
    this.searchTerms.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => {
      this.page.set(0);
      this.loadSuppliers();
    });
    this.loadSuppliers();
  }

  protected onSearchChange(value: string): void {
    this.query = value;
    this.searchTerms.next(value);
  }

  protected onActiveFilterChange(value: ActiveFilter): void {
    this.activeFilter = value;
    this.page.set(0);
    this.loadSuppliers();
  }

  protected openCreateForm(): void {
    this.editingSupplier.set(null);
    this.formOpen.set(true);
    this.error.set('');
  }

  protected editSupplier(supplier: Supplier): void {
    this.editingSupplier.set(supplier);
    this.formOpen.set(true);
    this.error.set('');
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editingSupplier.set(null);
  }

  protected saveSupplier(request: SupplierUpsertRequest): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const editingSupplier = this.editingSupplier();
    const saveRequest = editingSupplier
      ? this.suppliersService.update(editingSupplier.id, request)
      : this.suppliersService.create(request);
    saveRequest.subscribe({
      next: (supplier) => {
        this.message.set(editingSupplier ? `${supplier.name} was updated.` : `${supplier.name} was added.`);
        this.closeForm();
        this.saving.set(false);
        this.loadSuppliers();
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error, 'Unable to save this supplier.'));
        this.saving.set(false);
      },
    });
  }

  protected toggleStatus(supplier: Supplier): void {
    const active = !supplier.active;
    if (supplier.active && !window.confirm(`Deactivate ${supplier.name}? Existing workflows will keep their supplier history.`)) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.suppliersService.updateStatus(supplier.id, active).subscribe({
      next: (updated) => {
        this.suppliers.update((items) => items.map((item) => item.id === updated.id ? updated : item));
        this.message.set(`${updated.name} is now ${updated.active ? 'active' : 'inactive'}.`);
        this.saving.set(false);
        if (this.activeFilter === 'active' && !updated.active) {
          this.loadSuppliers();
        }
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error, 'Unable to update supplier status.'));
        this.saving.set(false);
      },
    });
  }

  protected changePage(page: number): void {
    if (page < 0 || page >= this.totalPages() || page === this.page()) {
      return;
    }
    this.page.set(page);
    this.loadSuppliers();
  }

  protected serviceTypeLabel(serviceType: SupplierServiceType): string {
    return serviceType === 'PURCHASE' ? 'Purchase' : 'Manufacturing';
  }

  private loadSuppliers(): void {
    this.loading.set(true);
    this.error.set('');
    const active = this.activeFilter === 'all' ? null : this.activeFilter === 'active';
    this.suppliersService.search(this.query.trim(), active, this.page(), this.pageSize).subscribe({
      next: (result) => {
        this.suppliers.set(result.content);
        this.totalPages.set(result.totalPages);
        this.totalElements.set(result.totalElements);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(this.describeError(error, 'Unable to load suppliers.'));
        this.loading.set(false);
      },
    });
  }

  private describeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'You do not have permission to manage suppliers.';
    }
    if (error instanceof HttpErrorResponse && error.error?.detail) {
      return String(error.error.detail);
    }
    return fallback;
  }
}
