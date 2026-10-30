import { beforeEach, describe, expect, it } from 'vitest';
import { CartLine } from '@ros/shared/domain';
import { DummyRestaurantApi } from './dummy-restaurant-api';

const croissant: CartLine = { key: 'k', productId: 'croissant', variantId: 'croissant-std', modifierIds: [], quantity: 2 };

describe('DummyRestaurantApi business rules', () => {
  let api: DummyRestaurantApi;

  beforeEach(() => {
    localStorage.clear();
    api = new DummyRestaurantApi();
    api.resetData();
  });

  it('prices orders on the "server" and never duplicates a retried submit', async () => {
    await api.openTable('t5', 2);
    const request = { idempotencyKey: 'retry-1', tableId: 't5', source: 'POS' as const, lines: [croissant] };
    const first = await api.submitOrder(request);
    const retry = await api.submitOrder(request);
    expect(retry.id).toBe(first.id);
    expect(first.subTotal).toBe(280);
    expect(api.orders().filter(o => o.idempotencyKey === 'retry-1')).toHaveLength(1);
    expect(api.tickets().filter(t => t.orderId === first.id)).toHaveLength(1);
  });

  it('allows only one active session per table', async () => {
    await api.openTable('t5', 2);
    await expect(api.openTable('t5', 4)).rejects.toThrow(/already has an open session/);
  });

  it('rejects sold-out items', async () => {
    await api.openTable('t5', 2);
    const tiramisu: CartLine = { key: 't', productId: 'tiramisu', variantId: 'tiramisu-std', modifierIds: [], quantity: 1 };
    await expect(api.submitOrder({ idempotencyKey: 'x', tableId: 't5', source: 'POS', lines: [tiramisu] })).rejects.toThrow(/sold out/);
  });

  it('requires approval above 10% discount and keeps the invoice number on re-issue', async () => {
    const session = await api.openTable('t5', 2);
    await api.submitOrder({ idempotencyKey: 'o1', tableId: 't5', source: 'POS', lines: [croissant] });
    await expect(api.checkout(session.id, 15)).rejects.toThrow(/manager approval/);
    const first = await api.checkout(session.id, 15, 'manager');
    const reissued = await api.checkout(session.id, 0);
    expect(reissued.invoiceNo).toBe(first.invoiceNo);
    expect(reissued.total).toBe(294); // 280 + 5% GST
  });

  it('closes the session and frees the table for cleaning once fully paid', async () => {
    const session = await api.openTable('t5', 2);
    await api.submitOrder({ idempotencyKey: 'o2', tableId: 't5', source: 'POS', lines: [croissant] });
    const invoice = await api.checkout(session.id, 0);
    await expect(api.recordPayment(invoice.id, 'Cash', invoice.total + 1)).rejects.toThrow(/at most/);
    await api.recordPayment(invoice.id, 'Cash', 100);
    const paid = await api.recordPayment(invoice.id, 'UPI', invoice.total - 100);
    expect(paid.status).toBe('Paid');
    expect(api.sessions().find(s => s.id === session.id)?.status).toBe('Closed');
    expect(api.tables().find(t => t.id === 't5')?.status).toBe('Cleaning');
  });

  it('charges guest orders when placed and never charges twice for a retry', async () => {
    const { session } = await api.joinTable('t5');
    const request = { idempotencyKey: 'pay-1', tableId: 't5', source: 'QR' as const, guestLabel: 'Guest 1', lines: [croissant] };
    const first = await api.placePaidOrder(request, 'UPI');
    const retry = await api.placePaidOrder(request, 'UPI');
    expect(retry.invoice.id).toBe(first.invoice.id);
    expect(first.invoice).toMatchObject({ kind: 'Order', status: 'Paid', total: 294, orderIds: [first.order.id] });
    expect(api.invoices().filter(i => i.orderIds.includes(first.order.id))).toHaveLength(1);
    expect(api.tickets().some(t => t.orderId === first.order.id)).toBe(true);
    expect(api.sessions().find(x => x.id === session.id)?.status).toBe('Open');
  });

  it('bills only pay-later orders and closes a fully prepaid table without a bill', async () => {
    const { session } = await api.joinTable('t5');
    await api.placePaidOrder({ idempotencyKey: 'p1', tableId: 't5', source: 'QR', lines: [croissant] }, 'Card');
    await expect(api.checkout(session.id, 0)).rejects.toThrow(/already paid/);

    const staffOrder = await api.submitOrder({ idempotencyKey: 'pos-1', tableId: 't5', source: 'POS', lines: [{ ...croissant, quantity: 1 }] });
    await expect(api.closeTable(session.id)).rejects.toThrow(/unpaid/);
    const bill = await api.checkout(session.id, 0);
    expect(bill.orderIds).toEqual([staffOrder.id]);
    expect(bill.subTotal).toBe(140);
    await api.recordPayment(bill.id, 'Cash', bill.total);
    expect(api.tables().find(t => t.id === 't5')?.status).toBe('Cleaning');
  });

  it('lets guests call staff with a reason before ordering', async () => {
    const { session } = await api.joinTable('t5');
    await api.callWaiter(session.id, 'Water');
    expect(api.sessions().find(x => x.id === session.id)).toMatchObject({ waiterReason: 'Water' });
    await api.acknowledgeWaiter(session.id);
    expect(api.sessions().find(x => x.id === session.id)?.waiterCalledAt).toBeUndefined();
  });

  it('closes a prepaid-only table on request', async () => {
    const { session } = await api.joinTable('t5');
    await api.placePaidOrder({ idempotencyKey: 'p2', tableId: 't5', source: 'QR', lines: [croissant] }, 'UPI');
    await api.closeTable(session.id);
    expect(api.sessions().find(x => x.id === session.id)?.status).toBe('Closed');
    expect(api.tables().find(t => t.id === 't5')?.status).toBe('Cleaning');
  });
});

describe('DummyRestaurantApi menu management', () => {
  let api: DummyRestaurantApi;

  beforeEach(() => {
    localStorage.clear();
    api = new DummyRestaurantApi();
    api.resetData();
  });

  it('adds, edits and deletes menu items without touching past orders', async () => {
    const pastOrders = api.orders().length;
    const created = await api.saveProduct({
      id: '', categoryId: 'coffee', name: 'Hazelnut Latte', description: 'Nutty and smooth.', emoji: '☕', foodType: 'veg',
      station: 'Bar', prepMinutes: 4, modifierGroupIds: ['milk'], variants: [{ id: '', name: 'Regular', price: 230 }],
    });
    expect(created.id).toMatch(/^hazelnut-latte-/);
    expect(api.catalog().products.some(p => p.id === created.id)).toBe(true);

    await api.saveProduct({ ...created, variants: [{ ...created.variants[0], price: 250 }] });
    expect(api.catalog().products.find(p => p.id === created.id)?.variants[0].price).toBe(250);

    await api.deleteProduct(created.id);
    expect(api.catalog().products.some(p => p.id === created.id)).toBe(false);
    expect(api.orders()).toHaveLength(pastOrders);
  });

  it('rejects invalid items and refuses to delete categories that still have items', async () => {
    await expect(api.saveProduct({
      id: '', categoryId: 'coffee', name: '', description: '', emoji: '', foodType: 'veg', station: 'Bar', prepMinutes: 4,
      modifierGroupIds: [], variants: [],
    })).rejects.toThrow(/name is required/);
    await expect(api.deleteCategory('coffee')).rejects.toThrow(/Move or delete/);
    const empty = await api.saveCategory({ id: '', name: 'Specials', icon: '⭐' });
    await api.deleteCategory(empty.id);
    expect(api.catalog().categories.some(c => c.id === empty.id)).toBe(false);
  });
});
