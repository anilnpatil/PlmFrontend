import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { Component, Directive, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { Project, ProjectsService } from '../projects/projects.service';
import {
  OperationsService,
  PartReceivedStatus,
  ProcurementComponent,
  ProcurementWorkflowRequest,
  PurchaseOrderStatus,
  QualityStatus,
  QuotationStatus,
} from './operations.service';
import { SupplierAutocompleteComponent } from '../suppliers/supplier-autocomplete.component';
import { SupplierFormComponent } from '../suppliers/supplier-form.component';
import {
  SupplierServiceType,
  SupplierSuggestion,
  SupplierUpsertRequest,
  SuppliersService,
} from '../suppliers/suppliers.service';

@Directive()
export abstract class ProcurementComponentsPageBase implements OnInit {
  protected abstract readonly flowType: 'purchase' | 'manufacturing';
  protected readonly operationsService = inject(OperationsService);
  protected readonly suppliersService = inject(SuppliersService);
  private readonly projectsService = inject(ProjectsService);
  private readonly route = inject(ActivatedRoute);
  protected readonly projectId = Number(this.route.snapshot.paramMap.get('projectId'));
  protected readonly project = signal<Project | null>(null);
  protected readonly components = signal<ProcurementComponent[]>([]);
  protected readonly componentGroups = computed(() => {
    const components = this.components();
    return [
      { title: 'New components', components: components.filter((component) => component.workflowId === null) },
      { title: 'Active workflows', components: components.filter((component) => component.workflowId !== null) },
    ].filter((group) => group.components.length > 0);
  });
  protected readonly selectedPartId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly supplierFormOpen = signal(false);
  protected readonly savingSupplier = signal(false);
  protected readonly supplierFormError = signal('');
  protected readonly supplierNameSeed = signal('');
  protected draft: ProcurementWorkflowRequest = this.emptyDraft();
  protected readonly quotationStatuses: Array<{ value: QuotationStatus; label: string }> = [
    { value: 'NOT_REQUESTED', label: 'Not requested' },
    { value: 'REQUESTED', label: 'Requested' },
    { value: 'RECEIVED', label: 'Received' },
  ];
  protected readonly purchaseOrderStatuses: Array<{ value: PurchaseOrderStatus; label: string }> = [
    { value: 'NOT_RELEASED', label: 'Not released' },
    { value: 'RELEASED', label: 'Released' },
  ];
  protected readonly partReceivedStatuses: Array<{ value: PartReceivedStatus; label: string }> = [
    { value: 'NOT_RECEIVED', label: 'Not received' },
    { value: 'PARTIALLY_RECEIVED', label: 'Partially received' },
    { value: 'RECEIVED', label: 'Received' },
  ];
  protected readonly qualityStatuses: Array<{ value: QualityStatus; label: string }> = [
    { value: 'PENDING', label: 'Pending' },
    { value: 'OK', label: 'OK' },
    { value: 'NOT_OK', label: 'Not OK' },
    { value: 'REWORK', label: 'Rework' },
  ];

  ngOnInit(): void {
    if (!Number.isSafeInteger(this.projectId) || this.projectId < 1) {
      this.error.set('The project ID in this URL is invalid.');
      this.loading.set(false);
      return;
    }
    this.loadComponents();
  }

  protected get heading(): string {
    return this.flowType === 'purchase' ? 'Purchase components' : 'Manufacturing components';
  }

  protected get supplierType(): SupplierServiceType {
    return this.flowType === 'purchase' ? 'PURCHASE' : 'MANUFACTURING';
  }

  protected startEditing(component: ProcurementComponent): void {
    const selectedPartId = this.selectedPartId();
    if (selectedPartId === component.designPartId || this.saving()) {
      return;
    }
    if (selectedPartId !== null) {
      this.error.set('Save or cancel the current row before editing another component.');
      return;
    }
    this.selectedPartId.set(component.designPartId);
    this.draft = {
      supplierId: component.supplierId,
      supplierName: component.supplierName,
      quotationStatus: component.quotationStatus ?? 'NOT_REQUESTED',
      quotationRequestedDate: component.quotationRequestedDate,
      quotationReceivedDate: component.quotationReceivedDate,
      quotationPrice: component.quotationPrice,
      negotiationPrice: component.negotiationPrice,
      finalPrice: component.finalPrice,
      purchaseOrderStatus: component.purchaseOrderStatus ?? 'NOT_RELEASED',
      purchaseOrderReleasedDate: component.purchaseOrderReleasedDate,
      leadTimeDays: component.leadTimeDays,
      partReceivingDate: component.partReceivingDate,
      partReceivedStatus: component.partReceivedStatus ?? 'NOT_RECEIVED',
      qualityStatus: component.qualityStatus ?? 'PENDING',
    };
    this.error.set('');
    this.message.set('');
  }

  protected cancelEditing(): void {
    this.selectedPartId.set(null);
    this.error.set('');
  }

  protected setSupplier(supplier: SupplierSuggestion | null): void {
    this.draft = {
      ...this.draft,
      supplierId: supplier?.id ?? null,
      supplierName: supplier?.name ?? null,
    };
  }

  protected openSupplierForm(name: string): void {
    this.supplierNameSeed.set(name);
    this.supplierFormError.set('');
    this.supplierFormOpen.set(true);
  }

  protected closeSupplierForm(): void {
    if (!this.savingSupplier()) {
      this.supplierFormOpen.set(false);
      this.supplierFormError.set('');
    }
  }

  protected createSupplier(request: SupplierUpsertRequest): void {
    if (this.savingSupplier()) {
      return;
    }
    this.savingSupplier.set(true);
    this.supplierFormError.set('');
    this.suppliersService.create(request).subscribe({
      next: (supplier) => {
        this.setSupplier(supplier);
        this.supplierFormOpen.set(false);
        this.savingSupplier.set(false);
        this.message.set(`${supplier.name} was added and selected.`);
      },
      error: (error: unknown) => {
        this.supplierFormError.set(this.describeError(error, 'Unable to add this supplier.'));
        this.savingSupplier.set(false);
      },
    });
  }

  protected isEditing(component: ProcurementComponent): boolean {
    return this.selectedPartId() === component.designPartId;
  }

  protected saveWorkflowFromKeyboard(event: Event, form: NgForm): void {
    if (!(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
      return;
    }
    event.preventDefault();
    if (form.invalid) {
      form.control.markAllAsTouched();
      return;
    }
    this.saveWorkflow();
  }

  protected saveWorkflow(): void {
    const designPartId = this.selectedPartId();
    if (designPartId === null || this.saving()) {
      return;
    }
    if (this.draft.quotationStatus !== 'NOT_REQUESTED' && !this.draft.quotationRequestedDate) {
      this.error.set('Enter the date the supplier quotation was requested.');
      return;
    }
    if (this.draft.quotationStatus === 'RECEIVED' && !this.draft.quotationReceivedDate) {
      this.error.set('Enter the date the supplier quotation was received.');
      return;
    }
    if (this.draft.purchaseOrderStatus === 'RELEASED' && !this.draft.purchaseOrderReleasedDate) {
      this.error.set('Enter the purchase order release date.');
      return;
    }
    if (this.draft.partReceivedStatus !== 'NOT_RECEIVED' && !this.draft.partReceivingDate) {
      this.error.set('Enter the part receiving date.');
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.message.set('');
    const update = this.flowType === 'purchase'
      ? this.operationsService.updatePurchaseComponent(this.projectId, designPartId, this.draft)
      : this.operationsService.updateManufacturingComponent(this.projectId, designPartId, this.draft);
    update.subscribe({
      next: (updated) => {
        this.components.update((components) => components.map((component) =>
          component.designPartId === updated.designPartId ? updated : component));
        this.saving.set(false);
        this.selectedPartId.set(null);
        this.message.set(`Workflow saved for ${updated.partNumber}.`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(this.describeError(error, 'Unable to save the component workflow.'));
      },
    });
  }

  private loadComponents(): void {
    this.loading.set(true);
    this.error.set('');
    const components = this.flowType === 'purchase'
      ? this.operationsService.purchaseComponents(this.projectId)
      : this.operationsService.manufacturingComponents(this.projectId);
    forkJoin({
      project: this.projectsService.getProject(this.projectId),
      components,
    }).subscribe({
      next: (result) => {
        this.project.set(result.project);
        this.components.set(result.components);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(this.describeError(error, `Unable to load ${this.heading.toLowerCase()}.`));
      },
    });
  }

  protected statusLabel(value: string | null, options: Array<{ value: string; label: string }>): string {
    return options.find((option) => option.value === value)?.label ?? 'Not started';
  }

  protected describeError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return `You do not have permission to access ${this.heading.toLowerCase()}.`;
    }
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'The selected project or component could not be found.';
    }
    if (error instanceof HttpErrorResponse && error.error?.detail) {
      return String(error.error.detail);
    }
    return fallback;
  }

  private emptyDraft(): ProcurementWorkflowRequest {
    return {
      supplierId: null,
      supplierName: null,
      quotationStatus: 'NOT_REQUESTED',
      quotationRequestedDate: null,
      quotationReceivedDate: null,
      quotationPrice: null,
      negotiationPrice: null,
      finalPrice: null,
      purchaseOrderStatus: 'NOT_RELEASED',
      purchaseOrderReleasedDate: null,
      leadTimeDays: null,
      partReceivingDate: null,
      partReceivedStatus: 'NOT_RECEIVED',
      qualityStatus: 'PENDING',
    };
  }
}

@Component({
  selector: 'app-purchase-components-page',
  imports: [DecimalPipe, FormsModule, RouterLink, SupplierAutocompleteComponent, SupplierFormComponent],
  templateUrl: './procurement-components.page.html',
  styleUrl: './operational-components.page.scss',
})
export class PurchaseComponentsPage extends ProcurementComponentsPageBase {
  protected override readonly flowType = 'purchase' as const;
}

@Component({
  selector: 'app-manufacturing-components-page',
  imports: [DecimalPipe, FormsModule, RouterLink, SupplierAutocompleteComponent, SupplierFormComponent],
  templateUrl: './procurement-components.page.html',
  styleUrl: './operational-components.page.scss',
})
export class ManufacturingComponentsPage extends ProcurementComponentsPageBase {
  protected override readonly flowType = 'manufacturing' as const;
}
