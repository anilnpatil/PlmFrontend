import { Routes } from '@angular/router';
import { AccessDeniedPage } from './features/auth/access-denied.page';
import { authGuard } from './features/auth/auth.guard';
import { LoginPage } from './features/auth/login.page';
import { UsersPage } from './features/admin/users/users.page';
import { RolesPage } from './features/admin/roles/roles.page';
import { ProjectAssignmentsPage } from './features/projects/assignments/project-assignments.page';
import { ProjectsPage } from './features/projects/projects.page';
import { DesignPartsPage } from './features/designs/design-part/design-parts.page';
import { DesignProjectsDashboardPage } from './features/designs/design-dashboard/design-dashboard.page';
import { DesignFileRootsPage } from './features/designs/file-roots/design-file-roots.page';
import { ModuleDashboardPage } from './features/modules/module-dashboard.page';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  { path: 'login', component: LoginPage },
  { path: 'access-denied', component: AccessDeniedPage },
  {
    path: 'admin/users',
    component: UsersPage,
    canActivate: [authGuard],
    data: { permission: 'USERS_MANAGE' },
  },
  {
    path: 'admin/roles',
    component: RolesPage,
    canActivate: [authGuard],
    data: { permission: 'ROLES_MANAGE' },
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'projects/:projectId/assignments', component: ProjectAssignmentsPage },
      { path: 'projects/:projectId/design-part', component: DesignPartsPage },
      { path: 'design-file-roots', component: DesignFileRootsPage },
      { path: 'designs', component: DesignProjectsDashboardPage },
      { path: 'projects', component: ProjectsPage },
      { path: 'features/electrical', component: ModuleDashboardPage, data: { moduleName: 'Electrical' } },
      { path: 'features/controls', component: ModuleDashboardPage, data: { moduleName: 'Controls' } },
      { path: 'features/purchase', component: ModuleDashboardPage, data: { moduleName: 'Purchase' } },
      { path: 'features/fat', component: ModuleDashboardPage, data: { moduleName: 'FAT' } },
      { path: 'features/sat', component: ModuleDashboardPage, data: { moduleName: 'SAT' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
