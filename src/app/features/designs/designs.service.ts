import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environment';

export interface DesignPermissions {
  canCreateAssembly: boolean;
  canCreatePart: boolean;
  canReadParts: boolean;
}

export interface DesignPart {
  id: number;
  mainAssemblyId: number | null;
  subAssemblyId: number | null;
  partNumber: string;
  partName: string;
  quantity: number;
  description: string | null;
  make: string | null;
  createdBy: string;
  filePath: string | null;
  startDate: string | null;
  completedDate: string | null;
  createdAt: string;
}

export interface DesignSubAssembly {
  id: number;
  mainAssemblyId: number;
  assemblyNumber: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  parts: DesignPart[];
}

export interface DesignMainAssembly {
  id: number;
  projectId: number;
  assemblyNumber: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  parts: DesignPart[];
  subAssemblies: DesignSubAssembly[];
}

export interface DesignWorkspace {
  mainAssemblies: DesignMainAssembly[];
  permissions: DesignPermissions;
}

export interface AssemblyRequest {
  assemblyNumber: string;
  name: string;
  description: string;
}

export interface DesignPartRequest {
  mainAssemblyId: number | null;
  subAssemblyId: number | null;
  partNumber: string;
  partName: string;
  quantity: number;
  description: string;
  make: string;
  filePath: string;
  startDate: string | null;
  completedDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class DesignsService {
  private readonly http = inject(HttpClient);

  workspace(projectId: number): Observable<DesignWorkspace> {
    return this.http.get<DesignWorkspace>(`${this.projectUrl(projectId)}/workspace`);
  }

  createMainAssembly(projectId: number, request: AssemblyRequest): Observable<DesignMainAssembly> {
    return this.http.post<DesignMainAssembly>(
      `${this.projectUrl(projectId)}/main-assemblies`,
      request,
    );
  }

  createSubAssembly(
    projectId: number,
    mainAssemblyId: number,
    request: AssemblyRequest,
  ): Observable<DesignSubAssembly> {
    return this.http.post<DesignSubAssembly>(
      `${this.projectUrl(projectId)}/main-assemblies/${mainAssemblyId}/sub-assemblies`,
      request,
    );
  }

  createPart(projectId: number, request: DesignPartRequest): Observable<DesignPart> {
    return this.http.post<DesignPart>(`${this.projectUrl(projectId)}/parts`, request);
  }

  private projectUrl(projectId: number): string {
    return `${environment.apiBaseUrl}/api/projects/${projectId}/designs`;
  }
}
