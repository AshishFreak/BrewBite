import { computed, Injectable, signal } from '@angular/core';
import {
  computeBill, deriveOrderStatus, findProduct, Invoice, isActiveSession, MAX_UNAPPROVED_DISCOUNT_PCT, newId, OnlinePaymentMethod,
  MenuCategory, Order, ordersForTableBill, Product, slugId, validateCategory, validateProduct, paidOrderIds, PaymentMethod, round2, TableSession, TicketStatus, toOrderItem,
} from '@ros/shared/domain';
import { JoinTableResult, PaidOrderResult, RestaurantApi, SubmitOrderRequest } from '../restaurant-api';
import { DUMMY_CAFE } from './dummy-catalog';
import { createSeedState, DEMO_SCHEMA, DemoState, invoiceNumber } from './seed';

const STORAGE_KEY = 'ros-dummy-state';
const CHANNEL_NAME = 'ros-dummy-realtime';
const RESEED_AFTER_MS = 12 * 60 * 60_000;

/**
 * In-browser stand-in for the backend. It applies the same rules the server will
 * (server-side pricing, idempotency, one active session per table, gapless invoice numbers)
 * and syncs every open tab and iframe through BroadcastChannel, which plays the role of SignalR.
 */
@Injectable()
export class DummyRestaurantApi extends RestaurantApi {
  private readonly state = signal<DemoState>(this.load());

  readonly cafe = signal(DUMMY_CAFE).asReadonly();
  readonly catalog = computed(() => this.state().catalog);
  private readonly channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);

  readonly tables = computed(() => this.state().tables);
  readonly sessions = computed(() => this.state().sessions);
  readonly orders = computed(() => this.state().orders);
  readonly tickets = computed(() => this.state().tickets);
  readonly invoices = computed(() => this.state().invoices);
  readonly soldOut = computed(() => this.state().soldOut);

  constructor() {
    super();
    if (this.channel) {
      this.channel.onmessage = (e: MessageEvent<DemoState>) => this.state.set(e.data);
    } else {
      window.addEventListener('storage', e => {
        if (e.key === STORAGE_KEY && e.newValue) this.state.set(JSON.parse(e.newValue));
      });
    }
  }

  joinTable(tableId: string, guestName?: string): Promise<JoinTableResult> {
    return this.mutate(s => {
      const table = s.tables.find(t => t.id === tableId);
      if (!table) throw new Error('This QR code is not linked to a table.');
      let session = s.sessions.find(x => x.tableId === tableId && isActiveSession(x));
      if (!session) {
        session = { id: newId(), tableId, status: 'Open', guestCount: 0, guestJoins: 0, openedAt: Date.now() };
        s.sessions.push(session);
        table.status = 'Occupied';
      }
      session.guestJoins++;
      session.guestCount = Math.max(session.guestCount, session.guestJoins);
      return { session: { ...session }, guestLabel: guestName?.trim() || `Guest ${session.guestJoins}` };
    });
  }

  openTable(tableId: string, guestCount: number): Promise<TableSession> {
    return this.mutate(s => {
      const table = s.tables.find(t => t.id === tableId);
      if (!table) throw new Error('Table not found.');
      if (s.sessions.some(x => x.tableId === tableId && isActiveSession(x))) {
        throw new Error(`Table ${table.code} already has an open session.`);
      }
      const session: TableSession = {
        id: newId(), tableId, status: 'Open', guestCount: Math.max(1, guestCount), guestJoins: 0, openedAt: Date.now(),
      };
      s.sessions.push(session);
      table.status = 'Occupied';
      return { ...session };
    });
  }

  submitOrder(request: SubmitOrderRequest): Promise<Order> {
    return this.mutate(s => {
      const duplicate = s.orders.find(o => o.idempotencyKey === request.idempotencyKey);
      if (duplicate) return duplicate;
      const order = this.createOrder(s, request);
      const session = s.sessions.find(x => x.id === order.sessionId);
      if (session?.status === 'BillRequested') session.status = 'Open';
      return order;
    });
  }

  placePaidOrder(request: SubmitOrderRequest, method: OnlinePaymentMethod): Promise<PaidOrderResult> {
    return this.mutate(s => {
      const duplicate = s.orders.find(o => o.idempotencyKey === request.idempotencyKey);
      if (duplicate) {
        const invoice = s.invoices.find(i => i.kind === 'Order' && i.orderIds.includes(duplicate.id));
        if (invoice) return { order: duplicate, invoice };
        throw new Error('This order was already placed without payment. Please ask a staff member.');
      }
      const order = this.createOrder(s, request);
      const now = Date.now();
      const bill = computeBill(order.items, 0);
      const invoice: Invoice = {
        ...bill, kind: 'Order', orderIds: [order.id], id: newId(), invoiceNo: invoiceNumber(s.counters.invoice++, now),
        sessionId: order.sessionId!, tableCode: s.tables.find(t => t.id === order.tableId)?.code ?? '',
        status: 'Paid', issuedAt: now, paidAt: now, payments: [{ id: newId(), method, amount: bill.total, at: now }],
      };
      s.invoices.push(invoice);
      return { order, invoice };
    });
  }

  setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
    return this.mutate(s => {
      const ticket = s.tickets.find(t => t.id === ticketId);
      if (!ticket) throw new Error('Ticket not found.');
      const now = Date.now();
      ticket.status = status;
      if (status === 'InProgress') {
        ticket.startedAt ??= now;
        ticket.readyAt = undefined;
      }
      if (status === 'Ready') {
        ticket.startedAt ??= now;
        ticket.readyAt = now;
      }
      const order = s.orders.find(o => o.id === ticket.orderId);
      if (order) order.status = deriveOrderStatus(order.status, s.tickets.filter(t => t.orderId === order.id));
    });
  }

  markServed(orderId: string): Promise<void> {
    return this.mutate(s => {
      const order = s.orders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found.');
      if (order.status !== 'Ready') throw new Error(`Order #${order.number} is not ready yet.`);
      order.status = 'Served';
      order.servedAt = Date.now();
    });
  }

  callWaiter(sessionId: string, reason?: string): Promise<void> {
    return this.mutate(s => {
      const session = this.activeSession(s, sessionId);
      session.waiterCalledAt = Date.now();
      session.waiterReason = reason?.trim().slice(0, 80) || undefined;
    });
  }

  acknowledgeWaiter(sessionId: string): Promise<void> {
    return this.mutate(s => {
      const session = s.sessions.find(x => x.id === sessionId);
      if (session) {
        session.waiterCalledAt = undefined;
        session.waiterReason = undefined;
      }
    });
  }

  requestBill(sessionId: string): Promise<void> {
    return this.mutate(s => {
      const session = this.activeSession(s, sessionId);
      if (ordersForTableBill(s.orders, s.invoices, sessionId).length === 0) {
        throw new Error('Everything at this table is already paid.');
      }
      if (session.status === 'Open') session.status = 'BillRequested';
      session.billRequestedAt = Date.now();
    });
  }

  checkout(sessionId: string, discountPct: number, approvedBy?: string): Promise<Invoice> {
    return this.mutate(s => {
      if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 50) throw new Error('Discount must be between 0% and 50%.');
      if (discountPct > MAX_UNAPPROVED_DISCOUNT_PCT && !approvedBy) {
        throw new Error(`Discounts above ${MAX_UNAPPROVED_DISCOUNT_PCT}% need manager approval.`);
      }
      const session = this.activeSession(s, sessionId);
      const table = s.tables.find(t => t.id === session.tableId)!;
      // Prepaid guest orders are already settled; the table bill covers everything else.
      const billable = ordersForTableBill(s.orders, s.invoices, sessionId);
      const items = billable.flatMap(o => o.items);
      if (items.length === 0) throw new Error('Nothing left to bill: every order at this table is already paid.');

      const existing = s.invoices.find(i => i.sessionId === sessionId && i.kind === 'Session');
      if (existing?.payments.length) return existing;

      const now = Date.now();
      const bill = computeBill(items, discountPct);
      session.status = 'Settling';
      if (existing) {
        // Re-issuing before any payment keeps the same invoice number, so the series stays gapless.
        Object.assign(existing, bill, { orderIds: billable.map(o => o.id), issuedAt: now, approvedBy });
        return existing;
      }
      const invoice: Invoice = {
        ...bill, kind: 'Session', orderIds: billable.map(o => o.id), id: newId(), invoiceNo: invoiceNumber(s.counters.invoice++, now), sessionId, tableCode: table.code,
        status: 'Issued', payments: [], issuedAt: now, approvedBy,
      };
      s.invoices.push(invoice);
      return invoice;
    });
  }

  recordPayment(invoiceId: string, method: PaymentMethod, amount: number): Promise<Invoice> {
    return this.mutate(s => {
      const invoice = s.invoices.find(i => i.id === invoiceId);
      if (!invoice) throw new Error('Invoice not found.');
      if (invoice.status === 'Paid') throw new Error(`Invoice ${invoice.invoiceNo} is already paid.`);
      const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = round2(invoice.total - paid);
      const value = round2(amount);
      if (!(value > 0) || value > balance) throw new Error(`Amount must be more than ₹0 and at most ₹${balance}.`);

      const now = Date.now();
      invoice.payments.push({ id: newId(), method, amount: value, at: now });
      if (round2(paid + value) >= invoice.total) {
        invoice.status = 'Paid';
        invoice.paidAt = now;
        // Settling the table bill ends the visit; a prepaid order invoice never does.
        const session = s.sessions.find(x => x.id === invoice.sessionId);
        if (session && invoice.kind === 'Session') this.endVisit(s, session, now);
      }
      return invoice;
    });
  }

  closeTable(sessionId: string): Promise<void> {
    return this.mutate(s => {
      const session = this.activeSession(s, sessionId);
      const paid = paidOrderIds(s.invoices);
      const unpaid = s.orders.filter(o => o.sessionId === sessionId && o.status !== 'Cancelled' && !paid.has(o.id));
      if (unpaid.length) throw new Error(`${unpaid.length} order(s) still unpaid. Check out the table bill first.`);
      this.endVisit(s, session, Date.now());
    });
  }

  markTableClean(tableId: string): Promise<void> {
    return this.mutate(s => {
      const table = s.tables.find(t => t.id === tableId);
      if (!table) throw new Error('Table not found.');
      if (s.sessions.some(x => x.tableId === tableId && isActiveSession(x))) {
        throw new Error(`Table ${table.code} still has an open session.`);
      }
      table.status = 'Available';
    });
  }

  toggleSoldOut(productId: string): Promise<void> {
    return this.mutate(s => {
      s.soldOut = s.soldOut.includes(productId) ? s.soldOut.filter(id => id !== productId) : [...s.soldOut, productId];
    });
  }

  saveCategory(category: MenuCategory): Promise<MenuCategory> {
    return this.mutate(s => {
      const problems = validateCategory(category, s.catalog);
      if (problems.length) throw new Error(problems.join(' '));
      const saved: MenuCategory = { id: category.id || slugId(category.name), name: category.name.trim(), icon: category.icon.trim() || '🍽️' };
      const index = s.catalog.categories.findIndex(c => c.id === saved.id);
      if (index >= 0) s.catalog.categories[index] = saved;
      else s.catalog.categories.push(saved);
      return saved;
    });
  }

  deleteCategory(categoryId: string): Promise<void> {
    return this.mutate(s => {
      const count = s.catalog.products.filter(p => p.categoryId === categoryId).length;
      if (count) throw new Error(`Move or delete the ${count} item${count > 1 ? 's' : ''} in this category first.`);
      s.catalog.categories = s.catalog.categories.filter(c => c.id !== categoryId);
    });
  }

  saveProduct(product: Product): Promise<Product> {
    return this.mutate(s => {
      const problems = validateProduct(product, s.catalog);
      if (problems.length) throw new Error(problems.join(' '));
      const id = product.id || slugId(product.name);
      const saved: Product = {
        ...product,
        id,
        name: product.name.trim(),
        description: product.description.trim(),
        emoji: product.emoji.trim() || '🍽️',
        variants: product.variants.map((v, i) => ({ id: v.id || `${id}-v${i + 1}-${newId().slice(0, 4)}`, name: v.name.trim(), price: round2(v.price) })),
      };
      const index = s.catalog.products.findIndex(p => p.id === id);
      if (index >= 0) s.catalog.products[index] = saved;
      else s.catalog.products.push(saved);
      return saved;
    });
  }

  deleteProduct(productId: string): Promise<void> {
    return this.mutate(s => {
      if (!s.catalog.products.some(p => p.id === productId)) throw new Error('Item not found.');
      s.catalog.products = s.catalog.products.filter(p => p.id !== productId);
      s.soldOut = s.soldOut.filter(id => id !== productId);
    });
  }

  resetData(): void {
    this.publish(createSeedState());
  }

  private endVisit(s: DemoState, session: TableSession, now: number): void {
    session.status = 'Closed';
    session.closedAt = now;
    session.waiterCalledAt = undefined;
    session.waiterReason = undefined;
    const table = s.tables.find(t => t.id === session.tableId);
    if (table) table.status = 'Cleaning';
  }

  /** Validates and records an order with its kitchen tickets. Callers handle idempotency and payment. */
  private createOrder(s: DemoState, request: SubmitOrderRequest): Order {
    if (request.lines.length === 0) throw new Error('Your cart is empty.');
    const table = s.tables.find(t => t.id === request.tableId);
    if (!table) throw new Error('Table not found.');
    const session = s.sessions.find(x => x.tableId === table.id && isActiveSession(x));
    if (!session) throw new Error('This table has no open session. Please ask a staff member.');
    if (session.status === 'Settling') throw new Error('The bill for this table is being settled. Ask staff to add items.');

    const soldOut = request.lines.find(l => s.soldOut.includes(l.productId));
    if (soldOut) throw new Error(`${findProduct(s.catalog, soldOut.productId)?.name ?? 'An item'} just sold out. Please remove it.`);

    const now = Date.now();
    const items = request.lines.map(l => toOrderItem(s.catalog, l, newId()));
    const order: Order = {
      id: newId(), number: s.counters.order++, tableId: table.id, sessionId: session.id, source: request.source,
      guestLabel: request.guestLabel, status: 'Submitted', items,
      subTotal: round2(items.reduce((sum, i) => sum + i.lineTotal, 0)), createdAt: now,
      idempotencyKey: request.idempotencyKey,
    };
    s.orders.push(order);
    for (const station of new Set(items.map(i => i.station))) {
      s.tickets.push({
        id: newId(), orderId: order.id, orderNumber: order.number, tableCode: table.code, source: order.source,
        station, status: 'Queued', itemIds: items.filter(i => i.station === station).map(i => i.id), createdAt: now,
      });
    }
    table.status = 'Occupied';
    return order;
  }

  private activeSession(s: DemoState, sessionId: string): TableSession {
    const session = s.sessions.find(x => x.id === sessionId);
    if (!session || !isActiveSession(session)) throw new Error('This table session has already been closed.');
    return session;
  }

  /** Simulates a network round-trip, then applies the change atomically: a throw leaves state untouched. */
  private async mutate<T>(change: (draft: DemoState) => T): Promise<T> {
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));
    const draft = structuredClone(this.state());
    const result = change(draft);
    this.publish(draft);
    return structuredClone(result);
  }

  private publish(next: DemoState): void {
    this.state.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage can be unavailable (private mode); the demo still works within this tab.
    }
    this.channel?.postMessage(next);
  }

  private load(): DemoState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as DemoState) : null;
      if (saved?.schema === DEMO_SCHEMA && Date.now() - saved.seededAt < RESEED_AFTER_MS) return saved;
    } catch {
      // Fall through to a fresh seed.
    }
    const seeded = createSeedState();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    } catch {
      // Ignore: see publish().
    }
    return seeded;
  }
}
