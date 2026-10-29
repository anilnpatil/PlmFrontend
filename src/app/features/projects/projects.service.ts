import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environment';

export interface Project {
  id: number;
  projectNumber: string;
  projectName: string;
  projectDescription: string | null;
  customerName: string;
  customerAddress: string | null;
  targetStartDate: string | null;
  targetEndDate: string | null;
  createdAt: string;
}

export interface ProjectPage {
  content: Project[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface ProjectSearch {
  projectNumber?: string;
  projectName?: string;
  customerName?: string;
  page: number;
  size: number;
  sortBy: string;
  sortDirection: 'ASC' | 'DESC';
}

export interface ProjectRequest {
  projectNumber: string;
  projectName: string;
  projectDescription: string;
  customerName: string;
  customerAddress: string;
  targetStartDate: string | null;
  targetEndDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly projectsUrl = `${environment.apiBaseUrl}/api/projects`;

  searchProjects(search: ProjectSearch): Observable<ProjectPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(search)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return this.http.get<ProjectPage>(this.projectsUrl, { params });
  }

  getProject(id: number): Observable<Project> {
    return this.http.get<Project>(`${this.projectsUrl}/${id}`);
  }

  createProject(request: ProjectRequest): Observable<Project> {
    return this.http.post<Project>(this.projectsUrl, request);
  }

  updateProject(id: number, request: ProjectRequest): Observable<Project> {
    return this.http.put<Project>(`${this.projectsUrl}/${id}`, request);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.projectsUrl}/${id}`);
  }
}
