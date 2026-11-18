import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environment';

export type QuotationStatus = 'NOT_REQUESTED' | 'REQUESTED' | 'RECEIVED';
export type PurchaseOrderStatus = 'NOT_RELEASED' | 'RELEASED';
export type PartReceivedStatus = 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
export type QualityStatus = 'PENDING' | 'OK' | 'NOT_OK' | 'REWORK';
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE';

export interface ProcurementComponent {
  designPartId: number;
  workflowId: number | null;
  partNumber: string;
  partName: string;
  supplierId: number | null;
  supplierName: string | null;
  quantity: number;
  mainAssemblyNumber: string;
  subAssemblyNumber: string | null;
  description: string | null;
  filePath: string | null;
  quotationStatus: QuotationStatus | null;
  quotationRequestedDate: string | null;
  quotationReceivedDate: string | null;
  quotationPrice: number | null;
  negotiationPrice: number | null;
  finalPrice: number | null;
  currencyCode: string;
  purchaseOrderStatus: PurchaseOrderStatus | null;
  purchaseOrderReleasedDate: string | null;
  leadTimeDays: number | null;
  partReceivingDate: string | null;
  partReceivedStatus: PartReceivedStatus | null;
  qualityStatus: QualityStatus | null;
}

export interface ProcurementWorkflowRequest {
  supplierId: number | null;
  supplierName: string | null;
  quotationStatus: QuotationStatus;
  quotationRequestedDate: string | null;
  quotationReceivedDate: string | null;
  quotationPrice: number | null;
  negotiationPrice: number | null;
  finalPrice: number | null;
  purchaseOrderStatus: PurchaseOrderStatus;
  purchaseOrderReleasedDate: string | null;
  leadTimeDays: number | null;
  partReceivingDate: string | null;
  partReceivedStatus: PartReceivedStatus;
  qualityStatus: QualityStatus;
}

export interface ProjectStockComponent {
  designPartId: number;
  stockItemId: number | null;
  partNumber: string;
  partName: string;
  quantity: number;
  mainAssemblyNumber: string;
  subAssemblyNumber: string | null;
  description: string | null;
  filePath: string | null;
  totalWeightKg: number | null;
  availabilityStatus: AvailabilityStatus;
}

export interface ProjectStockUpdateRequest {
  totalWeightKg: number;
  availabilityStatus: AvailabilityStatus;
}

@Injectable({ providedIn: 'root' })
export class OperationsService {
  private readonly http = inject(HttpClient);

  purchaseComponents(projectId: number): Observable<ProcurementComponent[]> {
    return this.http.get<ProcurementComponent[]>(`${this.projectUrl(projectId)}/purchase/components`);
  }

  updatePurchaseComponent(
    projectId: number,
    designPartId: number,
    request: ProcurementWorkflowRequest,
  ): Observable<ProcurementComponent> {
    return this.http.put<ProcurementComponent>(
      `${this.projectUrl(projectId)}/purchase/components/${designPartId}`,
      request,
    );
  }

  manufacturingComponents(projectId: number): Observable<ProcurementComponent[]> {
    return this.http.get<ProcurementComponent[]>(`${this.projectUrl(projectId)}/manufacturing/components`);
  }

  updateManufacturingComponent(
    projectId: number,
    designPartId: number,
    request: ProcurementWorkflowRequest,
  ): Observable<ProcurementComponent> {
    return this.http.put<ProcurementComponent>(
      `${this.projectUrl(projectId)}/manufacturing/components/${designPartId}`,
      request,
    );
  }

  projectStockComponents(projectId: number): Observable<ProjectStockComponent[]> {
    return this.http.get<ProjectStockComponent[]>(`${this.projectUrl(projectId)}/stock/components`);
  }

  updateProjectStock(
    projectId: number,
    designPartId: number,
    request: ProjectStockUpdateRequest,
  ): Observable<ProjectStockComponent> {
    return this.http.put<ProjectStockComponent>(
      `${this.projectUrl(projectId)}/stock/components/${designPartId}`,
      request,
    );
  }

  private projectUrl(projectId: number): string {
    return `${environment.apiBaseUrl}/api/projects/${projectId}`;
  }
}
