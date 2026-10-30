import { Component, computed, inject } from '@angular/core';
import { AuthService } from '@ros/shared/data-access';
import { homeApp, ROLE_LABEL, STAFF_APP_LABEL } from '@ros/shared/domain';
import { RosButton } from '@ros/shared/ui';
import { STAFF_APP, STAFF_APP_URLS } from './staff-app';

@Component({
  selector: 'ros-no-access-page',
  imports: [RosButton],
  template: `
    <main class="wrap">
      <div class="icon" aria-hidden="true"><i class="pi pi-lock"></i></div>
      <h1>You don't have access to {{ appLabel }}</h1>
      @if (auth.user(); as u) {
        <p>You're signed in as <strong>{{ u.name }}</strong> ({{ roleLabel[u.role] }}). Ask an admin if you need access.</p>
        <div class="actions">
          <a class="go" [href]="homeUrl()"><i class="pi pi-arrow-right" aria-hidden="true"></i> Go to {{ homeLabel() }}</a>
          <ros-button label="Sign out" severity="secondary" (pressed)="auth.logout()" />
        </div>
      }
    </main>
  `,
  styles: `
    .wrap { max-width: 520px; margin: 0 auto; padding: 5rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: .8rem; }
    .icon { width: 84px; height: 84px; border-radius: 24px; display: grid; place-items: center; font-size: 2.2rem; background: var(--brand-soft); color: var(--brand); }
    h1 { margin: .4rem 0 0; font-size: 1.5rem; }
    p { margin: 0; color: var(--muted); line-height: 1.5; }
    .actions { display: flex; gap: .8rem; margin-top: 1rem; flex-wrap: wrap; justify-content: center; }
    .go { display: inline-flex; gap: .5rem; align-items: center; padding: 0 1.2rem; height: 42px; border-radius: 10px; background: var(--brand); color: #fff; text-decoration: none; font-weight: 600; }
  `,
})
export class NoAccessPage {
  protected readonly auth = inject(AuthService);
  private readonly urls = inject(STAFF_APP_URLS);
  protected readonly appLabel = STAFF_APP_LABEL[inject(STAFF_APP)];
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly homeUrl = computed(() => {
    const u = this.auth.user();
    return u ? this.urls[homeApp(u.role)] : '/';
  });
  protected readonly homeLabel = computed(() => {
    const u = this.auth.user();
    return u ? STAFF_APP_LABEL[homeApp(u.role)] : '';
  });
}
