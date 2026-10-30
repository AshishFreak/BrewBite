import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStaffApp } from '@ros/shared/auth';
import { provideRestaurantApi } from '@ros/shared/data-access';
import { describe, expect, it } from 'vitest';
import { OwnerDashboard } from './owner-dashboard';

describe('OwnerDashboard', () => {
  it('summarises net sales for today', async () => {
    TestBed.configureTestingModule({ providers: [provideRestaurantApi(), provideStaffApp('owner'), provideRouter([])] });
    const fixture = TestBed.createComponent(OwnerDashboard);

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Net sales');
    expect(el.textContent).toContain('Payment mix');
  });
});
