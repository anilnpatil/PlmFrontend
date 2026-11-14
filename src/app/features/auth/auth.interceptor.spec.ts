import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { environment } from '../../environment';
import { AuthService } from './auth.service';
import { LoginResponse } from './auth.models';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let auth: AuthService;
  let httpTesting: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('keeps the session active and lets the page handle a forbidden API response', () => {
    const response: LoginResponse = {
      accessToken: 'test-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 1,
        email: 'designer@example.com',
        fullName: 'Designer',
        active: true,
        roles: ['DESIGNER'],
      },
      permissions: [],
    };
    auth.login(response.user.email, 'password').subscribe();
    httpTesting.expectOne(`${environment.apiBaseUrl}/api/auth/login`).flush(response);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    let responseStatus = 0;

    TestBed.inject(HttpClient)
      .get(`${environment.apiBaseUrl}/api/projects/1/designs/workspace`)
      .subscribe({
        error: (error: { status: number }) => responseStatus = error.status,
      });
    httpTesting.expectOne(`${environment.apiBaseUrl}/api/projects/1/designs/workspace`)
      .flush({ detail: 'Access denied' }, { status: 403, statusText: 'Forbidden' });

    expect(responseStatus).toBe(403);
    expect(auth.isAuthenticated()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
