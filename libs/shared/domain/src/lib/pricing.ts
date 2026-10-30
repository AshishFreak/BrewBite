import { BillSummary, CartLine, Catalog, InvoiceLine, Modifier, OrderItem, Product } from './models';

/** Restaurant service GST: 5% split equally into CGST and SGST (intra-state). Confirm with a CA before production. */
export const CGST_RATE = 0.025;
export const SGST_RATE = 0.025;
export const MAX_UNAPPROVED_DISCOUNT_PCT = 10;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type SelectionInput = Pick<CartLine, 'productId' | 'variantId' | 'modifierIds' | 'quantity' | 'notes'>;

export function findProduct(catalog: Catalog, id: string): Product | undefined {
  return catalog.products.find(p => p.id === id);
}

export function defaultModifierIds(catalog: Pick<Catalog, 'modifierGroups'>, product: Product): string[] {
  return product.modifierGroupIds
    .map(id => catalog.modifierGroups[id])
    .filter(g => g.min > 0)
    .flatMap(g => g.modifiers.slice(0, g.min).map(m => m.id));
}

export function cartLineKey(productId: string, variantId: string, modifierIds: string[], notes = ''): string {
  return [productId, variantId, [...modifierIds].sort().join('+'), notes.trim().toLowerCase()].join('|');
}

/** Validates a selection against menu rules and returns a priced snapshot, or throws with a safe message. */
export function priceSelection(catalog: Catalog, line: SelectionInput) {
  const product = findProduct(catalog, line.productId);
  if (!product) throw new Error('This item is no longer on the menu.');
  const variant = product.variants.find(v => v.id === line.variantId);
  if (!variant) throw new Error(`Choose a valid option for ${product.name}.`);
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 20) {
    throw new Error(`Quantity for ${product.name} must be between 1 and 20.`);
  }

  const modifiers: Modifier[] = [];
  for (const groupId of product.modifierGroupIds) {
    const group = catalog.modifierGroups[groupId];
    const chosen = group.modifiers.filter(m => line.modifierIds.includes(m.id));
    if (chosen.length < group.min || chosen.length > group.max) {
      throw new Error(`${product.name}: choose ${group.min === group.max ? group.min : `up to ${group.max}`} for ${group.name}.`);
    }
    modifiers.push(...chosen);
  }
  const allowed = new Set(modifiers.map(m => m.id));
  if (line.modifierIds.some(id => !allowed.has(id))) throw new Error(`${product.name}: invalid add-on selected.`);

  const unitPrice = round2(variant.price + modifiers.reduce((s, m) => s + m.price, 0));
  return { product, variant, modifiers, unitPrice, lineTotal: round2(unitPrice * line.quantity) };
}

/** Short "Large · Oat milk" style summary of a cart selection, or null when it no longer prices. */
export function describeSelection(catalog: Catalog, line: SelectionInput): { name: string; emoji: string; detail: string } | null {
  try {
    const { product, variant, modifiers } = priceSelection(catalog, line);
    const detail = [product.variants.length > 1 ? variant.name : '', ...modifiers.map(m => m.name)].filter(Boolean).join(' · ');
    return { name: product.name, emoji: product.emoji, detail };
  } catch {
    return null;
  }
}

export function toOrderItem(catalog: Catalog, line: CartLine, id: string): OrderItem {
  const { product, variant, modifiers, unitPrice, lineTotal } = priceSelection(catalog, line);
  return {
    id,
    productId: product.id,
    name: product.name,
    variantName: product.variants.length > 1 ? variant.name : '',
    emoji: product.emoji,
    foodType: product.foodType,
    station: product.station,
    quantity: line.quantity,
    unitPrice,
    modifiers: modifiers.map(m => ({ modifierId: m.id, name: m.name, price: m.price })),
    lineTotal,
    notes: line.notes?.trim() || undefined,
  };
}

export function describeItem(item: Pick<OrderItem, 'variantName' | 'modifiers'>): string {
  return [item.variantName, ...item.modifiers.map(m => m.name)].filter(Boolean).join(' · ');
}

export function computeBill(items: OrderItem[], discountPct: number): BillSummary {
  const grouped = new Map<string, InvoiceLine>();
  for (const item of items) {
    const detail = describeItem(item);
    const description = detail ? `${item.name} (${detail})` : item.name;
    const key = `${description}|${item.unitPrice}`;
    const line = grouped.get(key) ?? { description, quantity: 0, amount: 0 };
    line.quantity += item.quantity;
    line.amount = round2(line.amount + item.lineTotal);
    grouped.set(key, line);
  }

  const subTotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const discount = round2((subTotal * discountPct) / 100);
  const taxable = round2(subTotal - discount);
  const cgst = round2(taxable * CGST_RATE);
  const sgst = round2(taxable * SGST_RATE);
  const raw = taxable + cgst + sgst;
  const total = Math.round(raw);
  return {
    lines: [...grouped.values()],
    subTotal, discountPct, discount, taxable, cgst, sgst,
    roundOff: round2(total - raw),
    total,
  };
}

export function financialYear(at: number): string {
  const d = new Date(at);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}
