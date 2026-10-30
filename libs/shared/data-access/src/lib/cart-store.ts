import { computed, signal } from '@angular/core';
import { CartLine, cartLineKey, Catalog, priceSelection } from '@ros/shared/domain';

/** Local cart for one table/device. Totals shown here are estimates; the server prices the order. */
export class CartStore {
  readonly lines = signal<CartLine[]>([]);
  readonly count = computed(() => this.lines().reduce((n, l) => n + l.quantity, 0));
  readonly subTotal = computed(() => this.lines().reduce((sum, l) => sum + this.lineTotal(l), 0));

  constructor(private readonly storageKey: string, private readonly catalog: () => Catalog) {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) this.lines.set(JSON.parse(raw));
    } catch {
      // A fresh cart is fine.
    }
  }

  add(line: Omit<CartLine, 'key'>): void {
    const key = cartLineKey(line.productId, line.variantId, line.modifierIds, line.notes);
    const existing = this.lines().find(l => l.key === key);
    this.update(existing
      ? this.lines().map(l => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + line.quantity) } : l))
      : [...this.lines(), { ...line, key }]);
  }

  setQuantity(key: string, quantity: number): void {
    this.update(quantity <= 0
      ? this.lines().filter(l => l.key !== key)
      : this.lines().map(l => (l.key === key ? { ...l, quantity: Math.min(20, quantity) } : l)));
  }

  clear(): void {
    this.update([]);
  }

  lineTotal(line: CartLine): number {
    try {
      return priceSelection(this.catalog(), line).lineTotal;
    } catch {
      return 0;
    }
  }

  private update(lines: CartLine[]): void {
    this.lines.set(lines);
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(lines));
    } catch {
      // Ignore storage failures.
    }
  }
}
