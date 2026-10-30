import { describe, expect, it } from 'vitest';
import { canOpenApp, hasPermission, homeApp } from './access';

describe('role access', () => {
  it('lands each role in its own app', () => {
    expect(homeApp('owner')).toBe('owner');
    expect(homeApp('admin')).toBe('admin');
    expect(homeApp('cashier')).toBe('pos');
    expect(homeApp('waiter')).toBe('pos');
    expect(homeApp('kitchen')).toBe('kitchen');
  });

  it('keeps roles out of apps they should not open', () => {
    expect(canOpenApp('waiter', 'admin')).toBe(false);
    expect(canOpenApp('kitchen', 'pos')).toBe(false);
    expect(canOpenApp('manager', 'owner')).toBe(false);
    expect(canOpenApp('owner', 'kitchen')).toBe(true);
  });

  it('lets cashiers take payment but only managers and above approve big discounts', () => {
    expect(hasPermission('waiter', 'billing.checkout')).toBe(false);
    expect(hasPermission('cashier', 'billing.checkout')).toBe(true);
    expect(hasPermission('cashier', 'billing.discount.approve')).toBe(false);
    expect(hasPermission('manager', 'billing.discount.approve')).toBe(true);
    expect(hasPermission('manager', 'menu.manage')).toBe(false);
    expect(hasPermission('admin', 'menu.manage')).toBe(true);
  });
});
