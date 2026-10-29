import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environment';
import { AuthService } from './auth.service';
import { LoginResponse } from './auth.models';

describe('AuthService', () => {
  let auth: AuthService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('grants every permission to a system administrator role', () => {
    const response: LoginResponse = {
      accessToken: 'test-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 1,
        email: 'admin@example.com',
        fullName: 'System Admin',
        active: true,
        roles: ['SYSTEM_ADMIN'],
      },
      permissions: [],
    };

    auth.login(response.user.email, 'password').subscribe();
    httpTesting.expectOne(`${environment.apiBaseUrl}/api/auth/login`).flush(response);

    expect(auth.isSystemAdmin()).toBe(true);
    expect(auth.hasPermission('PROJECT_DELETE')).toBe(true);
    expect(auth.hasPermission('DESIGN_REVIEW')).toBe(true);
  });

  it('keeps regular users limited to their assigned permissions', () => {
    const response: LoginResponse = {
      accessToken: 'test-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 2,
        email: 'designer@example.com',
        fullName: 'Designer',
        active: true,
        roles: ['DESIGNER'],
      },
      permissions: ['DESIGN_READ'],
    };

    auth.login(response.user.email, 'password').subscribe();
    httpTesting.expectOne(`${environment.apiBaseUrl}/api/auth/login`).flush(response);

    expect(auth.hasPermission('DESIGN_READ')).toBe(true);
    expect(auth.hasPermission('PROJECT_DELETE')).toBe(false);
  });

  it('restores a valid session from session storage after service recreation', () => {
    const response: LoginResponse = {
      accessToken: 'restored-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 3,
        email: 'admin@example.com',
        fullName: 'System Admin',
        active: true,
        roles: ['SYSTEM_ADMIN'],
      },
      permissions: ['SYSTEM_ADMIN'],
    };

    auth.login(response.user.email, 'password').subscribe();
    httpTesting.expectOne(`${environment.apiBaseUrl}/api/auth/login`).flush(response);
    expect(sessionStorage.getItem('plm.auth.session')).not.toBeNull();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.token()).toBe('restored-token');
    expect(auth.hasPermission('PROJECT_DELETE')).toBe(true);
  });

  it('rejects sessions that were idle for five minutes', () => {
    sessionStorage.setItem('plm.auth.session', JSON.stringify({
      accessToken: 'expired-idle-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: 4,
        email: 'designer@example.com',
        fullName: 'Designer',
        active: true,
        roles: ['DESIGNER'],
      },
      permissions: ['DESIGN_READ'],
      lastActivityAt: Date.now() - 5 * 60 * 1000,
    }));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.sessionExpiredByIdle()).toBe(true);
    expect(sessionStorage.getItem('plm.auth.session')).toBeNull();
  });
});
