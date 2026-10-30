import { Component, computed, inject, input } from '@angular/core';
import { MatDivider } from '@angular/material/divider';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { AuthService } from '@ros/shared/data-access';
import { ROLE_APPS, ROLE_LABEL, STAFF_APP_LABEL, StaffApp } from '@ros/shared/domain';
import { STAFF_APP, STAFF_APP_URLS } from './staff-app';

const APP_ICON: Record<StaffApp, string> = { pos: 'pi-tablet', kitchen: 'pi-desktop', owner: 'pi-chart-bar', admin: 'pi-cog' };

/** Signed-in user chip for app headers: role, switch between permitted apps, sign out. */
@Component({
  selector: 'ros-user-menu',
  imports: [MatDivider, MatMenu, MatMenuItem, MatMenuTrigger],
  template: `
    @if (auth.user(); as u) {
      <button type="button" class="chip" [class.dark]="dark()" [matMenuTriggerFor]="menu" [attr.aria-label]="'Account: ' + u.name">
        <span class="avatar" aria-hidden="true">{{ initials() }}</span>
        <span class="who"><strong>{{ u.name }}</strong><small>{{ roleLabel[u.role] }}</small></span>
        <i class="pi pi-angle-down" aria-hidden="true"></i>
      </button>
      <mat-menu #menu="matMenu" xPosition="before">
        <div class="menu-head"><strong>{{ u.name }}</strong><small>{{ roleLabel[u.role] }} · {{ u.username }}</small></div>
        @if (otherApps().length) {
          <mat-divider />
          @for (a of otherApps(); track a) {
            <a mat-menu-item [href]="urls[a]"><i class="pi {{ appIcon[a] }} menu-icon" aria-hidden="true"></i> {{ appLabel[a] }}</a>
          }
        }
        <mat-divider />
        <button mat-menu-item type="button" (click)="auth.logout()"><i class="pi pi-sign-out menu-icon" aria-hidden="true"></i> Sign out</button>
      </mat-menu>
    }
  `,
  styles: `
    .chip { display: flex; align-items: center; gap: .55rem; padding: .25rem .6rem .25rem .25rem; border-radius: 99px; border: 1px solid var(--line); background: var(--card); color: var(--text); font: inherit; cursor: pointer; }
    .chip.dark { background: transparent; border-color: #2a3546; color: #f1f5f9; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--brand); color: #fff; font-weight: 700; font-size: .82rem; }
    .who { display: flex; flex-direction: column; line-height: 1.15; text-align: left; }
    .who strong { font-size: .86rem; } .who small { font-size: .72rem; opacity: .7; }
    @media (max-width: 640px) { .who { display: none; } }
    .menu-head { padding: .7rem 1rem; display: flex; flex-direction: column; }
    .menu-head small { color: var(--muted); }
    .menu-icon { margin-right: .6rem; color: var(--muted); }
  `,
})
export class UserMenu {
  /** Use on dark headers such as the kitchen display. */
  readonly dark = input(false);

  protected readonly auth = inject(AuthService);
  protected readonly urls = inject(STAFF_APP_URLS);
  private readonly app = inject(STAFF_APP);
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly appLabel = STAFF_APP_LABEL;
  protected readonly appIcon = APP_ICON;

  protected readonly initials = computed(() =>
    (this.auth.user()?.name ?? '').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase());
  protected readonly otherApps = computed(() => {
    const u = this.auth.user();
    return u ? ROLE_APPS[u.role].filter(a => a !== this.app) : [];
  });
}
