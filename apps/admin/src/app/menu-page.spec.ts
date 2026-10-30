import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStaffApp } from '@ros/shared/auth';
import { provideRestaurantApi } from '@ros/shared/data-access';
import { describe, expect, it } from 'vitest';
import { MenuPage } from './menu-page';

describe('MenuPage', () => {
  it('lists the whole menu with availability toggles', async () => {
    TestBed.configureTestingModule({ providers: [provideRestaurantApi(), provideStaffApp('admin'), provideRouter([])] });
    const fixture = TestBed.createComponent(MenuPage);

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tr.mat-mdc-row').length).toBe(28);
    expect(el.querySelectorAll('mat-slide-toggle').length).toBe(28);
  });
});
