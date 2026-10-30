import { Component, inject, isDevMode, signal } from '@angular/core';
import { MatFormField, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService, DEMO_ACCOUNTS, RestaurantApi } from '@ros/shared/data-access';
import { canOpenApp, homeApp, ROLE_LABEL, STAFF_APP_LABEL, StaffUser } from '@ros/shared/domain';
import { RosButton } from '@ros/shared/ui';
import { STAFF_APP, STAFF_APP_URLS } from './staff-app';

@Component({
  selector: 'ros-login-page',
  imports: [MatFormField, MatInput, MatLabel, MatSuffix, RosButton],
  template: `
    <main class="login">
      <section class="brand" aria-hidden="true">
        <span class="logo">☕</span>
        <h2>{{ api.cafe().name }}</h2>
        <p>{{ api.cafe().tagline }}</p>
        <ul>
          <li><i class="pi pi-tablet"></i> POS & billing</li>
          <li><i class="pi pi-desktop"></i> Kitchen display</li>
          <li><i class="pi pi-chart-bar"></i> Owner dashboard</li>
          <li><i class="pi pi-cog"></i> Admin</li>
        </ul>
      </section>

      <section class="panel">
        <span class="eyebrow">{{ appLabel }}</span>
        <h1>Staff sign in</h1>
        <p class="muted">Sign in with your staff account. You'll be taken to the screens your role can use.</p>

        <form (submit)="submit($event)" novalidate>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Username</mat-label>
            <input matInput name="username" autocomplete="username" required [value]="username()" (input)="username.set($any($event.target).value)" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Password</mat-label>
            <input matInput name="password" autocomplete="current-password" required [type]="showPassword() ? 'text' : 'password'"
                   [value]="password()" (input)="password.set($any($event.target).value)" />
            <button matSuffix type="button" class="eye" [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                    (click)="showPassword.set(!showPassword())">
              <i class="pi" [class.pi-eye]="!showPassword()" [class.pi-eye-slash]="showPassword()" aria-hidden="true"></i>
            </button>
          </mat-form-field>
          @if (error()) { <p class="error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> {{ error() }}</p> }
          <ros-button type="submit" label="Sign in" size="large" fluid [loading]="busy()" [disabled]="!username() || !password()" />
        </form>

        @if (devMode) {
          <div class="demo">
            <h2>Demo accounts <small>password <code>demo123</code></small></h2>
            <div class="accounts">
              @for (a of accounts; track a.id) {
                <button type="button" class="account" (click)="useAccount(a)">
                  <strong>{{ roleLabel[a.role] }}</strong><span>{{ a.username }}</span>
                </button>
              }
            </div>
          </div>
        }
      </section>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100dvh; background: var(--bg); }
    .login { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); max-width: 1040px; margin: 0 auto; padding: 1.5rem; gap: 1.5rem; align-items: center; }
    @media (max-width: 820px) { .login { grid-template-columns: 1fr; } .brand { display: none; } }
    .brand { align-self: stretch; border-radius: 28px; padding: 2.5rem; background: var(--brand); color: #fff; display: flex; flex-direction: column; justify-content: center; gap: .6rem; min-height: 520px; }
    .brand .logo { width: 72px; height: 72px; border-radius: 22px; display: grid; place-items: center; font-size: 2.2rem; background: rgb(255 255 255 / .18); }
    .brand h2 { margin: .8rem 0 0; font-size: 2rem; }
    .brand p { margin: 0; opacity: .85; }
    .brand ul { list-style: none; padding: 0; margin: 1.6rem 0 0; display: grid; gap: .8rem; font-weight: 500; }
    .brand li { display: flex; gap: .7rem; align-items: center; }
    .brand li i { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: rgb(255 255 255 / .16); }
    .panel { background: var(--card); border-radius: 28px; padding: 2.2rem; box-shadow: var(--shadow); }
    .eyebrow { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--brand); }
    h1 { margin: .3rem 0 .3rem; font-size: 1.8rem; }
    .muted { color: var(--muted); margin: 0 0 1.4rem; line-height: 1.5; }
    form { display: flex; flex-direction: column; gap: 1rem; }
    .eye { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 .8rem; font-size: 1rem; }
    .error { margin: 0; color: #b91c1c; display: flex; gap: .4rem; align-items: center; font-size: .92rem; }
    .demo { margin-top: 1.8rem; padding-top: 1.2rem; border-top: 1px dashed var(--line); }
    .demo h2 { margin: 0 0 .7rem; font-size: .82rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); display: flex; justify-content: space-between; }
    .demo small { text-transform: none; letter-spacing: 0; }
    .accounts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .5rem; }
    .account { display: flex; flex-direction: column; align-items: flex-start; gap: .1rem; padding: .6rem .7rem; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font: inherit; cursor: pointer; text-align: left; }
    .account:hover { border-color: var(--brand); }
    .account span { color: var(--muted); font-size: .8rem; }
  `,
})
export class LoginPage {
  protected readonly api = inject(RestaurantApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly app = inject(STAFF_APP);
  private readonly urls = inject(STAFF_APP_URLS);

  protected readonly appLabel = STAFF_APP_LABEL[this.app];
  protected readonly roleLabel = ROLE_LABEL;
  protected readonly accounts = DEMO_ACCOUNTS;
  protected readonly devMode = isDevMode();
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected useAccount(account: StaffUser): void {
    this.username.set(account.username);
    this.password.set('demo123');
    void this.signIn();
  }

  protected submit(event: Event): void {
    event.preventDefault();
    void this.signIn();
  }

  private async signIn(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const user = await this.auth.login(this.username(), this.password());
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (canOpenApp(user.role, this.app) && (returnUrl || homeApp(user.role) === this.app)) {
        await this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/');
      } else {
        // Land in the role's own app, which may be a different app.
        window.location.assign(this.urls[homeApp(user.role)]);
      }
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
