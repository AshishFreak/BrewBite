import { beforeEach, describe, expect, it } from 'vitest';
import { DummyAuthService } from './auth';

describe('DummyAuthService', () => {
  beforeEach(() => localStorage.clear());

  it('signs in demo staff, exposes role permissions and signs out', async () => {
    const auth = new DummyAuthService();
    const user = await auth.login('Cashier', 'demo123');
    expect(user.role).toBe('cashier');
    expect(auth.can('billing.checkout')).toBe(true);
    expect(auth.can('menu.manage')).toBe(false);
    expect(auth.canOpen('pos')).toBe(true);
    expect(auth.canOpen('admin')).toBe(false);
    expect(new DummyAuthService().user()?.username).toBe('cashier');
    auth.logout();
    expect(auth.user()).toBeNull();
  });

  it('rejects wrong passwords and unknown users', async () => {
    const auth = new DummyAuthService();
    await expect(auth.login('owner', 'wrong')).rejects.toThrow(/Incorrect/);
    await expect(auth.login('nobody', 'demo123')).rejects.toThrow(/Incorrect/);
    expect(auth.user()).toBeNull();
  });
});
