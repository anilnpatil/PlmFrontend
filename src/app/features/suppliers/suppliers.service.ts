import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environment';

export type SupplierServiceType = 'PURCHASE' | 'MANUFACTURING';

export interface Supplier {
  id: number;
  supplierNumber: string;
  name: string;
  serviceTypes: SupplierServiceType[];
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SupplierSuggestion = Pick<Supplier, 'id' | 'supplierNumber' | 'name'>;

export interface SupplierUpsertRequest {
  supplierNumber: string;
  name: string;
  serviceTypes: SupplierServiceType[];
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  description: string | null;
}

export interface SupplierPage {
  content: Supplier[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly http = inject(HttpClient);
  private readonly suppliersUrl = `${environment.apiBaseUrl}/api/suppliers`;

  suggestions(query: string, serviceType: SupplierServiceType): Observable<SupplierSuggestion[]> {
    const params = new HttpParams().set('query', query).set('serviceType', serviceType);
    return this.http.get<SupplierSuggestion[]>(`${this.suppliersUrl}/suggestions`, { params });
  }

  search(query: string, active: boolean | null, page: number, size: number): Observable<SupplierPage> {
    let params = new HttpParams().set('query', query).set('page', page).set('size', size);
    if (active !== null) {
      params = params.set('active', active);
    }
    return this.http.get<SupplierPage>(this.suppliersUrl, { params });
  }

  create(request: SupplierUpsertRequest): Observable<Supplier> {
    return this.http.post<Supplier>(this.suppliersUrl, request);
  }

  update(id: number, request: SupplierUpsertRequest): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.suppliersUrl}/${id}`, request);
  }

  updateStatus(id: number, active: boolean): Observable<Supplier> {
    return this.http.patch<Supplier>(`${this.suppliersUrl}/${id}/status`, { active });
  }
}
