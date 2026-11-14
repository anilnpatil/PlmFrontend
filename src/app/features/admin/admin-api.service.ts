import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environment';
import { AuthUser } from '../auth/auth.models';

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface FunctionalArea {
  code: string;
  name: string;
}

export interface ProjectAssignment {
  userId: number;
  email: string;
  fullName: string;
  roles: string[];
  functionalAreas: string[];
  areaAccess: Record<string, 'READ_ONLY' | 'READ_WRITE'>;
  assignedAt: string;
}

export type AreaAccessLevel = 'READ_ONLY' | 'READ_WRITE';

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiBaseUrl}/api`;

  listUsers(): Observable<AuthUser[]> {
    return this.http.get<AuthUser[]>(`${this.api}/admin/users`);
  }

  listRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.api}/admin/roles`);
  }

  createUser(body: { email: string; password: string; fullName: string; roleCodes: string[] }): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.api}/admin/users`, body);
  }

  updateUser(userId: number, body: { fullName: string; password?: string; roleCodes: string[] }): Observable<AuthUser> {
    return this.http.put<AuthUser>(`${this.api}/admin/users/${userId}`, body);
  }

  updateUserStatus(userId: number, active: boolean): Observable<AuthUser> {
    return this.http.patch<AuthUser>(`${this.api}/admin/users/${userId}/status`, { active });
  }

  createRole(body: { code: string; name: string; description: string; permissionCodes: string[] }): Observable<Role> {
    return this.http.post<Role>(`${this.api}/admin/roles`, body);
  }

  updateRole(roleId: number, body: { code: string; name: string; description: string; permissionCodes: string[] }): Observable<Role> {
    return this.http.put<Role>(`${this.api}/admin/roles/${roleId}`, body);
  }

  listFunctionalAreas(): Observable<FunctionalArea[]> {
    return this.http.get<FunctionalArea[]>(`${this.api}/admin/functional-areas`);
  }

  createFunctionalArea(body: FunctionalArea): Observable<FunctionalArea> {
    return this.http.post<FunctionalArea>(`${this.api}/admin/functional-areas`, body);
  }

  listProjectUsers(projectId: number): Observable<AuthUser[]> {
    return this.http.get<AuthUser[]>(`${this.api}/projects/${projectId}/assignable-users`);
  }

  listAssignments(projectId: number): Observable<ProjectAssignment[]> {
    return this.http.get<ProjectAssignment[]>(`${this.api}/projects/${projectId}/assignments`);
  }

  assignUser(projectId: number, userId: number, areaAccess: Record<string, AreaAccessLevel>): Observable<ProjectAssignment> {
    return this.http.put<ProjectAssignment>(
      `${this.api}/projects/${projectId}/assignments/${userId}`,
      { roleCodes: [], functionalAreaCodes: [], areaAccess },
    );
  }

  removeAssignment(projectId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/projects/${projectId}/assignments/${userId}`);
  }
}
