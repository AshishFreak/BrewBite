import { UserMenu } from '@ros/shared/auth';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Notifier } from '@ros/shared/ui';
import { Clock } from '@ros/shared/data-access';
import { elapsed } from '@ros/shared/domain';
import { DiningTable } from '@ros/shared/domain';
import { isActiveSession } from '@ros/shared/domain';
import { RestaurantApi } from '@ros/shared/data-access';
import { InrPipe } from '@ros/shared/ui';

type TileState = 'Available' | 'Occupied' | 'Reserved' | 'Cleaning' | 'BillRequested' | 'Paying';

interface Alert {
  kind: 'waiter' | 'bill' | 'ready';
  tableId: string;
  tableCode: string;
  sessionId: string;
  at: number;
  text: string;
}

const TILE_META: Record<TileState, { label: string; icon: string }> = {
  Available: { label: 'Available', icon: 'pi-circle' },
  Occupied: { label: 'Occupied', icon: 'pi-users' },
  Reserved: { label: 'Reserved', icon: 'pi-bookmark' },
  Cleaning: { label: 'Needs cleaning', icon: 'pi-sparkles' },
  BillRequested: { label: 'Bill requested', icon: 'pi-receipt' },
  Paying: { label: 'Paying', icon: 'pi-wallet' },
};

@Component({
  selector: 'app-pos-floor',
  imports: [UserMenu, InrPipe],
  templateUrl: './pos-floor.html',
  styleUrl: './pos-floor.scss',
})
export class PosFloor {
  private readonly api = inject(RestaurantApi);
  private readonly clock = inject(Clock);
  private readonly router = inject(Router);
  private readonly toast = inject(Notifier);

  protected readonly cafe = this.api.cafe;
  protected readonly meta = TILE_META;
  protected readonly legend = Object.entries(TILE_META) as [TileState, { label: string; icon: string }][];

  protected readonly tiles = computed(() => {
    const sessions = this.api.sessions().filter(isActiveSession);
    const orders = this.api.orders();
    return this.api.tables().map(table => {
      const session = sessions.find(s => s.tableId === table.id);
      const sessionOrders = session ? orders.filter(o => o.sessionId === session.id && o.status !== 'Cancelled') : [];
      let state: TileState = table.status;
      if (session) state = session.status === 'BillRequested' ? 'BillRequested' : session.status === 'Settling' ? 'Paying' : 'Occupied';
      return {
        table, session, state,
        total: sessionOrders.reduce((s, o) => s + o.subTotal, 0),
        ready: sessionOrders.filter(o => o.status === 'Ready').length,
        cooking: sessionOrders.filter(o => o.status === 'Submitted' || o.status === 'Preparing').length,
      };
    });
  });
  protected readonly areas = computed(() => {
    const names = [...new Set(this.tiles().map(t => t.table.area))];
    return names.map(name => ({ name, tiles: this.tiles().filter(t => t.table.area === name) }));
  });
  protected readonly occupied = computed(() => this.tiles().filter(t => t.session).length);
  protected readonly openValue = computed(() => this.tiles().reduce((s, t) => s + t.total, 0));

  protected readonly alerts = computed<Alert[]>(() => {
    const list: Alert[] = [];
    for (const { table, session } of this.tiles()) {
      if (!session) continue;
      const base = { tableId: table.id, tableCode: table.code, sessionId: session.id };
      if (session.waiterCalledAt) list.push({ ...base, kind: 'waiter', at: session.waiterCalledAt, text: session.waiterReason ? `Calling staff: ${session.waiterReason}` : 'Guest is calling for staff' });
      if (session.status === 'BillRequested') list.push({ ...base, kind: 'bill', at: session.billRequestedAt ?? session.openedAt, text: 'Bill requested' });
    }
    for (const o of this.api.orders()) {
      if (o.status !== 'Ready' || !o.tableId) continue;
      const table = this.api.tables().find(t => t.id === o.tableId);
      const readyAt = Math.max(...this.api.tickets().filter(t => t.orderId === o.id).map(t => t.readyAt ?? o.createdAt));
      if (table && o.sessionId) {
        list.push({ kind: 'ready', tableId: table.id, tableCode: table.code, sessionId: o.sessionId, at: readyAt, text: `Order #${o.number} ready to serve` });
      }
    }
    return list.sort((a, b) => b.at - a.at);
  });

  protected since(at: number): string {
    return elapsed(at, this.clock.now());
  }

  protected async openTile(table: DiningTable, state: TileState): Promise<void> {
    if (state === 'Cleaning') {
      try {
        await this.api.markTableClean(table.id);
        this.toast.add({ severity: 'success', summary: `${table.code} is ready for guests`, life: 2000 });
      } catch (e) {
        this.toast.add({ severity: 'error', summary: (e as Error).message, life: 3000 });
      }
      return;
    }
    await this.router.navigate(['/table', table.id]);
  }

  protected goTo(tableId: string): void {
    void this.router.navigate(['/table', tableId]);
  }

  protected async dismiss(alert: Alert): Promise<void> {
    await this.api.acknowledgeWaiter(alert.sessionId);
  }
}
