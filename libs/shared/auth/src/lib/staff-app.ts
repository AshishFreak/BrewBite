import { DOCUMENT, effect, EnvironmentProviders, inject, InjectionToken, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService, provideAuth } from '@ros/shared/data-access';
import { homeApp, StaffApp } from '@ros/shared/domain';

/** Which staff app is running (set once per app via `provideStaffApp`). */
export const STAFF_APP = new InjectionToken<StaffApp>('STAFF_APP');

/**
 * Where each staff app lives. Defaults assume sibling folders next to this app (`/pos/`, `/kitchen/`…),
 * resolved against the base href so they work under the dev gateway and a sub-path such as GitHub Pages.
 */
export const STAFF_APP_URLS = new InjectionToken<Record<StaffApp, string>>('STAFF_APP_URLS', {
  factory: () => {
    const base = inject(DOCUMENT).baseURI;
    const sibling = (app: StaffApp) => new URL(`../${app}/`, base).pathname;
    return { pos: sibling('pos'), kitchen: sibling('kitchen'), owner: sibling('owner'), admin: sibling('admin') };
  },
});

/** Sends people who are signed out to the sign-in page, and roles without access to the no-access page. */
export const staffAppGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.user()) return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  return auth.canOpen(inject(STAFF_APP)) ? true : router.createUrlTree(['/no-access']);
};

/** Wraps an app's routes with sign-in, no-access and the access guard. */
export function staffRoutes(children: Routes): Routes {
  return [
    { path: 'login', title: 'Sign in', loadComponent: () => import('./login-page').then(m => m.LoginPage) },
    { path: 'no-access', title: 'No access', loadComponent: () => import('./no-access-page').then(m => m.NoAccessPage) },
    { path: '', canActivate: [staffAppGuard], canActivateChild: [staffAppGuard], children },
  ];
}

export function provideStaffApp(app: StaffApp): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAuth(),
    { provide: STAFF_APP, useValue: app },
    // Signing out (here or in another tab) returns this app to its sign-in page. Startup is left to the guard.
    provideEnvironmentInitializer(() => {
      const auth = inject(AuthService);
      const router = inject(Router);
      let wasSignedIn = auth.signedIn();
      effect(() => {
        const signedIn = auth.signedIn();
        if (wasSignedIn && !signedIn && !router.url.startsWith('/login')) void router.navigate(['/login']);
        wasSignedIn = signedIn;
      });
    }),
  ]);
}

/** Absolute or gateway URL of the app a signed-in role should land in. */
export function homeUrl(urls: Record<StaffApp, string>, role: Parameters<typeof homeApp>[0]): string {
  return urls[homeApp(role)];
}
