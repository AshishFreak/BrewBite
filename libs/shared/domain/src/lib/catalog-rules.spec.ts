import { describe, expect, it } from 'vitest';
import { validateCategory, validateProduct } from './catalog-rules';
import { Catalog, Product } from './models';

const catalog: Catalog = {
  categories: [{ id: 'coffee', name: 'Coffee', icon: '☕' }],
  modifierGroups: {},
  products: [{
    id: 'latte', categoryId: 'coffee', name: 'Latte', description: '', emoji: '☕', foodType: 'veg', station: 'Bar', prepMinutes: 4,
    modifierGroupIds: [], variants: [{ id: 'l', name: 'Regular', price: 190 }],
  }],
};

const draft = (over: Partial<Product> = {}): Product => ({
  id: '', categoryId: 'coffee', name: 'Mocha', description: '', emoji: '🍫', foodType: 'veg', station: 'Bar', prepMinutes: 4,
  modifierGroupIds: [], variants: [{ id: '', name: 'Regular', price: 220 }], ...over,
});

describe('menu validation', () => {
  it('accepts a complete item', () => {
    expect(validateProduct(draft(), catalog)).toEqual([]);
  });

  it('rejects missing names, prices, categories and duplicate items', () => {
    expect(validateProduct(draft({ name: ' ' }), catalog)).toContain('Item name is required.');
    expect(validateProduct(draft({ variants: [{ id: '', name: 'Regular', price: 0 }] }), catalog).join()).toMatch(/Price/);
    expect(validateProduct(draft({ categoryId: 'nope' }), catalog)).toContain('Choose a category.');
    expect(validateProduct(draft({ name: 'latte' }), catalog).join()).toMatch(/already exists/);
    expect(validateProduct(draft({ variants: [] }), catalog)).toContain('Add at least one size or price.');
  });

  it('allows saving an item under its own name but not duplicating a category', () => {
    expect(validateProduct({ ...catalog.products[0], description: 'New' }, catalog)).toEqual([]);
    expect(validateCategory({ id: '', name: 'coffee', icon: '☕' }, catalog).join()).toMatch(/already exists/);
  });
});
