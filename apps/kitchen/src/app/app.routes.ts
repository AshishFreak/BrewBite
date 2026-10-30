import { Route } from '@angular/router';
import { staffRoutes } from '@ros/shared/auth';

/** Every screen requires a signed-in staff role that may open this app. */
export const appRoutes: Route[] = [
  ...staffRoutes([
    { path: '', title: 'Kitchen display', loadComponent: () => import('./kitchen-board').then(m => m.KitchenBoard) },
  ]),
  { path: '**', redirectTo: '' },
];
