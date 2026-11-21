import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../features/auth/auth.service';

interface NavigationItem {
  label: string;
  icon: string;
  badge?: string;
  route?: string;
  permission?: string;
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
    'Team Assignments',
    'Design',
    'Design folders',
    'Electrical',
    'Controls',
    'Purchase',
    'Manufacturing',
    'Suppliers',
    'Stock',
    'Assembly',
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
        { label: 'Team Assignments', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6', route: '/team-assignments' },
        { label: 'Tasks', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
        { label: 'Documents', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8' },
      ],
    },
    {
      label: 'LIFECYCLE',
      items: [
        { label: 'Design', icon: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4ZM13.5 7.5l3 3', route: '/designs' },
        { label: 'Purchase', icon: 'M3 4h2l2.2 11h10.9l2-8H6M9 19h.01M17 19h.01', route: '/features/purchase' },        
        { label: 'Manufacturing', icon: 'M3 21h18M5 21V7l4 2V5l4 2V3l6 3v15M9 21v-4h3v4', route: '/features/manufacturing' },
        { label: 'Stock', icon: 'M3 7l9-4 9 4-9 4-9-4ZM3 12l9 4 9-4M3 17l9 4 9-4', route: '/features/stock' },
        { label: 'Assembly', icon: 'M4 5h16v14H4zM8 9h8M8 13h5M8 17h8', route: '/features/assembly', permission: 'ASSEMBLY_READ' },
        { label: 'Suppliers', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', route: '/suppliers', permission: 'SOURCING_SUPPLIER_MANAGE' },
        { label: 'Electrical', icon: 'M13 2 4 14h7l-1 8 10-13h-7l1-7Z', route: '/features/electrical' },
        { label: 'Controls', icon: 'M12 3v18M3 12h18M6 6l12 12M18 6 6 18', route: '/features/controls' },
        { label: 'FAT', icon: 'M4 5h16v14H4zM8 9h8M8 13h5', route: '/features/fat' },
        { label: 'SAT', icon: 'M4 5h16v14H4zM8 9l2 2 5-5M8 15h8', route: '/features/sat' },        
        { label: 'Design folders', icon: 'M3 7h7l2 2h9v10H3zM3 7V5h7l2 2', route: '/design-file-roots' },
        
        
        
        
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

  protected isPurchaseWorkspace(): boolean {
    const path = this.router.url.split('?')[0];
    return path === '/features/purchase' || /^\/projects\/\d+\/purchase$/.test(path);
  }

  protected isProjectsList(): boolean {
    return this.router.url.split('?')[0] === '/projects';
  }

  protected isWorkflowWorkspace(): boolean {
    const path = this.router.url.split('?')[0];
    return /^\/projects\/\d+\/(purchase|manufacturing|stock)$/.test(path)
      || /^\/projects\/\d+\/assembly$/.test(path)
      || /^\/features\/(purchase|manufacturing|stock|assembly)$/.test(path);
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
      if (url.includes('/assignments')) {
        this.activeTitle.set('Team Assignments');
      } else if (url.includes('/design-part')) {
        this.activeTitle.set('Design');
      } else if (url.includes('/purchase')) {
        this.activeTitle.set('Purchase');
      } else if (url.includes('/manufacturing')) {
        this.activeTitle.set('Manufacturing');
      } else if (url.includes('/stock')) {
        this.activeTitle.set('Stock');
      } else if (url.includes('/assembly')) {
        this.activeTitle.set('Assembly');
      } else {
        this.activeTitle.set('Projects');
      }
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
