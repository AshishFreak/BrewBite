import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { RestaurantApi } from '@ros/shared/data-access';
import { MenuCategory } from '@ros/shared/domain';
import { confirmAction, Notifier, RosButton } from '@ros/shared/ui';

interface Draft {
  id: string;
  icon: string;
  name: string;
}

@Component({
  selector: 'app-categories-dialog',
  imports: [MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, RosButton],
  template: `
    <h2 mat-dialog-title>Menu categories</h2>
    <mat-dialog-content>
      <p class="hint">Categories appear as tiles on the guest menu and POS, in this order.</p>
      <ul class="list">
        @for (c of rows(); track c.category.id) {
          <li>
            <input class="icon" [value]="draftFor(c.category).icon" maxlength="4" (input)="edit(c.category, 'icon', $event)" [attr.aria-label]="c.category.name + ' icon'" />
            <input class="name" [value]="draftFor(c.category).name" maxlength="40" (input)="edit(c.category, 'name', $event)" [attr.aria-label]="'Category name'" />
            <span class="count">{{ c.count }} item{{ c.count === 1 ? '' : 's' }}</span>
            @if (isDirty(c.category)) {
              <button type="button" class="act save" (click)="save(c.category)" [disabled]="busy()"><i class="pi pi-check" aria-hidden="true"></i> Save</button>
            }
            <button type="button" class="act" [disabled]="c.count > 0 || busy()" (click)="remove(c.category)"
                    [attr.aria-label]="'Delete ' + c.category.name" [title]="c.count > 0 ? 'Move or delete its items first' : 'Delete category'">
              <i class="pi pi-trash" aria-hidden="true"></i>
            </button>
          </li>
        }
      </ul>
      <div class="add">
        <input class="icon" [value]="newIcon()" maxlength="4" (input)="newIcon.set($any($event.target).value)" aria-label="New category icon" />
        <input class="name" [value]="newName()" maxlength="40" placeholder="New category name" (input)="newName.set($any($event.target).value)" (keydown.enter)="add()" aria-label="New category name" />
        <ros-button label="Add" icon="pi-plus" [disabled]="!newName().trim() || busy()" (pressed)="add()" />
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <ros-button label="Done" [mat-dialog-close]="true" />
    </mat-dialog-actions>
  `,
  styles: `
    .hint { margin: 0 0 .8rem; color: var(--muted); }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: .5rem; }
    li, .add { display: flex; gap: .5rem; align-items: center; }
    .add { margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--line); }
    input { font: inherit; height: 42px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text); padding: 0 .7rem; }
    input:focus { outline: none; border-color: var(--brand); }
    .icon { width: 54px; text-align: center; font-size: 1.2rem; }
    .name { flex: 1; min-width: 0; }
    .count { width: 64px; color: var(--muted); font-size: .82rem; text-align: right; }
    .act { height: 38px; min-width: 38px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--muted); cursor: pointer; font: inherit; display: flex; gap: .3rem; align-items: center; justify-content: center; padding: 0 .6rem; }
    .act:disabled { opacity: .35; cursor: default; }
    .act.save { color: #fff; background: var(--brand); border-color: var(--brand); }
  `,
})
export class CategoriesDialog {
  private readonly api = inject(RestaurantApi);
  private readonly notifier = inject(Notifier);
  private readonly dialog = inject(MatDialog);

  protected readonly busy = signal(false);
  protected readonly newIcon = signal('🍽️');
  protected readonly newName = signal('');
  private readonly drafts = signal<Record<string, Draft>>({});
  protected readonly rows = computed(() => {
    const products = this.api.catalog().products;
    return this.api.catalog().categories.map(category => ({ category, count: products.filter(p => p.categoryId === category.id).length }));
  });

  protected draftFor(c: MenuCategory): Draft {
    return this.drafts()[c.id] ?? c;
  }

  protected isDirty(c: MenuCategory): boolean {
    const d = this.drafts()[c.id];
    return !!d && (d.name !== c.name || d.icon !== c.icon);
  }

  protected edit(c: MenuCategory, field: 'icon' | 'name', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.drafts.update(all => ({ ...all, [c.id]: { ...this.draftFor(c), [field]: value } }));
  }

  protected async save(c: MenuCategory): Promise<void> {
    await this.run(async () => {
      const saved = await this.api.saveCategory({ ...this.draftFor(c), id: c.id });
      this.drafts.update(({ [c.id]: _, ...rest }) => rest);
      this.notifier.add({ severity: 'success', summary: `Saved “${saved.name}”` });
    });
  }

  protected async add(): Promise<void> {
    if (!this.newName().trim()) return;
    await this.run(async () => {
      const saved = await this.api.saveCategory({ id: '', icon: this.newIcon(), name: this.newName() });
      this.newName.set('');
      this.newIcon.set('🍽️');
      this.notifier.add({ severity: 'success', summary: `Added “${saved.name}”` });
    });
  }

  protected async remove(c: MenuCategory): Promise<void> {
    const ok = await confirmAction(this.dialog, { title: 'Delete category?', message: `“${c.name}” will be removed from the menu.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    await this.run(async () => {
      await this.api.deleteCategory(c.id);
      this.notifier.add({ severity: 'success', summary: `Deleted “${c.name}”` });
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (e) {
      this.notifier.add({ severity: 'error', summary: (e as Error).message, life: 5000 });
    } finally {
      this.busy.set(false);
    }
  }
}
