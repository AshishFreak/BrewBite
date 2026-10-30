import { Route } from '@angular/router';
import { staffRoutes } from '@ros/shared/auth';

/** Every screen requires a signed-in staff role that may open this app. */
export const appRoutes: Route[] = [
  ...staffRoutes([
    { path: '', title: 'Owner dashboard', loadComponent: () => import('./owner-dashboard').then(m => m.OwnerDashboard) },
  ]),
  { path: '**', redirectTo: '' },
];
