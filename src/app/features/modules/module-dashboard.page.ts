import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-module-dashboard-page',
  imports: [RouterLink],
  templateUrl: './module-dashboard.page.html',
  styleUrl: './module-dashboard.page.scss',
})
export class ModuleDashboardPage {
  protected readonly moduleName = String(inject(ActivatedRoute).snapshot.data['moduleName']);
}
