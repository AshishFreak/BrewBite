import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '@ros/shared/data-access';
import { beforeEach, describe, expect, it } from 'vitest';
import { provideStaffApp, staffAppGuard } from './staff-app';

const runGuard = (url: string) =>
  TestBed.runInInjectionContext(() => staffAppGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

describe('staffAppGuard (admin app)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideStaffApp('admin')] });
  });

  it('sends signed-out visitors to sign in and remembers where they were going', () => {
    const result = runGuard('/menu') as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fmenu');
  });

  it('blocks roles that may not open the app', async () => {
    await TestBed.inject(AuthService).login('waiter', 'demo123');
    expect(TestBed.inject(Router).serializeUrl(runGuard('/menu') as UrlTree)).toBe('/no-access');
  });

  it('lets permitted roles through', async () => {
    await TestBed.inject(AuthService).login('admin', 'demo123');
    expect(runGuard('/menu')).toBe(true);
  });
});
