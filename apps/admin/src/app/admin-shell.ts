import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbar } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserMenu } from '@ros/shared/auth';
import { RestaurantApi } from '@ros/shared/data-access';
import { map } from 'rxjs';

@Component({
  selector: 'app-admin-shell',
  imports: [MatIconButton, MatListModule, MatSidenavModule, MatToolbar, RouterLink, RouterLinkActive, RouterOutlet, UserMenu],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav class="nav" [mode]="wide() ? 'side' : 'over'" [opened]="wide() || navOpen()" (closedStart)="navOpen.set(false)">
        <div class="brand">
          <span class="logo" aria-hidden="true">☕</span>
          <div><strong>{{ api.cafe().name }}</strong><small>Admin</small></div>
        </div>
        <mat-nav-list>
          @for (l of links; track l.path) {
            <a mat-list-item [routerLink]="l.path" routerLinkActive #rla="routerLinkActive" [activated]="rla.isActive" (click)="navOpen.set(false)">
              <i matListItemIcon class="pi {{ l.icon }}" aria-hidden="true"></i>
              <span matListItemTitle>{{ l.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar class="bar">
          @if (!wide()) {
            <button matIconButton aria-label="Open navigation" (click)="navOpen.set(true)"><i class="pi pi-bars"></i></button>
          }
          <span class="branch">{{ api.cafe().branch }}</span>
          <span class="sync"><i class="pi pi-circle-fill" aria-hidden="true"></i> Live</span>
          <ros-user-menu />
        </mat-toolbar>
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    .shell { min-height: 100dvh; background: var(--bg); }
    .nav { width: 248px; background: var(--card); border-right: 1px solid var(--line); }
    .brand { display: flex; gap: .7rem; align-items: center; padding: 1.1rem 1rem .6rem; }
    .brand strong { display: block; } .brand small { color: var(--muted); }
    .logo { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: var(--brand-soft); font-size: 1.3rem; }
    .nav i { font-size: 1.05rem; color: var(--muted); }
    .bar { background: var(--card); border-bottom: 1px solid var(--line); gap: .8rem; position: sticky; top: 0; z-index: 3; }
    .branch { font-size: 1rem; font-weight: 600; }
    .sync { margin-left: auto; font-size: .8rem; color: var(--muted); display: flex; gap: .35rem; align-items: center; }
    .sync i { color: #16a34a; font-size: .55rem; }
    .content { padding: 1.2rem; max-width: 1200px; }
  `,
})
export class AdminShell {
  protected readonly api = inject(RestaurantApi);
  protected readonly navOpen = signal(false);
  private readonly breakpoints = inject(BreakpointObserver);
  private readonly wideMatch = toSignal(this.breakpoints.observe('(min-width: 900px)').pipe(map(r => r.matches)), { initialValue: true });
  protected readonly wide = computed(() => this.wideMatch());

  protected readonly links = [
    { path: 'menu', label: 'Menu', icon: 'pi-book' },
    { path: 'tables', label: 'Tables & QR', icon: 'pi-qrcode' },
  ];
}
