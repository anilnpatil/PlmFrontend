import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Supplier, SupplierServiceType, SupplierUpsertRequest } from './suppliers.service';

@Component({
  selector: 'app-supplier-form',
  imports: [ReactiveFormsModule],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss',
})
export class SupplierFormComponent implements OnInit {
  @Input() supplier: Supplier | null = null;
  @Input() initialName = '';
  @Input() initialServiceType: SupplierServiceType = 'PURCHASE';
  @Input() saving = false;
  @Output() submitted = new EventEmitter<SupplierUpsertRequest>();
  @Output() cancelled = new EventEmitter<void>();

  protected readonly serviceTypeOptions: Array<{ value: SupplierServiceType; label: string }> = [
    { value: 'PURCHASE', label: 'Purchase supply' },
    { value: 'MANUFACTURING', label: 'Manufacturing service' },
  ];

  protected readonly form = new FormGroup({
    supplierNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(30)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    serviceTypes: new FormControl<SupplierServiceType[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    contactPerson: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(254)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(40)] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  ngOnInit(): void {
    if (this.supplier) {
      this.form.patchValue({
        supplierNumber: this.supplier.supplierNumber,
        name: this.supplier.name,
        serviceTypes: [...this.supplier.serviceTypes],
        contactPerson: this.supplier.contactPerson ?? '',
        email: this.supplier.email ?? '',
        phone: this.supplier.phone ?? '',
        address: this.supplier.address ?? '',
        description: this.supplier.description ?? '',
      });
    } else {
      this.form.patchValue({
        name: this.initialName,
        serviceTypes: [this.initialServiceType],
      });
    }
  }

  protected hasServiceType(type: SupplierServiceType): boolean {
    return this.form.controls.serviceTypes.value.includes(type);
  }

  protected toggleServiceType(type: SupplierServiceType, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const types = this.form.controls.serviceTypes.value.filter((value) => value !== type);
    if (checked) {
      types.push(type);
    }
    this.form.controls.serviceTypes.setValue(types);
    this.form.controls.serviceTypes.markAsTouched();
  }

  protected save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.submitted.emit({
      supplierNumber: value.supplierNumber.trim(),
      name: value.name.trim(),
      serviceTypes: value.serviceTypes,
      contactPerson: value.contactPerson.trim() || null,
      email: value.email.trim() || null,
      phone: value.phone.trim() || null,
      address: value.address.trim() || null,
      description: value.description.trim() || null,
    });
  }
}
