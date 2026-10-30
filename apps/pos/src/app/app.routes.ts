import { Route } from '@angular/router';
import { staffRoutes } from '@ros/shared/auth';

/** Every screen requires a signed-in staff role that may open this app. */
export const appRoutes: Route[] = [
  ...staffRoutes([
    { path: '', title: 'POS · Floor', loadComponent: () => import('./pos-floor').then(m => m.PosFloor) },
    { path: 'table/:tableId', title: 'POS · Table', loadComponent: () => import('./pos-table').then(m => m.PosTable) },
  ]),
  { path: '**', redirectTo: '' },
];
