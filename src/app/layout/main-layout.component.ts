import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../features/auth/auth.service';

interface NavigationItem {
  label: string;
  icon: string;
  badge?: string;
  route?: string;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

@Component({
  selector: 'app-layout',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly activeTitle = signal('Overview');
  protected readonly showingFeature = computed(() => [
    'Projects',
    'Design',
    'Electrical',
    'Controls',
    'Purchase',
    'FAT',
    'SAT',
  ].includes(this.activeTitle()));

  constructor() {
    this.setActiveTitle(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.setActiveTitle(event.urlAfterRedirects));
  }

  protected readonly navigationGroups: NavigationGroup[] = [
    {
      label: 'WORKSPACE',
      items: [
        { label: 'Overview', icon: 'M3 3h8v8H3zM13 3h8v5h-8zM13 10h8v11h-8zM3 13h8v8H3z', route: '/' },
        { label: 'Projects', icon: 'M3 7.5 12 3l9 4.5-9 4.5-9-4.5ZM3 12l9 4.5 9-4.5M3 16.5 12 21l9-4.5', route: '/projects' },
        { label: 'Tasks', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
        { label: 'Documents', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8' },
      ],
    },
    {
      label: 'LIFECYCLE',
      items: [
        { label: 'Design', icon: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4ZM13.5 7.5l3 3', route: '/designs' },
        { label: 'Electrical', icon: 'M13 2 4 14h7l-1 8 10-13h-7l1-7Z', route: '/features/electrical' },
        { label: 'Controls', icon: 'M12 3v18M3 12h18M6 6l12 12M18 6 6 18', route: '/features/controls' },
        { label: 'Purchase', icon: 'M3 4h2l2.2 11h10.9l2-8H6M9 19h.01M17 19h.01', route: '/features/purchase' },
        { label: 'FAT', icon: 'M4 5h16v14H4zM8 9h8M8 13h5', route: '/features/fat' },
        { label: 'SAT', icon: 'M4 5h16v14H4zM8 9l2 2 5-5M8 15h8', route: '/features/sat' },
      ],
    },
  ];

  protected toggleNavigation(): void {
    if (window.matchMedia('(max-width: 800px)').matches) {
      this.mobileMenuOpen.update((open) => !open);
      return;
    }
    this.sidebarCollapsed.update((collapsed) => !collapsed);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected isDesignWorkspace(): boolean {
    return /^\/projects\/\d+\/design-part$/.test(this.router.url.split('?')[0]);
  }

  protected navigateTo(label: string): void {
    this.activeTitle.set(label);
    this.closeMobileMenu();
  }

  private setActiveTitle(url: string): void {
    if (url === '/') {
      this.activeTitle.set('Overview');
      return;
    }
    if (url.startsWith('/projects/')) {
      this.activeTitle.set(url.includes('/design-part') ? 'Design' : 'Projects');
      return;
    }
    if (url.startsWith('/projects')) {
      this.activeTitle.set('Projects');
      return;
    }
    const feature = this.navigationGroups.flatMap((group) => group.items)
      .find((item) => item.route && item.route !== '/' && url.startsWith(item.route));
    this.activeTitle.set(feature?.label ?? (url === '/' ? 'Overview' : 'Workspace'));
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
