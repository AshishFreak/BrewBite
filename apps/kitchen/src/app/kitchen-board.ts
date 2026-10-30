import { UserMenu } from '@ros/shared/auth';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { Notifier } from '@ros/shared/ui';
import { RosButton } from '@ros/shared/ui';
import { Clock } from '@ros/shared/data-access';
import { elapsed, minutesSince, timeOfDay } from '@ros/shared/domain';
import { KitchenTicket, OrderItem, Station, TicketStatus } from '@ros/shared/domain';
import { describeItem } from '@ros/shared/domain';
import { RestaurantApi } from '@ros/shared/data-access';

interface TicketView {
  ticket: KitchenTicket;
  items: OrderItem[];
}

const LANES: { status: TicketStatus; title: string; icon: string }[] = [
  { status: 'Queued', title: 'New', icon: 'pi-inbox' },
  { status: 'InProgress', title: 'Preparing', icon: 'pi-hourglass' },
  { status: 'Ready', title: 'Ready to serve', icon: 'pi-bell' },
];

@Component({
  selector: 'app-kitchen-board',
  imports: [UserMenu, RosButton],
  templateUrl: './kitchen-board.html',
  styleUrl: './kitchen-board.scss',
})
export class KitchenBoard {
  private readonly api = inject(RestaurantApi);
  private readonly clock = inject(Clock);
  private readonly toast = inject(Notifier);

  protected readonly cafe = this.api.cafe;
  protected readonly lanes = LANES;
  protected readonly stations: ('All' | Station)[] = ['All', 'Kitchen', 'Bar'];
  protected readonly describeItem = describeItem;
  protected readonly now = this.clock.now;

  protected readonly station = signal<'All' | Station>('All');
  protected readonly soundOn = signal(false);
  protected readonly pending = signal<string | null>(null);
  private audio: AudioContext | null = null;

  protected readonly views = computed<TicketView[]>(() => {
    const orders = new Map(this.api.orders().map(o => [o.id, o]));
    const station = this.station();
    return this.api.tickets()
      .filter(t => station === 'All' || t.station === station)
      .filter(t => {
        const order = orders.get(t.orderId);
        return !!order && order.status !== 'Served' && order.status !== 'Cancelled';
      })
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(t => ({ ticket: t, items: orders.get(t.orderId)!.items.filter(i => t.itemIds.includes(i.id)) }));
  });
  protected readonly byLane = computed(() => {
    const lanes: Record<TicketStatus, TicketView[]> = { Queued: [], InProgress: [], Ready: [] };
    for (const v of this.views()) lanes[v.ticket.status].push(v);
    return lanes;
  });
  protected readonly avgPrepMinutes = computed(() => {
    const start = new Date().setHours(0, 0, 0, 0);
    const done = this.api.tickets().filter(t => t.readyAt && t.createdAt >= start);
    if (!done.length) return 0;
    return Math.round(done.reduce((s, t) => s + (t.readyAt! - t.createdAt), 0) / done.length / 60_000);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.audio?.close());

    let known: Set<string> | null = null;
    effect(() => {
      const queued = this.api.tickets().filter(t => t.status === 'Queued').map(t => t.id);
      const hasNew = known !== null && queued.some(id => !known!.has(id));
      known = new Set(queued);
      if (hasNew && this.soundOn()) this.chime();
    });
  }

  protected elapsedFor(t: KitchenTicket): string {
    return elapsed(t.status === 'Ready' ? t.readyAt ?? t.createdAt : t.createdAt, this.now());
  }

  protected ageLevel(t: KitchenTicket): 'ok' | 'warn' | 'late' {
    if (t.status === 'Ready') return 'ok';
    const m = minutesSince(t.createdAt, this.now());
    return m >= 15 ? 'late' : m >= 8 ? 'warn' : 'ok';
  }

  protected isFresh(t: KitchenTicket): boolean {
    return t.status === 'Queued' && this.now() - t.createdAt < 20_000;
  }

  protected clockLabel(): string {
    return timeOfDay(this.now());
  }

  protected toggleSound(): void {
    this.soundOn.update(on => !on);
    if (this.soundOn()) {
      this.audio ??= new AudioContext();
      this.chime();
    }
  }

  protected async move(t: KitchenTicket, status: TicketStatus): Promise<void> {
    this.pending.set(t.id);
    try {
      await this.api.setTicketStatus(t.id, status);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: (e as Error).message, life: 3000 });
    } finally {
      this.pending.set(null);
    }
  }

  private chime(): void {
    if (!this.audio) return;
    const ctx = this.audio;
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.3);
    });
  }
}
