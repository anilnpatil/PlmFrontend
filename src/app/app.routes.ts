import { Routes } from '@angular/router';
import { AccessDeniedPage } from './features/auth/access-denied.page';
import { authGuard } from './features/auth/auth.guard';
import { LoginPage } from './features/auth/login.page';
import { UsersPage } from './features/admin/users/users.page';
import { RolesPage } from './features/admin/roles/roles.page';
import { ProjectsPage } from './features/projects/projects.page';
import { DesignPartsPage } from './features/designs/design-part/design-parts.page';
import { DesignProjectsDashboardPage } from './features/designs/design-dashboard/design-dashboard.page';
import { DesignFileRootsPage } from './features/designs/file-roots/design-file-roots.page';
import { ModuleDashboardPage } from './features/modules/module-dashboard.page';
import { ManufacturingComponentsPage, PurchaseComponentsPage } from './features/operations/procurement-components.page';
import { ProjectOperationsPage } from './features/operations/project-operations.page';
import { ProjectStockPage } from './features/operations/project-stock.page';
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
      {
        path: 'team-assignments',
        loadComponent: () => import('./features/projects/assignments/project-assignments.page')
          .then((module) => module.ProjectAssignmentsPage),
      },
      {
        path: 'projects/:projectId/assignments',
        loadComponent: () => import('./features/projects/assignments/project-assignments.page')
          .then((module) => module.ProjectAssignmentsPage),
      },
      { path: 'projects/:projectId/design-part', component: DesignPartsPage },
      { path: 'projects/:projectId/purchase', component: PurchaseComponentsPage },
      { path: 'projects/:projectId/manufacturing', component: ManufacturingComponentsPage },
      { path: 'projects/:projectId/stock', component: ProjectStockPage },
      { path: 'design-file-roots', component: DesignFileRootsPage },
      { path: 'designs', component: DesignProjectsDashboardPage },
      { path: 'projects', component: ProjectsPage },
      { path: 'features/purchase', component: ProjectOperationsPage, data: { workflow: 'purchase' } },
      { path: 'features/manufacturing', component: ProjectOperationsPage, data: { workflow: 'manufacturing' } },
      { path: 'features/stock', component: ProjectOperationsPage, data: { workflow: 'stock' } },
      { path: 'features/electrical', component: ModuleDashboardPage, data: { moduleName: 'Electrical' } },
      { path: 'features/controls', component: ModuleDashboardPage, data: { moduleName: 'Controls' } },
      { path: 'features/fat', component: ModuleDashboardPage, data: { moduleName: 'FAT' } },
      { path: 'features/sat', component: ModuleDashboardPage, data: { moduleName: 'SAT' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
