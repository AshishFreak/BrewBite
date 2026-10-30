import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { CartStore, Clock, CustomerAuth, RestaurantApi } from '@ros/shared/data-access';
import {
  CartLine, computeBill, customerDisplayName, describeItem, describeSelection, DiningTable, elapsed, findProduct, Invoice, newId, OnlinePaymentMethod,
  maskPhone, Order, ORDER_STEPS, ordersForTableBill, Product, timeOfDay, toOrderItem,
} from '@ros/shared/domain';
import { FoodMark, InrPipe, Notifier, ProductOptions, RosButton, Sheet } from '@ros/shared/ui';
import { GuestLanding } from './guest-landing';

interface GuestIdentity {
  sessionId: string;
  label: string;
}

const STEP_LABELS: Record<string, string> = { Submitted: 'Received', Preparing: 'Preparing', Ready: 'Ready', Served: 'Served' };

const PAY_METHODS: { id: OnlinePaymentMethod; label: string; hint: string; icon: string }[] = [
  { id: 'UPI', label: 'UPI', hint: 'GPay, PhonePe, Paytm and other UPI apps', icon: 'pi-qrcode' },
  { id: 'Card', label: 'Debit / credit card', hint: 'Visa, Mastercard, RuPay', icon: 'pi-credit-card' },
];

const CALL_REASONS: { label: string; icon: string }[] = [
  { label: 'Help with the menu', icon: 'pi-book' },
  { label: 'Water', icon: 'pi-filter' },
  { label: 'Cutlery & napkins', icon: 'pi-th-large' },
  { label: 'Clean the table', icon: 'pi-sparkles' },
  { label: 'Something else', icon: 'pi-comment' },
];

@Component({
  selector: 'app-guest-page',
  imports: [GuestLanding, RosButton, Sheet, FoodMark, InrPipe, ProductOptions],
  templateUrl: './guest-page.html',
  styleUrl: './guest-page.scss',
})
export class GuestPage {
  private readonly api = inject(RestaurantApi);
  private readonly clock = inject(Clock);
  private readonly toast = inject(Notifier);

  /** Bound from the `/t/:tableCode` route. In production this is an opaque QR token, not the table code. */
  readonly tableCode = input.required<string>();

  protected readonly cafe = this.api.cafe;
  protected readonly catalog = this.api.catalog;
  protected readonly categories = computed(() => this.catalog().categories);
  protected readonly steps = ORDER_STEPS;
  protected readonly stepLabels = STEP_LABELS;
  protected readonly describeItem = describeItem;
  protected readonly timeOfDay = timeOfDay;

  protected readonly table = computed(() =>
    this.api.tables().find(t => t.code.toLowerCase() === this.tableCode().toLowerCase()));
  protected readonly cart = computed(() => new CartStore(`cart:${this.tableCode().toLowerCase()}`, this.catalog));
  protected readonly guest = signal<GuestIdentity | null>(null);
  protected readonly session = computed(() => {
    const id = this.guest()?.sessionId;
    return id ? this.api.sessions().find(s => s.id === id) : undefined;
  });
  protected readonly orders = computed(() => {
    const id = this.guest()?.sessionId;
    return id ? this.api.orders().filter(o => o.sessionId === id).sort((a, b) => b.createdAt - a.createdAt) : [];
  });
  /** Prepaid invoice per guest order, keyed by order id. */
  private readonly orderInvoices = computed(() => {
    const map = new Map<string, Invoice>();
    for (const inv of this.api.invoices()) if (inv.kind === 'Order') for (const id of inv.orderIds) map.set(id, inv);
    return map;
  });
  protected readonly paidSoFar = computed(() =>
    this.orders().reduce((s, o) => s + (this.orderInvoices().get(o.id)?.total ?? 0), 0));
  /** Staff-entered orders, settled on the table bill at the end. */
  protected readonly payLaterOrders = computed(() => {
    const id = this.guest()?.sessionId;
    return id ? ordersForTableBill(this.api.orders(), this.api.invoices(), id) : [];
  });
  protected readonly payLaterTotal = computed(() => this.payLaterOrders().reduce((s, o) => s + o.subTotal, 0));
  /** The table bill (kind `Session`) for pay-later orders, once staff issue it. */
  protected readonly invoice = computed(() => {
    const id = this.guest()?.sessionId;
    return id ? this.api.invoices().find(i => i.sessionId === id && i.kind === 'Session') : undefined;
  });
  protected readonly balance = computed(() => {
    const inv = this.invoice();
    return inv ? inv.total - inv.payments.reduce((s, p) => s + p.amount, 0) : 0;
  });
  protected readonly soldOut = computed(() => new Set(this.api.soldOut()));

  protected readonly tab = signal<'menu' | 'orders'>('menu');
  protected readonly category = signal('all');
  protected readonly query = signal('');
  protected readonly vegOnly = signal(false);
  private readonly visibleProducts = computed(() =>
    this.catalog().products.filter(p => !this.vegOnly() || p.foodType === 'veg'));
  protected readonly sections = computed(() => {
    const q = this.query().trim().toLowerCase();
    const cats = this.category() === 'all' ? this.categories() : this.categories().filter(c => c.id === this.category());
    return cats
      .map(c => ({
        category: c,
        products: this.visibleProducts().filter(p => p.categoryId === c.id &&
          (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))),
      }))
      .filter(s => s.products.length > 0);
  });
  protected readonly popular = computed(() =>
    this.category() === 'all' && !this.query() ? this.visibleProducts().filter(p => p.popular && !this.soldOut().has(p.id)) : []);
  protected readonly cartEmojis = computed(() =>
    [...new Set(this.cart().lines().map(l => findProduct(this.catalog(), l.productId)?.emoji ?? '🍽️'))].slice(0, 3));
  /** What the guest will pay, using the same GST maths as the server. Null if the cart no longer prices. */
  protected readonly cartBill = computed(() => {
    try {
      return computeBill(this.cart().lines().map(l => toOrderItem(this.catalog(), l, l.key)), 0);
    } catch {
      return null;
    }
  });

  protected readonly payMethods = PAY_METHODS;
  protected readonly payMethod = signal<OnlinePaymentMethod>('UPI');
  protected readonly callReasons = CALL_REASONS;
  protected readonly callOpen = signal(false);

  protected readonly optionsProduct = signal<Product | null>(null);
  protected readonly cartOpen = signal(false);
  protected readonly submitting = signal(false);
  protected readonly busy = signal(false);
  protected readonly upiStep = signal<'idle' | 'waiting' | 'done'>('idle');
  private idempotencyKey = newId();
  private joining = false;
  private readonly customerAuth = inject(CustomerAuth);
  protected readonly customer = this.customerAuth.customer;
  protected readonly firstName = computed(() => this.customer()?.name?.trim().split(/\s+/)[0] ?? '');
  protected readonly maskedPhone = computed(() => maskPhone(this.customer()?.phone ?? ''));

  constructor() {
    // Diners join the table only after verifying their mobile number on the landing screen.
    effect(() => {
      const table = this.table();
      const customer = this.customer();
      if (table && customer) untracked(() => this.ensureJoined(table));
    });
  }

  protected signOut(): void {
    const table = this.table();
    const customer = this.customer();
    if (table && customer) sessionStorage.removeItem(this.identityKey(table, customer.id));
    this.guest.set(null);
    this.cart().clear();
    this.customerAuth.signOut();
  }

  private identityKey(table: DiningTable, customerId: string): string {
    return `guest:${table.id}:${customerId}`;
  }

  protected openProduct(product: Product): void {
    if (!this.soldOut().has(product.id)) this.optionsProduct.set(product);
  }

  /** One tap adds items without choices; anything with sizes or add-ons opens the detail sheet. */
  protected quickAdd(product: Product): void {
    if (this.soldOut().has(product.id)) return;
    if (product.variants.length === 1 && product.modifierGroupIds.length === 0) {
      this.addToCart({ productId: product.id, variantId: product.variants[0].id, modifierIds: [], quantity: 1 });
    } else {
      this.optionsProduct.set(product);
    }
  }

  protected onOptionsVisible(visible: boolean): void {
    if (!visible) this.optionsProduct.set(null);
  }

  protected addToCart(line: Omit<CartLine, 'key'>): void {
    this.cart().add(line);
    this.optionsProduct.set(null);
    this.toast.add({ severity: 'success', summary: 'Added to cart', life: 1200 });
  }


  protected describeLine(line: CartLine): { name: string; emoji: string; detail: string } {
    return describeSelection(this.catalog(), line) ?? { name: 'Unavailable item', emoji: '❔', detail: '' };
  }

  /** Guests pay when they order: the order reaches the kitchen only after the payment succeeds. */
  protected async payAndPlaceOrder(): Promise<void> {
    const table = this.table();
    const guest = this.guest();
    if (!table || !guest || this.submitting()) return;
    this.submitting.set(true);
    try {
      // Stands in for the payment gateway (UPI intent / card page). Production confirms the
      // payment server-side (verified webhook) before creating the order.
      await new Promise(resolve => setTimeout(resolve, 1600));
      const { order, invoice } = await this.api.placePaidOrder({
        idempotencyKey: this.idempotencyKey, tableId: table.id, source: 'QR', guestLabel: guest.label, lines: this.cart().lines(),
      }, this.payMethod());
      this.cart().clear();
      this.idempotencyKey = newId();
      this.cartOpen.set(false);
      this.tab.set('orders');
      this.toast.add({ severity: 'success', summary: `Paid ₹${invoice.total} · Order #${order.number} sent to the kitchen`, life: 3000 });
    } catch (e) {
      // The idempotency key is kept, so retrying the same cart can never create a duplicate order or charge.
      this.toast.add({ severity: 'error', summary: 'Order not placed', detail: (e as Error).message, life: 4000 });
    } finally {
      this.submitting.set(false);
    }
  }

  protected orderInvoice(orderId: string): Invoice | undefined {
    return this.orderInvoices().get(orderId);
  }

  protected async callStaff(reason: string): Promise<void> {
    await this.run(id => this.api.callWaiter(id, reason), 'Staff have been notified');
    this.callOpen.set(false);
  }

  protected async cancelCall(): Promise<void> {
    await this.run(id => this.api.acknowledgeWaiter(id), 'Request cancelled');
    this.callOpen.set(false);
  }

  protected calledAgo(): string {
    const at = this.session()?.waiterCalledAt;
    return at ? elapsed(at, this.clock.now()) : '';
  }

  protected async requestBill(): Promise<void> {
    await this.run(id => this.api.requestBill(id), 'Bill requested. Staff will bring it shortly.');
  }

  protected async payWithUpi(): Promise<void> {
    const invoice = this.invoice();
    if (!invoice || this.upiStep() !== 'idle') return;
    this.upiStep.set('waiting');
    try {
      // Stands in for the payment-gateway redirect and the verified webhook.
      await new Promise(resolve => setTimeout(resolve, 1800));
      await this.api.recordPayment(invoice.id, 'UPI', this.balance());
      this.upiStep.set('done');
    } catch (e) {
      this.upiStep.set('idle');
      this.toast.add({ severity: 'error', summary: 'Payment failed', detail: (e as Error).message, life: 4000 });
    }
  }

  protected async startNewVisit(): Promise<void> {
    const table = this.table();
    if (!table) return;
    const customer = this.customer();
    if (customer) sessionStorage.removeItem(this.identityKey(table, customer.id));
    this.guest.set(null);
    this.upiStep.set('idle');
    this.tab.set('menu');
    await this.ensureJoined(table);
  }

  protected stepIndex(order: Order): number {
    return ORDER_STEPS.indexOf(order.status);
  }

  protected readyEstimate(order: Order): string {
    if (order.status !== 'Submitted' && order.status !== 'Preparing') return '';
    const prep = Math.max(...order.items.map(i => findProduct(this.catalog(), i.productId)?.prepMinutes ?? 10));
    const remaining = Math.ceil((order.createdAt + (prep + 2) * 60_000 - this.clock.now()) / 60_000);
    return remaining > 1 ? `Ready in about ${remaining} min` : 'Almost ready';
  }

  private async run(action: (sessionId: string) => Promise<void>, success: string): Promise<void> {
    const id = this.guest()?.sessionId;
    if (!id || this.busy()) return;
    this.busy.set(true);
    try {
      await action(id);
      this.toast.add({ severity: 'info', summary: success, life: 2500 });
    } catch (e) {
      this.toast.add({ severity: 'error', summary: (e as Error).message, life: 4000 });
    } finally {
      this.busy.set(false);
    }
  }

  private async ensureJoined(table: DiningTable): Promise<void> {
    const customer = this.customer();
    if (this.joining || this.guest() || !customer) return;
    const key = this.identityKey(table, customer.id);
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as GuestIdentity | null;
      if (saved && this.api.sessions().some(s => s.id === saved.sessionId)) {
        this.guest.set(saved);
        return;
      }
    } catch {
      // Ignore a corrupt entry and join again.
    }
    this.joining = true;
    try {
      const { session, guestLabel } = await this.api.joinTable(table.id, customerDisplayName(customer));
      const identity = { sessionId: session.id, label: guestLabel };
      sessionStorage.setItem(key, JSON.stringify(identity));
      this.guest.set(identity);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: (e as Error).message, life: 4000 });
    } finally {
      this.joining = false;
    }
  }
}
