import { UserMenu } from '@ros/shared/auth';
import { Component, computed, inject, signal } from '@angular/core';
import { Clock } from '@ros/shared/data-access';
import { elapsed, timeOfDay } from '@ros/shared/domain';
import { PaymentMethod } from '@ros/shared/domain';
import { isActiveSession } from '@ros/shared/domain';
import { round2 } from '@ros/shared/domain';
import { RestaurantApi } from '@ros/shared/data-access';
import { InrPipe } from '@ros/shared/ui';

interface HourBar {
  hour: number;
  label: string;
  net: number;
  bills: number;
}

@Component({
  selector: 'app-owner-dashboard',
  imports: [UserMenu, InrPipe],
  templateUrl: './owner-dashboard.html',
  styleUrl: './owner-dashboard.scss',
})
export class OwnerDashboard {
  private readonly api = inject(RestaurantApi);
  private readonly clock = inject(Clock);

  protected readonly cafe = this.api.cafe;
  protected readonly hovered = signal<HourBar | null>(null);

  private readonly dayStart = computed(() => new Date(this.clock.now()).setHours(0, 0, 0, 0));
  protected readonly todays = computed(() =>
    this.api.invoices().filter(i => i.status === 'Paid' && (i.paidAt ?? 0) >= this.dayStart()));

  protected readonly totals = computed(() => {
    const inv = this.todays();
    const sum = (f: (i: (typeof inv)[number]) => number) => round2(inv.reduce((s, i) => s + f(i), 0));
    const gross = sum(i => i.subTotal);
    const discounts = sum(i => i.discount);
    const net = sum(i => i.taxable);
    const tax = sum(i => i.cgst + i.sgst);
    const collected = sum(i => i.total);
    return { gross, discounts, net, tax, collected, bills: inv.length, avgBill: inv.length ? round2(net / inv.length) : 0 };
  });

  protected readonly hours = computed<HourBar[]>(() => {
    const inv = this.todays();
    if (!inv.length) return [];
    const nowHour = new Date(this.clock.now()).getHours();
    const first = Math.min(...inv.map(i => new Date(i.paidAt!).getHours()));
    const bars: HourBar[] = [];
    for (let h = first; h <= nowHour; h++) {
      const inHour = inv.filter(i => new Date(i.paidAt!).getHours() === h);
      const label = new Date(2000, 0, 1, h).toLocaleTimeString('en-IN', { hour: 'numeric' });
      bars.push({ hour: h, label, net: round2(inHour.reduce((s, i) => s + i.taxable, 0)), bills: inHour.length });
    }
    return bars;
  });
  protected readonly maxHour = computed(() => Math.max(1, ...this.hours().map(h => h.net)));
  protected readonly peakHour = computed(() => this.hours().reduce<HourBar | null>((best, h) => (!best || h.net > best.net ? h : best), null));

  protected readonly paymentMix = computed(() => {
    const byMethod = new Map<PaymentMethod, number>([['UPI', 0], ['Card', 0], ['Cash', 0]]);
    for (const p of this.todays().flatMap(i => i.payments)) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
    const total = [...byMethod.values()].reduce((a, b) => a + b, 0) || 1;
    return [...byMethod.entries()].map(([method, amount]) => ({ method, amount, pct: Math.round((amount / total) * 100) }));
  });

  protected readonly topItems = computed(() => {
    const paidOrders = new Set(this.todays().flatMap(i => i.orderIds));
    const qty = new Map<string, { name: string; emoji: string; quantity: number; sales: number }>();
    for (const o of this.api.orders()) {
      if (!paidOrders.has(o.id)) continue;
      for (const i of o.items) {
        const row = qty.get(i.productId) ?? { name: i.name, emoji: i.emoji, quantity: 0, sales: 0 };
        row.quantity += i.quantity;
        row.sales = round2(row.sales + i.lineTotal);
        qty.set(i.productId, row);
      }
    }
    return [...qty.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  });
  protected readonly maxItemQty = computed(() => Math.max(1, ...this.topItems().map(i => i.quantity)));

  protected readonly live = computed(() => {
    const tables = this.api.tables();
    const sessions = this.api.sessions().filter(isActiveSession);
    const orders = this.api.orders();
    const rows = sessions.map(s => {
      const table = tables.find(t => t.id === s.tableId)!;
      const value = orders.filter(o => o.sessionId === s.id && o.status !== 'Cancelled').reduce((sum, o) => sum + o.subTotal, 0);
      return { code: table.code, guests: s.guestCount, value, since: s.openedAt, status: s.status };
    }).sort((a, b) => a.since - b.since);
    return {
      rows,
      openValue: rows.reduce((s, r) => s + r.value, 0),
      occupied: rows.length,
      tables: tables.length,
      inKitchen: this.api.tickets().filter(t => t.status !== 'Ready').length,
    };
  });

  protected readonly kitchenMinutes = computed(() => {
    const done = this.api.tickets().filter(t => t.readyAt && t.createdAt >= this.dayStart());
    return done.length ? Math.round(done.reduce((s, t) => s + (t.readyAt! - t.createdAt), 0) / done.length / 60_000) : 0;
  });

  protected since(at: number): string {
    return elapsed(at, this.clock.now());
  }

  protected updatedAt(): string {
    return timeOfDay(this.clock.now());
  }
}
