import { describe, expect, it } from 'vitest';
import { Catalog, OrderItem } from './models';
import { computeBill, financialYear, priceSelection } from './pricing';

const catalog: Catalog = {
  categories: [{ id: 'coffee', name: 'Coffee', icon: '☕' }],
  modifierGroups: {
    milk: { id: 'milk', name: 'Milk', min: 1, max: 1, modifiers: [
      { id: 'milk-regular', name: 'Regular milk', price: 0 },
      { id: 'milk-oat', name: 'Oat milk', price: 60 },
    ] },
  },
  products: [{
    id: 'cappuccino', categoryId: 'coffee', name: 'Cappuccino', description: '', emoji: '☕', foodType: 'veg', station: 'Bar',
    prepMinutes: 4, modifierGroupIds: ['milk'],
    variants: [{ id: 'cap-r', name: 'Regular', price: 180 }, { id: 'cap-l', name: 'Large', price: 220 }],
  }],
};

const item = (lineTotal: number): OrderItem => ({
  id: 'i', productId: 'p', name: 'Item', variantName: '', emoji: '', foodType: 'veg', station: 'Bar',
  quantity: 1, unitPrice: lineTotal, modifiers: [], lineTotal,
});

describe('priceSelection', () => {
  it('adds variant and modifier prices and multiplies by quantity', () => {
    const r = priceSelection(catalog, { productId: 'cappuccino', variantId: 'cap-l', modifierIds: ['milk-oat'], quantity: 2 });
    expect(r.unitPrice).toBe(280);
    expect(r.lineTotal).toBe(560);
  });

  it('rejects a missing required modifier', () => {
    expect(() => priceSelection(catalog, { productId: 'cappuccino', variantId: 'cap-r', modifierIds: [], quantity: 1 }))
      .toThrow(/Milk/);
  });

  it('rejects two choices in a single-choice group', () => {
    expect(() => priceSelection(catalog, { productId: 'cappuccino', variantId: 'cap-r', modifierIds: ['milk-regular', 'milk-oat'], quantity: 1 }))
      .toThrow();
  });

  it('rejects quantities outside 1–20 and unknown products', () => {
    expect(() => priceSelection(catalog, { productId: 'cappuccino', variantId: 'cap-r', modifierIds: ['milk-regular'], quantity: 0 })).toThrow();
    expect(() => priceSelection(catalog, { productId: 'nope', variantId: 'x', modifierIds: [], quantity: 1 })).toThrow();
  });
});

describe('computeBill', () => {
  it('applies discount before 2.5% CGST + 2.5% SGST and rounds to the rupee', () => {
    const bill = computeBill([item(280), item(140)], 15);
    expect(bill.subTotal).toBe(420);
    expect(bill.discount).toBe(63);
    expect(bill.taxable).toBe(357);
    expect(bill.cgst).toBe(8.93);
    expect(bill.sgst).toBe(8.93);
    expect(bill.total).toBe(375);
    expect(bill.roundOff).toBe(0.14);
  });
});

describe('financialYear', () => {
  it('starts the Indian financial year in April', () => {
    expect(financialYear(new Date(2026, 2, 31).getTime())).toBe('25-26');
    expect(financialYear(new Date(2026, 3, 1).getTime())).toBe('26-27');
  });
});
