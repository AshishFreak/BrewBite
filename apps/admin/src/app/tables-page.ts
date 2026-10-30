import { Component, computed, DOCUMENT, inject, InjectionToken } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { Clock, RestaurantApi } from '@ros/shared/data-access';
import { elapsed, isActiveSession } from '@ros/shared/domain';
import { InrPipe } from '@ros/shared/ui';

/** Full address of the guest app (what the table QR codes point to). Defaults to the `guest` folder next to this app. */
export const GUEST_APP_URL = new InjectionToken<string>('GUEST_APP_URL', {
  factory: () => new URL('../guest', inject(DOCUMENT).baseURI).href,
});

@Component({
  selector: 'app-tables-page',
  imports: [InrPipe, MatTableModule],
  template: `
    <header class="page-head">
      <h1>Tables & QR</h1>
      <p>{{ occupied() }} of {{ rows().length }} tables occupied. Each table's QR code opens the guest ordering link below.</p>
    </header>
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="code">
          <th mat-header-cell *matHeaderCellDef>Table</th>
          <td mat-cell *matCellDef="let r"><strong class="code">{{ r.table.code }}</strong></td>
        </ng-container>
        <ng-container matColumnDef="area">
          <th mat-header-cell *matHeaderCellDef>Area</th>
          <td mat-cell *matCellDef="let r">{{ r.table.area }}</td>
        </ng-container>
        <ng-container matColumnDef="capacity">
          <th mat-header-cell *matHeaderCellDef>Seats</th>
          <td mat-cell *matCellDef="let r">{{ r.table.capacity }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Status</th>
          <td mat-cell *matCellDef="let r"><span class="status st-{{ r.status }}"><i class="pi {{ r.icon }}" aria-hidden="true"></i> {{ r.label }}</span></td>
        </ng-container>
        <ng-container matColumnDef="session">
          <th mat-header-cell *matHeaderCellDef>Current visit</th>
          <td mat-cell *matCellDef="let r">
            @if (r.session) { {{ r.session.guestCount }} guests · {{ since(r.session.openedAt) }} · <strong>{{ r.total | inr }}</strong> } @else { <span class="muted">—</span> }
          </td>
        </ng-container>
        <ng-container matColumnDef="qr">
          <th mat-header-cell *matHeaderCellDef>Guest link</th>
          <td mat-cell *matCellDef="let r">
            <a class="link" [href]="r.url" target="_blank" rel="noopener"><i class="pi pi-external-link" aria-hidden="true"></i> {{ r.url }}</a>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let r; columns: columns"></tr>
      </table>
    </div>
    <p class="note muted">Prototype data: links use the readable table code. Production QR codes carry an opaque, revocable token instead.</p>
  `,
  styles: `
    .page-head h1 { margin: 0; font-size: 1.5rem; }
    .page-head p { margin: .3rem 0 1rem; color: var(--muted); }
    .table-wrap { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow-x: auto; }
    table { width: 100%; min-width: 760px; background: transparent; }
    .code { font-size: 1.1rem; }
    .status { display: inline-flex; gap: .35rem; align-items: center; font-weight: 600; font-size: .88rem; }
    .st-Available { color: #15803d; } .st-Occupied { color: #1d4ed8; } .st-Reserved { color: #7e22ce; }
    .st-Cleaning { color: #475569; } .st-BillRequested { color: #c2410c; } .st-Paying { color: #a16207; }
    .link { color: var(--brand-strong); text-decoration: none; font-size: .88rem; display: inline-flex; gap: .35rem; align-items: center; }
    .muted { color: var(--muted); }
    .note { font-size: .85rem; margin-top: .8rem; }
  `,
})
export class TablesPage {
  private readonly api = inject(RestaurantApi);
  private readonly clock = inject(Clock);
  private readonly guestUrl = inject(GUEST_APP_URL);

  protected readonly columns = ['code', 'area', 'capacity', 'status', 'session', 'qr'];
  protected readonly rows = computed(() => {
    const sessions = this.api.sessions().filter(isActiveSession);
    const orders = this.api.orders();
    return this.api.tables().map(table => {
      const session = sessions.find(s => s.tableId === table.id);
      const status = session ? (session.status === 'BillRequested' ? 'BillRequested' : session.status === 'Settling' ? 'Paying' : 'Occupied') : table.status;
      const meta = STATUS[status];
      const total = session ? orders.filter(o => o.sessionId === session.id && o.status !== 'Cancelled').reduce((s, o) => s + o.subTotal, 0) : 0;
      return { table, session, status, ...meta, total, url: `${this.guestUrl}/t/${table.code}` };
    });
  });
  protected readonly occupied = computed(() => this.rows().filter(r => r.session).length);

  protected since(at: number): string {
    return elapsed(at, this.clock.now());
  }
}

const STATUS: Record<string, { label: string; icon: string }> = {
  Available: { label: 'Available', icon: 'pi-circle' },
  Occupied: { label: 'Occupied', icon: 'pi-users' },
  Reserved: { label: 'Reserved', icon: 'pi-bookmark' },
  Cleaning: { label: 'Needs cleaning', icon: 'pi-sparkles' },
  BillRequested: { label: 'Bill requested', icon: 'pi-receipt' },
  Paying: { label: 'Paying', icon: 'pi-wallet' },
};
