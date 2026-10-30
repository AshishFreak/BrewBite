import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStaffApp } from '@ros/shared/auth';
import { provideRestaurantApi } from '@ros/shared/data-access';
import { describe, expect, it } from 'vitest';
import { KitchenBoard } from './kitchen-board';

describe('KitchenBoard', () => {
  it('renders live tickets in station lanes', async () => {
    TestBed.configureTestingModule({ providers: [provideRestaurantApi(), provideStaffApp('kitchen'), provideRouter([])] });
    const fixture = TestBed.createComponent(KitchenBoard);

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Preparing');
    expect(el.querySelectorAll('article.ticket').length).toBeGreaterThan(0);
  });
});
