import { Component, computed, inject, signal } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { RestaurantApi } from '@ros/shared/data-access';
import { Product } from '@ros/shared/domain';
import { confirmAction, FoodMark, InrPipe, Notifier, RosButton } from '@ros/shared/ui';
import { CategoriesDialog } from './categories-dialog';
import { ProductEditor, ProductEditorData } from './product-editor';

@Component({
  selector: 'app-menu-page',
  imports: [FoodMark, InrPipe, MatIconButton, MatTooltip, RosButton, MatButtonToggle, MatButtonToggleGroup, MatFormField, MatInput, MatLabel, MatPrefix, MatSlideToggle, MatTableModule],
  template: `
    <header class="page-head">
      <div class="title-row">
        <h1>Menu</h1>
        <div class="head-actions">
          <ros-button label="Categories" icon="pi-th-large" severity="secondary" (pressed)="openCategories()" />
          <ros-button label="Add item" icon="pi-plus" (pressed)="openEditor()" />
        </div>
      </div>
      <p>{{ rows().length }} items shown · {{ soldOutCount() }} sold out. Availability changes reach the guest app and POS instantly.</p>
    </header>

    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-label>Search items</mat-label>
        <i matPrefix class="pi pi-search" aria-hidden="true"></i>
        <input matInput [value]="query()" (input)="query.set($any($event.target).value)" />
      </mat-form-field>
      <mat-button-toggle-group [value]="category()" (change)="category.set($event.value)" aria-label="Category" hideSingleSelectionIndicator>
        <mat-button-toggle value="all">All</mat-button-toggle>
        @for (c of api.catalog().categories; track c.id) {
          <mat-button-toggle [value]="c.id">{{ c.name }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
    </div>

    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="item">
          <th mat-header-cell *matHeaderCellDef>Item</th>
          <td mat-cell *matCellDef="let r">
            <span class="item">
              <span class="emoji" aria-hidden="true">{{ r.product.emoji }}</span>
              <span class="item-text">
                <strong><ros-food-mark [type]="r.product.foodType" /> {{ r.product.name }}</strong>
                <small>{{ r.product.description }}</small>
              </span>
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="category">
          <th mat-header-cell *matHeaderCellDef>Category</th>
          <td mat-cell *matCellDef="let r">{{ r.category }}</td>
        </ng-container>
        <ng-container matColumnDef="price">
          <th mat-header-cell *matHeaderCellDef>Price (excl. GST)</th>
          <td mat-cell *matCellDef="let r">
            @for (v of r.product.variants; track v.id; let last = $last) {
              <span class="variant">@if (r.product.variants.length > 1) { {{ v.name }} } <strong>{{ v.price | inr }}</strong></span>@if (!last) { <br /> }
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="station">
          <th mat-header-cell *matHeaderCellDef>Station</th>
          <td mat-cell *matCellDef="let r">{{ r.product.station }}</td>
        </ng-container>
        <ng-container matColumnDef="available">
          <th mat-header-cell *matHeaderCellDef>Availability</th>
          <td mat-cell *matCellDef="let r">
            <mat-slide-toggle [checked]="!r.soldOut" [disabled]="pending() === r.product.id" (change)="toggle(r.product)"
                              [aria-label]="r.product.name + ' available'">
              {{ r.soldOut ? 'Sold out' : 'Available' }}
            </mat-slide-toggle>
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef><span class="sr-only">Actions</span></th>
          <td mat-cell *matCellDef="let r" class="actions">
            <button matIconButton type="button" matTooltip="Edit" [attr.aria-label]="'Edit ' + r.product.name" (click)="openEditor(r.product)"><i class="pi pi-pencil"></i></button>
            <button matIconButton type="button" matTooltip="Delete" [attr.aria-label]="'Delete ' + r.product.name" (click)="remove(r.product)"><i class="pi pi-trash"></i></button>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let r; columns: columns" [class.out]="r.soldOut"></tr>
        <tr class="mat-row" *matNoDataRow><td class="mat-cell empty" [attr.colspan]="columns.length">No items match “{{ query() }}”.</td></tr>
      </table>
    </div>
  `,
  styles: `
    .title-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .head-actions { display: flex; gap: .6rem; }
    .actions { white-space: nowrap; text-align: right; }
    .actions i { font-size: 1rem; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .page-head h1 { margin: 0; font-size: 1.5rem; }
    .page-head p { margin: .3rem 0 1rem; color: var(--muted); }
    .filters { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; margin-bottom: 1rem; }
    .search { width: min(320px, 100%); }
    .search i { margin: 0 .5rem 0 .8rem; color: var(--muted); }
    mat-button-toggle-group { flex-wrap: wrap; }
    .table-wrap { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow-x: auto; }
    table { width: 100%; min-width: 720px; background: transparent; }
    .item { display: flex; gap: .8rem; align-items: center; padding: .4rem 0; }
    .emoji { width: 44px; height: 44px; border-radius: 10px; display: grid; place-items: center; font-size: 1.5rem; background: var(--brand-soft); flex: none; }
    .item-text { display: flex; flex-direction: column; gap: .1rem; }
    .item-text strong { display: flex; gap: .4rem; align-items: center; }
    .item-text small { color: var(--muted); }
    .variant { font-size: .88rem; white-space: nowrap; }
    tr.out { background: #fef2f2; }
    .empty { padding: 2rem; text-align: center; color: var(--muted); }
  `,
})
export class MenuPage {
  protected readonly api = inject(RestaurantApi);
  private readonly notifier = inject(Notifier);
  private readonly dialog = inject(MatDialog);

  protected readonly columns = ['item', 'category', 'price', 'station', 'available', 'actions'];
  protected readonly query = signal('');
  protected readonly category = signal('all');
  protected readonly pending = signal<string | null>(null);

  protected readonly rows = computed(() => {
    const { categories, products } = this.api.catalog();
    const soldOut = new Set(this.api.soldOut());
    const q = this.query().trim().toLowerCase();
    return products
      .filter(p => this.category() === 'all' || p.categoryId === this.category())
      .filter(p => !q || p.name.toLowerCase().includes(q))
      .map(p => ({ product: p, soldOut: soldOut.has(p.id), category: categories.find(c => c.id === p.categoryId)?.name ?? '' }));
  });
  protected readonly soldOutCount = computed(() => this.api.soldOut().length);

  protected async toggle(product: Product): Promise<void> {
    this.pending.set(product.id);
    try {
      await this.api.toggleSoldOut(product.id);
      const out = this.api.soldOut().includes(product.id);
      this.notifier.add({ severity: out ? 'warn' : 'success', summary: `${product.name} is ${out ? 'sold out' : 'available again'}` });
    } catch (e) {
      this.notifier.add({ severity: 'error', summary: (e as Error).message });
    } finally {
      this.pending.set(null);
    }
  }

  protected openEditor(product?: Product): void {
    this.dialog.open<ProductEditor, ProductEditorData>(ProductEditor, {
      data: { product }, width: '720px', maxWidth: '96vw', maxHeight: '92dvh', panelClass: 'ros-dialog', autoFocus: 'first-tabbable',
    });
  }

  protected openCategories(): void {
    this.dialog.open(CategoriesDialog, { width: '560px', maxWidth: '96vw', panelClass: 'ros-dialog' });
  }

  protected async remove(product: Product): Promise<void> {
    const ok = await confirmAction(this.dialog, {
      title: `Delete ${product.name}?`,
      message: 'It disappears from the guest menu and POS immediately. Past orders and bills keep their details.',
      confirmLabel: 'Delete item',
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.deleteProduct(product.id);
      this.notifier.add({ severity: 'success', summary: `${product.name} removed from the menu` });
    } catch (e) {
      this.notifier.add({ severity: 'error', summary: (e as Error).message });
    }
  }
}
