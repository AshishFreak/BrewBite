import { Route } from '@angular/router';
import { staffRoutes } from '@ros/shared/auth';

/** Every screen requires a signed-in staff role that may open this app. */
export const appRoutes: Route[] = [
  ...staffRoutes([
    { path: '', loadComponent: () => import('./admin-shell').then(m => m.AdminShell), children: [
      { path: '', pathMatch: 'full', redirectTo: 'menu' },
      { path: 'menu', title: 'Admin · Menu', loadComponent: () => import('./menu-page').then(m => m.MenuPage) },
      { path: 'tables', title: 'Admin · Tables & QR', loadComponent: () => import('./tables-page').then(m => m.TablesPage) },
    ] },
  ]),
  { path: '**', redirectTo: '' },
];
