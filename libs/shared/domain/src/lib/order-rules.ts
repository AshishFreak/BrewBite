import { Invoice, KitchenTicket, Order, OrderStatus, TableSession } from './models';

export const isActiveSession = (s: TableSession) => s.status !== 'Closed';

/** Order status follows its kitchen tickets until staff mark it served. */
export function deriveOrderStatus(current: OrderStatus, tickets: KitchenTicket[]): OrderStatus {
  if (current === 'Served' || current === 'Cancelled') return current;
  if (tickets.length > 0 && tickets.every(t => t.status === 'Ready')) return 'Ready';
  if (tickets.some(t => t.status !== 'Queued')) return 'Preparing';
  return 'Submitted';
}

export const ORDER_STEPS: OrderStatus[] = ['Submitted', 'Preparing', 'Ready', 'Served'];

/** Orders covered by an invoice (prepaid guest orders or an issued table bill). */
export function billedOrderIds(invoices: Invoice[]): Set<string> {
  return new Set(invoices.flatMap(i => i.orderIds));
}

/** Orders covered by a fully paid invoice. */
export function paidOrderIds(invoices: Invoice[]): Set<string> {
  return new Set(invoices.filter(i => i.status === 'Paid').flatMap(i => i.orderIds));
}

/** Non-cancelled orders of a session that no prepaid order invoice covers; these go on the table bill. */
export function ordersForTableBill(orders: Order[], invoices: Invoice[], sessionId: string): Order[] {
  const prepaid = new Set(invoices.filter(i => i.kind === 'Order').flatMap(i => i.orderIds));
  return orders.filter(o => o.sessionId === sessionId && o.status !== 'Cancelled' && !prepaid.has(o.id));
}
