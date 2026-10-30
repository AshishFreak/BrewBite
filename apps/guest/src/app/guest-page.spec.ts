import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CustomerAuth, provideCustomerAuth, provideRestaurantApi } from '@ros/shared/data-access';
import { describe, expect, it } from 'vitest';
import { GuestPage } from './guest-page';

const setup = () => {
  TestBed.configureTestingModule({ providers: [provideRestaurantApi(), provideCustomerAuth(), provideRouter([])] });
  const fixture = TestBed.createComponent(GuestPage);
  fixture.componentRef.setInput('tableCode', 'T3');
  return fixture;
};

describe('GuestPage', () => {
  it('asks a new diner to sign in with their mobile number first', async () => {
    const fixture = setup();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Table T3');
    expect(el.textContent).toContain('Sign in to order');
    expect(el.textContent).not.toContain('Cappuccino');
  });

  it('shows the menu once the diner has verified their number', async () => {
    const fixture = setup();
    const auth = TestBed.inject(CustomerAuth);
    const challenge = await auth.requestOtp('9876543210', { name: 'Priya', marketingOptIn: false });
    await auth.verifyOtp(challenge.id, challenge.devCode ?? '');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Hi Priya');
    expect(el.textContent).toContain('Cappuccino');
  });
});
