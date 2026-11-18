import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { SupplierServiceType, SupplierSuggestion, SuppliersService } from './suppliers.service';

@Component({
  selector: 'app-supplier-autocomplete',
  templateUrl: './supplier-autocomplete.component.html',
  styleUrl: './supplier-autocomplete.component.scss',
})
export class SupplierAutocompleteComponent {
  readonly supplierType = input.required<SupplierServiceType>();
  readonly selectedSupplierId = input<number | null>(null);
  readonly selectedSupplierName = input<string | null>(null);
  readonly supplierSelected = output<SupplierSuggestion | null>();
  readonly addSupplier = output<string>();

  protected readonly query = signal('');
  protected readonly suggestions = signal<SupplierSuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly inputValue = computed(() => this.query() || this.selectedSupplierName() || '');

  protected readonly canManageSuppliers = computed(() =>
    this.auth.hasPermission('SOURCING_SUPPLIER_MANAGE'),
  );
  private readonly auth = inject(AuthService);
  private readonly suppliersService = inject(SuppliersService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms = new Subject<string>();

  constructor() {
    this.searchTerms.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((query) => {
        if (query.trim().length < 2) {
          this.loading.set(false);
          this.suggestions.set([]);
          return of([]);
        }
        this.loading.set(true);
        this.error.set('');
        return this.suppliersService.suggestions(query.trim(), this.supplierType()).pipe(
          catchError((error: unknown) => {
            this.error.set(this.describeError(error));
            return of([]);
          }),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((suggestions) => {
      this.suggestions.set(suggestions);
      this.loading.set(false);
    });
  }

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.supplierSelected.emit(null);
    this.open.set(true);
    this.searchTerms.next(value);
  }

  protected onFocus(): void {
    this.open.set(true);
    if (this.query().trim().length >= 2) {
      this.searchTerms.next(this.query());
    }
  }

  protected onBlur(): void {
    window.setTimeout(() => this.open.set(false), 120);
  }

  protected selectSupplier(supplier: SupplierSuggestion): void {
    this.query.set('');
    this.open.set(false);
    this.supplierSelected.emit(supplier);
  }

  protected clearSupplier(): void {
    this.query.set('');
    this.suggestions.set([]);
    this.open.set(false);
    this.supplierSelected.emit(null);
  }

  protected requestNewSupplier(): void {
    const name = this.query().trim();
    if (this.canManageSuppliers() && name.length >= 2) {
      this.open.set(false);
      this.addSupplier.emit(name);
    }
  }

  private describeError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'You do not have permission to search suppliers.';
    }
    if (error instanceof HttpErrorResponse && error.error?.detail) {
      return String(error.error.detail);
    }
    return 'Unable to load supplier suggestions. Try again.';
  }
}
