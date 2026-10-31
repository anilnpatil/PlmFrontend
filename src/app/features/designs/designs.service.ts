import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environment';

export interface DesignPermissions {
  canCreateAssembly: boolean;
  canCreatePart: boolean;
  canReadParts: boolean;
  canUpdateParts: boolean;
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
  modeOfPurchase: ModeOfPurchase;
  partStatus: PartStatus;
  createdBy: string;
  filePath: string | null;
  startDate: string | null;
  completedDate: string | null;
  createdAt: string;
}

export type ModeOfPurchase = 'PURCHASE' | 'MANUFACTURE' | 'STOCK';
export type PartStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_TO_PURCHASE';

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

export interface DesignFileBrowserEntry {
  name: string;
  relativePath: string;
  directory: boolean;
  fullPath: string | null;
}

export interface DesignFileBrowserRoot {
  id: number;
  name: string;
  path: string;
}

export interface DesignFileRoot {
  id: number;
  name: string;
  path: string;
}

export interface DesignFileRootsResponse {
  roots: DesignFileRoot[];
  canManage: boolean;
}

export interface DesignFileBrowserResponse {
  roots: DesignFileBrowserRoot[];
  selectedRootId: number;
  currentDirectory: string;
  parentDirectory: string | null;
  entries: DesignFileBrowserEntry[];
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
  modeOfPurchase: ModeOfPurchase;
  partStatus: PartStatus;
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

  updatePartStatus(projectId: number, partId: number, partStatus: PartStatus): Observable<DesignPart> {
    return this.http.patch<DesignPart>(
      `${this.projectUrl(projectId)}/parts/${partId}/status`,
      { partStatus },
    );
  }

  partFile(projectId: number, partId: number, download: boolean): Observable<Blob> {
    const action = download ? '/download' : '';
    return this.http.get(`${this.projectUrl(projectId)}/parts/${partId}/file${action}`, {
      responseType: 'blob',
    });
  }

  browseServerFiles(
    projectId: number,
    rootId: number,
    path: string,
  ): Observable<DesignFileBrowserResponse> {
    return this.http.get<DesignFileBrowserResponse>(`${this.projectUrl(projectId)}/file-browser`, {
      params: { rootId, path },
    });
  }

  fileRoots(projectId: number): Observable<DesignFileRootsResponse> {
    return this.http.get<DesignFileRootsResponse>(`${this.projectUrl(projectId)}/file-roots`);
  }

  addFileRoot(projectId: number, path: string): Observable<DesignFileRoot> {
    return this.http.post<DesignFileRoot>(`${this.projectUrl(projectId)}/file-roots`, { path });
  }

  removeFileRoot(projectId: number, rootId: number): Observable<void> {
    return this.http.delete<void>(`${this.projectUrl(projectId)}/file-roots/${rootId}`);
  }

  private projectUrl(projectId: number): string {
    return `${environment.apiBaseUrl}/api/projects/${projectId}/designs`;
  }
}
