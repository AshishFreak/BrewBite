import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  { path: 't/:tableCode', title: 'Order', loadComponent: () => import('./guest-page').then(m => m.GuestPage) },
  { path: '', title: 'Scan to order', loadComponent: () => import('./scan-prompt').then(m => m.ScanPrompt) },
  { path: '**', redirectTo: '' },
];
