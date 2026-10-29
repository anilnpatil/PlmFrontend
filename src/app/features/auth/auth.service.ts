import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environment';
import { AuthUser, LoginResponse } from './auth.models';

const SESSION_STORAGE_KEY = 'plm.auth.session';
export const SESSION_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface StoredSession {
  accessToken: string;
  expiresAt: string;
  user: AuthUser;
  permissions: string[];
  lastActivityAt: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly accessToken = signal<string | null>(null);
  private readonly expiresAt = signal<string | null>(null);
  private readonly lastActivityAt = signal<number | null>(null);
  readonly user = signal<AuthUser | null>(null);
  readonly permissions = signal<ReadonlySet<string>>(new Set());
  readonly isAuthenticated = computed(() => this.accessToken() !== null && this.user() !== null);
  readonly sessionExpiredByIdle = signal(false);
  readonly isSystemAdmin = computed(() =>
    this.permissions().has('SYSTEM_ADMIN')
    || this.user()?.roles.some((role) => role.toUpperCase() === 'SYSTEM_ADMIN') === true,
  );

  constructor() {
    this.restoreSession();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/api/auth/login`, { email, password })
      .pipe(tap((response) => this.setSession(response)));
  }

  token(): string | null {
    return this.accessToken();
  }

  hasPermission(permission: string): boolean {
    const current = this.permissions();
    return this.isSystemAdmin() || current.has(permission);
  }

  logout(): void {
    this.sessionExpiredByIdle.set(false);
    this.clearSession();
  }

  clearSession(): void {
    this.accessToken.set(null);
    this.expiresAt.set(null);
    this.user.set(null);
    this.permissions.set(new Set());
    this.lastActivityAt.set(null);
    this.removeStoredSession();
  }

  expireSessionForIdle(): void {
    this.clearSession();
    this.sessionExpiredByIdle.set(true);
  }

  remainingIdleTime(): number {
    const lastActivityAt = this.lastActivityAt();
    return lastActivityAt === null
      ? SESSION_IDLE_TIMEOUT_MS
      : Math.max(0, SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt));
  }

  recordActivity(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    this.lastActivityAt.set(Date.now());
    this.persistSession();
  }

  private setSession(response: LoginResponse): void {
    this.accessToken.set(response.accessToken);
    this.expiresAt.set(response.expiresAt);
    this.user.set(response.user);
    this.permissions.set(new Set(response.permissions));
    this.lastActivityAt.set(Date.now());
    this.sessionExpiredByIdle.set(false);
    this.persistSession();
  }

  private restoreSession(): void {
    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }

    let raw: string | null;
    try {
      raw = storage.getItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Unable to read the saved PLM session.', error);
      return;
    }

    if (raw === null) {
      return;
    }

    let session: unknown;
    try {
      session = JSON.parse(raw);
    } catch (error) {
      console.warn('Discarding an invalid saved PLM session.', error);
      this.removeStoredSession();
      return;
    }

    if (!this.isStoredSession(session)) {
      console.warn('Discarding an incomplete saved PLM session.');
      this.removeStoredSession();
      return;
    }

    if (Date.parse(session.expiresAt) <= Date.now()) {
      this.removeStoredSession();
      return;
    }

    if (Date.now() - session.lastActivityAt >= SESSION_IDLE_TIMEOUT_MS) {
      this.sessionExpiredByIdle.set(true);
      this.removeStoredSession();
      return;
    }

    this.accessToken.set(session.accessToken);
    this.expiresAt.set(session.expiresAt);
    this.user.set(session.user);
    this.permissions.set(new Set(session.permissions));
    this.lastActivityAt.set(session.lastActivityAt);
  }

  private isStoredSession(value: unknown): value is StoredSession {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const session = value as Partial<StoredSession>;
    const user = session.user;
    return typeof session.accessToken === 'string'
      && session.accessToken.length > 0
      && typeof session.expiresAt === 'string'
      && Number.isFinite(Date.parse(session.expiresAt))
      && typeof session.lastActivityAt === 'number'
      && Number.isFinite(session.lastActivityAt)
      && Array.isArray(session.permissions)
      && session.permissions.every((permission) => typeof permission === 'string')
      && typeof user === 'object'
      && user !== null
      && typeof user.id === 'number'
      && typeof user.email === 'string'
      && typeof user.fullName === 'string'
      && typeof user.active === 'boolean'
      && Array.isArray(user.roles)
      && user.roles.every((role) => typeof role === 'string');
  }

  private persistSession(): void {
    const accessToken = this.accessToken();
    const expiresAt = this.expiresAt();
    const user = this.user();
    const lastActivityAt = this.lastActivityAt();
    if (!accessToken || !expiresAt || !user || lastActivityAt === null) {
      return;
    }

    const session: StoredSession = {
      accessToken,
      expiresAt,
      user,
      permissions: [...this.permissions()],
      lastActivityAt,
    };

    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }

    try {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Unable to save the PLM session for this tab.', error);
    }
  }

  private removeStoredSession(): void {
    const storage = this.getSessionStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(SESSION_STORAGE_KEY);
    } catch (error) {
      console.error('Unable to clear the saved PLM session.', error);
    }
  }

  private getSessionStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.sessionStorage;
    } catch (error) {
      console.error('Session storage is unavailable.', error);
      return null;
    }
  }
}
