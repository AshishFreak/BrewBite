import { beforeEach, describe, expect, it } from 'vitest';
import { DummyCustomerAuth } from './customer-auth';

describe('DummyCustomerAuth (mobile + OTP)', () => {
  beforeEach(() => localStorage.clear());

  it('signs a diner in with the right code and remembers them', async () => {
    const auth = new DummyCustomerAuth();
    const challenge = await auth.requestOtp('+91 98765 43210', { name: 'Priya', marketingOptIn: false });
    expect(challenge.phone).toBe('9876543210');
    expect(challenge.devCode).toMatch(/^\d{6}$/);
    const customer = await auth.verifyOtp(challenge.id, challenge.devCode!);
    expect(customer).toMatchObject({ phone: '9876543210', name: 'Priya' });
    expect(new DummyCustomerAuth().customer()?.phone).toBe('9876543210');
    auth.signOut();
    expect(auth.customer()).toBeNull();
  });

  it('rejects invalid numbers, wrong codes and quick re-sends', async () => {
    const auth = new DummyCustomerAuth();
    await expect(auth.requestOtp('12345', { marketingOptIn: false })).rejects.toThrow(/valid 10-digit/);
    const challenge = await auth.requestOtp('9876543210', { marketingOptIn: false });
    const wrong = challenge.devCode === '000000' ? '111111' : '000000';
    await expect(auth.verifyOtp(challenge.id, wrong)).rejects.toThrow(/4 attempts left/);
    await expect(auth.requestOtp('9876543210', { marketingOptIn: false })).rejects.toThrow(/Please wait/);
    expect(auth.customer()).toBeNull();
  });

  it('locks the code after five wrong attempts', async () => {
    const auth = new DummyCustomerAuth();
    const challenge = await auth.requestOtp('9876543210', { marketingOptIn: false });
    const wrong = challenge.devCode === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await auth.verifyOtp(challenge.id, wrong).catch(() => undefined);
    await expect(auth.verifyOtp(challenge.id, challenge.devCode!)).rejects.toThrow(/Too many attempts/);
  });
});
