import {
  Catalog,
  computeBill, DiningTable, financialYear, Invoice, KitchenTicket, newId, Order, OrderItem, OrderSource, PaymentMethod,
  round2, Station, TableSession, TicketStatus, cartLineKey, defaultModifierIds, deriveOrderStatus, toOrderItem,
} from '@ros/shared/domain';
import { DUMMY_CAFE, DUMMY_CATALOG, DUMMY_TABLES } from './dummy-catalog';

const catalog = DUMMY_CATALOG;

/** Everything the dummy backend stores; mirrors the tables the real API will own. */
export interface DemoState {
  schema: number;
  seededAt: number;
  tables: DiningTable[];
  sessions: TableSession[];
  orders: Order[];
  tickets: KitchenTicket[];
  invoices: Invoice[];
  soldOut: string[];
  catalog: Catalog;
  counters: { order: number; invoice: number };
}


export const DEMO_SCHEMA = 3;
const MIN = 60_000;

export function invoiceNumber(seq: number, at: number): string {
  return `${DUMMY_CAFE.invoicePrefix}/${financialYear(at)}/${String(seq).padStart(5, '0')}`;
}

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const groupOf = (modifierId: string) =>
  Object.values(catalog.modifierGroups).find(g => g.modifiers.some(m => m.id === modifierId))?.id;

/** Builds a realistic café day: settled bills earlier today plus a few live tables. */
export function createSeedState(now = Date.now()): DemoState {
  const rand = mulberry32(20261029);
  const pick = <T>(items: T[]) => items[Math.floor(rand() * items.length)];

  const state: DemoState = {
    schema: DEMO_SCHEMA,
    seededAt: now,
    tables: DUMMY_TABLES.map(t => ({ ...t })),
    sessions: [],
    orders: [],
    tickets: [],
    invoices: [],
    soldOut: ['tiramisu'],
    catalog: structuredClone(DUMMY_CATALOG),
    counters: { order: 101, invoice: 1 },
  };
  const table = (code: string) => state.tables.find(t => t.code === code)!;

  const item = (productId: string, quantity = 1, variantIndex = 0, extras: string[] = [], notes?: string): OrderItem => {
    const product = catalog.products.find(p => p.id === productId)!;
    const variantId = product.variants[Math.min(variantIndex, product.variants.length - 1)].id;
    const defaults = defaultModifierIds(catalog, product).filter(d => !extras.some(e => groupOf(e) === groupOf(d)));
    const modifierIds = [...defaults, ...extras];
    return toOrderItem(catalog, { key: cartLineKey(productId, variantId, modifierIds), productId, variantId, modifierIds, quantity, notes }, newId());
  };

  const openSession = (t: DiningTable, openedAt: number, guestCount: number, closedAt?: number): TableSession => {
    const session: TableSession = {
      id: newId(), tableId: t.id, status: closedAt ? 'Closed' : 'Open', guestCount, guestJoins: 0, openedAt, closedAt,
    };
    state.sessions.push(session);
    return session;
  };

  const addOrder = (
    t: DiningTable, session: TableSession, source: OrderSource, createdAt: number, items: OrderItem[],
    ticketStatus: (station: Station) => TicketStatus, served = false, guestLabel?: string,
  ): Order => {
    const order: Order = {
      id: newId(), number: state.counters.order++, tableId: t.id, sessionId: session.id, source, guestLabel,
      status: 'Submitted', items, subTotal: round2(items.reduce((s, i) => s + i.lineTotal, 0)), createdAt,
    };
    const tickets: KitchenTicket[] = [...new Set(items.map(i => i.station))].map(station => {
      const stationItems = items.filter(i => i.station === station);
      const prep = Math.max(...stationItems.map(i => catalog.products.find(p => p.id === i.productId)!.prepMinutes));
      const status = ticketStatus(station);
      const startedAt = status === 'Queued' ? undefined : createdAt + MIN;
      const readyAt = status === 'Ready' ? Math.min(createdAt + (prep + 2) * MIN, now - MIN) : undefined;
      return {
        id: newId(), orderId: order.id, orderNumber: order.number, tableCode: t.code, source, station, status,
        itemIds: stationItems.map(i => i.id), createdAt, startedAt, readyAt,
      };
    });
    order.status = served ? 'Served' : deriveOrderStatus('Submitted', tickets);
    if (served) order.servedAt = Math.max(...tickets.map(tk => tk.readyAt ?? createdAt)) + 2 * MIN;
    state.orders.push(order);
    state.tickets.push(...tickets);
    return order;
  };

  /** Guest QR orders are paid when placed: one paid invoice per order. */
  const prepay = (order: Order, t: DiningTable, method: 'UPI' | 'Card') => {
    const bill = computeBill(order.items, 0);
    const at = order.createdAt;
    state.invoices.push({
      ...bill, kind: 'Order', orderIds: [order.id], id: newId(), invoiceNo: invoiceNumber(state.counters.invoice++, at),
      sessionId: order.sessionId!, tableCode: t.code, status: 'Paid', issuedAt: at, paidAt: at,
      payments: [{ id: newId(), method, amount: bill.total, at }],
    });
  };

  // Settled bills earlier today.
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const latest = now - 45 * MIN;
  let earliest = Math.max(dayStart + 7.5 * 60 * MIN, now - 10 * 60 * MIN);
  if (latest - earliest < 2 * 60 * MIN) earliest = Math.max(dayStart + 5 * MIN, latest - 3 * 60 * MIN);
  const methods: PaymentMethod[] = ['UPI', 'UPI', 'UPI', 'UPI', 'UPI', 'Card', 'Card', 'Card', 'Cash', 'Cash'];
  const pastCount = 26;
  for (let i = 0; i < pastCount; i++) {
    const t = pick(state.tables);
    const openedAt = earliest + ((latest - earliest) * (i + rand() * 0.7)) / pastCount;
    const items: OrderItem[] = [];
    const lineCount = 2 + Math.floor(rand() * 3);
    for (let n = 0; n < lineCount; n++) {
      const product = pick(catalog.products.filter(p => p.id !== 'tiramisu'));
      if (items.some(x => x.productId === product.id)) continue;
      items.push(item(product.id, rand() < 0.25 ? 2 : 1, Math.floor(rand() * product.variants.length)));
    }
    const paidAt = openedAt + (32 + rand() * 25) * MIN;
    const session = openSession(t, openedAt, 1 + Math.floor(rand() * t.capacity), paidAt);
    const viaQr = rand() < 0.65;
    const order = addOrder(t, session, viaQr ? 'QR' : 'POS', openedAt + 3 * MIN, items, () => 'Ready', true, viaQr ? 'Guest 1' : undefined);
    if (viaQr) {
      prepay(order, t, rand() < 0.75 ? 'UPI' : 'Card');
    } else {
      // Staff-entered orders are settled on the table bill when the guests leave.
      const discountPct = rand() < 0.15 ? 10 : 0;
      const bill = computeBill(items, discountPct);
      state.invoices.push({
        ...bill, kind: 'Session', orderIds: [order.id],
        id: newId(), invoiceNo: invoiceNumber(state.counters.invoice++, paidAt), sessionId: session.id, tableCode: t.code,
        status: 'Paid', issuedAt: paidAt - 2 * MIN, paidAt,
        payments: [{ id: newId(), method: pick(methods), amount: bill.total, at: paidAt }],
      });
    }
  }

  // Live service right now.
  const t3 = table('T3');
  const s3 = openSession(t3, now - 14 * MIN, 3);
  s3.guestJoins = 2;
  const o3 = addOrder(t3, s3, 'QR', now - 11 * MIN,
    [item('cappuccino', 2, 1, ['milk-oat']), item('avotoast'), item('chickenpanini', 1, 0, [], 'No onions please')],
    station => (station === 'Bar' ? 'Ready' : 'InProgress'), false, 'Guest 1');
  prepay(o3, t3, 'UPI');

  const t6 = table('T6');
  const s6 = openSession(t6, now - 38 * MIN, 5);
  s6.guestJoins = 2;
  addOrder(t6, s6, 'POS', now - 34 * MIN,
    [item('farmhouse', 1, 1, ['t-cheese']), item('arrabbiata'), item('chai', 2), item('limesoda', 1, 1)], () => 'Ready', true);
  const o6 = addOrder(t6, s6, 'QR', now - 2 * MIN, [item('brownie', 2, 0, ['ic-scoop']), item('coldbrew')], () => 'Queued', false, 'Guest 2');
  prepay(o6, t6, 'Card');

  const p2 = table('P2');
  const sp2 = openSession(p2, now - 62 * MIN, 4);
  addOrder(p2, sp2, 'POS', now - 58 * MIN,
    [item('margherita'), item('eggs', 1, 0, ['egg-sunny']), item('latte', 2), item('smoothie')], () => 'Ready', true);
  sp2.status = 'BillRequested';
  sp2.billRequestedAt = now - 3 * MIN;

  const t1 = table('T1');
  const s1 = openSession(t1, now - 5 * MIN, 2);
  s1.waiterCalledAt = now - MIN;

  for (const t of [t3, t6, p2, t1]) t.status = 'Occupied';
  table('T8').status = 'Cleaning';
  table('P4').status = 'Reserved';

  return state;
}
