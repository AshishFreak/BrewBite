import { UserMenu } from '@ros/shared/auth';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Notifier } from '@ros/shared/ui';
import { RosButton } from '@ros/shared/ui';
import { Sheet } from '@ros/shared/ui';
import { AuthService, CartStore } from '@ros/shared/data-access';
import { Clock } from '@ros/shared/data-access';
import { elapsed, timeOfDay } from '@ros/shared/domain';
import { newId, ROLE_LABEL } from '@ros/shared/domain';
import { CartLine, PaymentMethod, Product } from '@ros/shared/domain';
import { isActiveSession, ordersForTableBill, paidOrderIds } from '@ros/shared/domain';
import { computeBill, describeItem, describeSelection, MAX_UNAPPROVED_DISCOUNT_PCT, round2 } from '@ros/shared/domain';
import { RestaurantApi } from '@ros/shared/data-access';
import { FoodMark } from '@ros/shared/ui';
import { InrPipe } from '@ros/shared/ui';
import { ProductOptions } from '@ros/shared/ui';

/** Demo-only manager PIN. Production approval goes through a server-verified manager credential. */
const DEMO_MANAGER_PIN = '1234';

@Component({
  selector: 'app-pos-table',
  imports: [UserMenu, RosButton, Sheet, FoodMark, InrPipe, NgTemplateOutlet, ProductOptions, RouterLink],
  templateUrl: './pos-table.html',
  styleUrl: './pos-table.scss',
})
export class PosTable {
  private readonly api = inject(RestaurantApi);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly toast = inject(Notifier);
  private readonly auth = inject(AuthService);

  /** Waiters take orders; cashiers and managers take payment. Managers and above approve large discounts. */
  protected readonly canCheckout = this.auth.can('billing.checkout');
  protected readonly canApprove = this.auth.can('billing.discount.approve');
  protected readonly approverLabel = ROLE_LABEL[this.auth.user()?.role ?? 'manager'];

  /** Bound from the `/pos/table/:tableId` route. */
  readonly tableId = input.required<string>();

  protected readonly cafe = this.api.cafe;
  protected readonly catalog = this.api.catalog;
  protected readonly categories = computed(() => this.catalog().categories);
  protected readonly describeItem = describeItem;
  protected readonly timeOfDay = timeOfDay;
  protected readonly discounts = [0, 5, 10, 15, 20];
  protected readonly methods: PaymentMethod[] = ['Cash', 'UPI', 'Card'];
  protected readonly maxFreeDiscount = MAX_UNAPPROVED_DISCOUNT_PCT;

  protected readonly table = computed(() => this.api.tables().find(t => t.id === this.tableId()));
  protected readonly session = computed(() =>
    this.api.sessions().find(s => s.tableId === this.tableId() && isActiveSession(s)));
  protected readonly orders = computed(() => {
    const id = this.session()?.id;
    return id ? this.api.orders().filter(o => o.sessionId === id).sort((a, b) => a.createdAt - b.createdAt) : [];
  });
  /** The table bill for this visit; prepaid guest-order invoices are separate (kind `Order`). */
  protected readonly invoice = computed(() => {
    const id = this.session()?.id;
    return id ? this.api.invoices().find(i => i.sessionId === id && i.kind === 'Session') : undefined;
  });
  protected readonly paidIds = computed(() => paidOrderIds(this.api.invoices()));
  /** Orders that go on the table bill: everything not paid online when it was placed. */
  protected readonly billable = computed(() => {
    const id = this.session()?.id;
    return id ? ordersForTableBill(this.api.orders(), this.api.invoices(), id) : [];
  });
  protected readonly prepaidTotal = computed(() => {
    const id = this.session()?.id;
    return this.api.invoices().filter(i => i.sessionId === id && i.kind === 'Order').reduce((s, i) => s + i.total, 0);
  });
  /**
   * The last payment closes the session, possibly from the guest's phone. While checkout is open,
   * keep tracking that invoice so the receipt still shows after the session disappears.
   */
  protected readonly settledInvoice = linkedSignal<string | undefined, string | null>({
    source: () => this.invoice()?.id,
    computation: (id, previous) => id ?? (this.checkoutOpen() ? previous?.value ?? null : null),
  });
  protected readonly receipt = computed(() => {
    const id = this.settledInvoice();
    return id ? this.api.invoices().find(i => i.id === id) : undefined;
  });
  protected readonly paid = computed(() => this.receipt()?.payments.reduce((s, p) => s + p.amount, 0) ?? 0);
  protected readonly balance = computed(() => round2((this.receipt()?.total ?? 0) - this.paid()));
  protected readonly unserved = computed(() => this.orders().filter(o => o.status !== 'Served' && o.status !== 'Cancelled').length);
  protected readonly soldOut = computed(() => new Set(this.api.soldOut()));

  protected readonly cart = computed(() => new CartStore(`pos-cart:${this.tableId()}`, this.catalog));
  protected readonly category = linkedSignal(() => this.categories()[0]?.id ?? '');
  protected readonly query = signal('');
  protected readonly products = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.catalog().products.filter(p => p.name.toLowerCase().includes(q)) : this.catalog().products.filter(p => p.categoryId === this.category());
  });
  protected readonly soldOutMode = signal(false);
  protected readonly optionsProduct = signal<Product | null>(null);
  protected readonly guestCount = signal(2);
  protected readonly busy = signal(false);
  private sendKey = newId();

  // Checkout
  protected readonly checkoutOpen = signal(false);
  protected readonly discountPct = signal(0);
  protected readonly managerPin = signal('');
  protected readonly method = signal<PaymentMethod>('UPI');
  protected readonly amount = linkedSignal(() => this.balance());
  protected readonly tendered = signal<number | null>(null);
  protected readonly splitWays = signal(1);
  protected readonly preview = computed(() => computeBill(this.billable().flatMap(o => o.items), this.discountPct()));
  protected readonly needsApproval = computed(() => this.discountPct() > MAX_UNAPPROVED_DISCOUNT_PCT);
  protected readonly change = computed(() => {
    const t = this.tendered();
    return this.method() === 'Cash' && t != null ? round2(t - this.amount()) : 0;
  });

  protected since(at: number): string {
    return elapsed(at, this.clock.now());
  }


  protected describeLine(line: CartLine): { name: string; emoji: string; detail: string } {
    return describeSelection(this.catalog(), line) ?? { name: 'Unavailable item', emoji: '❔', detail: '' };
  }

  protected async openTable(): Promise<void> {
    await this.run(async () => {
      await this.api.openTable(this.tableId(), this.guestCount());
    });
  }

  protected async markClean(): Promise<void> {
    await this.run(async () => {
      await this.api.markTableClean(this.tableId());
      this.toast.add({ severity: 'success', summary: `${this.table()?.code} is ready for guests`, life: 2000 });
    });
  }

  protected tapProduct(product: Product): void {
    if (this.soldOutMode()) {
      void this.api.toggleSoldOut(product.id);
      return;
    }
    if (this.soldOut().has(product.id) || !this.session()) return;
    if (product.variants.length === 1 && product.modifierGroupIds.length === 0) {
      this.cart().add({ productId: product.id, variantId: product.variants[0].id, modifierIds: [], quantity: 1 });
    } else {
      this.optionsProduct.set(product);
    }
  }

  protected addFromOptions(line: Omit<CartLine, 'key'>): void {
    this.cart().add(line);
    this.optionsProduct.set(null);
  }

  protected onOptionsVisible(visible: boolean): void {
    if (!visible) this.optionsProduct.set(null);
  }

  protected async sendToKitchen(): Promise<void> {
    await this.run(async () => {
      const order = await this.api.submitOrder({
        idempotencyKey: this.sendKey, tableId: this.tableId(), source: 'POS', lines: this.cart().lines(),
      });
      this.cart().clear();
      this.sendKey = newId();
      this.toast.add({ severity: 'success', summary: `Order #${order.number} sent to kitchen`, life: 2000 });
    });
  }

  protected async closeTable(): Promise<void> {
    const session = this.session();
    if (!session) return;
    await this.run(async () => {
      await this.api.closeTable(session.id);
      this.toast.add({ severity: 'success', summary: `${this.table()?.code} closed · ready for cleaning`, life: 2500 });
      await this.router.navigate(['/']);
    });
  }

  protected async acknowledge(sessionId: string): Promise<void> {
    await this.run(() => this.api.acknowledgeWaiter(sessionId));
  }

  protected async serve(orderId: string): Promise<void> {
    await this.run(() => this.api.markServed(orderId));
  }

  protected openCheckout(): void {
    this.discountPct.set(this.invoice()?.discountPct ?? 0);
    this.managerPin.set('');
    this.tendered.set(null);
    this.splitWays.set(1);
    this.checkoutOpen.set(true);
  }

  protected async issueBill(): Promise<void> {
    const session = this.session();
    if (!session) return;
    if (this.needsApproval() && !this.canApprove && this.managerPin() !== DEMO_MANAGER_PIN) {
      this.toast.add({ severity: 'warn', summary: 'Manager PIN required', detail: `Discounts above ${MAX_UNAPPROVED_DISCOUNT_PCT}% need approval (demo PIN 1234).`, life: 4000 });
      return;
    }
    await this.run(async () => {
      const approver = this.canApprove ? this.auth.user()?.name : 'Manager PIN';
      await this.api.checkout(session.id, this.discountPct(), this.needsApproval() ? approver : undefined);
    });
  }

  protected split(ways: number): void {
    this.splitWays.set(ways);
    const total = this.receipt()?.total ?? 0;
    this.amount.set(Math.min(this.balance(), Math.ceil(total / ways)));
  }

  protected async takePayment(): Promise<void> {
    const invoice = this.receipt();
    if (!invoice) return;
    if (this.method() === 'Cash' && this.tendered() != null && this.change() < 0) {
      this.toast.add({ severity: 'warn', summary: 'Cash received is less than the amount', life: 3000 });
      return;
    }
    await this.run(async () => {
      const updated = await this.api.recordPayment(invoice.id, this.method(), this.amount());
      this.tendered.set(null);
      if (updated.status === 'Paid') {
        this.toast.add({ severity: 'success', summary: `${updated.invoiceNo} settled`, life: 2500 });
      }
    });
  }

  protected numberFrom(event: Event): number {
    return Number((event.target as HTMLInputElement).value) || 0;
  }

  protected print(): void {
    window.print();
  }

  protected async finish(): Promise<void> {
    this.checkoutOpen.set(false);
    await this.router.navigate(['/']);
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await action();
    } catch (e) {
      this.toast.add({ severity: 'error', summary: (e as Error).message, life: 4000 });
    } finally {
      this.busy.set(false);
    }
  }
}
