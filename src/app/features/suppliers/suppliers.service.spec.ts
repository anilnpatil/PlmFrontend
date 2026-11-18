import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { environment } from '../../environment';
import { SuppliersService } from './suppliers.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SuppliersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('requests bounded supplier suggestions for the selected workflow type', () => {
    let response: unknown;
    service.suggestions('Ac', 'PURCHASE').subscribe((result) => response = result);

    const request = httpTesting.expectOne((candidate) =>
      candidate.url === `${environment.apiBaseUrl}/api/suppliers/suggestions`
      && candidate.params.get('query') === 'Ac'
      && candidate.params.get('serviceType') === 'PURCHASE');
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 5, supplierNumber: 'SUP-005', name: 'Acme Parts' }]);

    expect(response).toEqual([{ id: 5, supplierNumber: 'SUP-005', name: 'Acme Parts' }]);
  });

  it('sends supplier creation through the dedicated directory endpoint', () => {
    const payload = {
      supplierNumber: 'SUP-006',
      name: 'Northstar Manufacturing',
      serviceTypes: ['MANUFACTURING' as const],
      contactPerson: null,
      email: null,
      phone: null,
      address: null,
      description: null,
    };

    service.create(payload).subscribe();

    const request = httpTesting.expectOne(`${environment.apiBaseUrl}/api/suppliers`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ id: 6, ...payload, active: true });
  });
});
