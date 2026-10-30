import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideStaffApp } from '@ros/shared/auth';
import { provideRestaurantApi } from '@ros/shared/data-access';
import { describe, expect, it } from 'vitest';
import { PosFloor } from './pos-floor';

describe('PosFloor', () => {
  it('shows every table on the floor plan', async () => {
    TestBed.configureTestingModule({ providers: [provideRestaurantApi(), provideStaffApp('pos'), provideRouter([])] });
    const fixture = TestBed.createComponent(PosFloor);

    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('button.tile').length).toBe(12);
  });
});
