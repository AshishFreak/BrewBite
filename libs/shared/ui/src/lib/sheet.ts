import { Component, effect, inject, input, model, TemplateRef, untracked, viewChild } from '@angular/core';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

/**
 * Declarative wrapper over MatDialog / MatBottomSheet: bind `[(visible)]` and project content.
 * `variant="sheet"` docks to the bottom on phones; `dialog` is a centred modal.
 */
@Component({
  selector: 'ros-sheet',
  template: `
    <ng-template #content>
      <div class="ros-sheet">
        <header class="head" [class.floating]="!header()">
          @if (header()) { <h2>{{ header() }}</h2> }
          <button type="button" class="x" aria-label="Close" (click)="visible.set(false)"><i class="pi pi-times" aria-hidden="true"></i></button>
        </header>
        <div class="body"><ng-content /></div>
      </div>
    </ng-template>
  `,
  styles: `
    .ros-sheet { display: flex; flex-direction: column; max-height: inherit; color: var(--text); }
    .head { display: flex; align-items: center; gap: 1rem; padding: .9rem 1.1rem .3rem; }
    .head h2 { margin: 0; font-size: 1.2rem; font-weight: 700; }
    .head.floating { position: absolute; top: .7rem; right: .7rem; z-index: 2; padding: 0; }
    .head.floating .x { background: rgb(255 255 255 / .9); box-shadow: 0 2px 8px rgb(0 0 0 / .12); }
    .ros-sheet { position: relative; }
    .x { margin-left: auto; width: 36px; height: 36px; border-radius: 50%; border: 0; background: var(--chip); color: var(--text); cursor: pointer; }
    .body { padding: .3rem 1.1rem 1.1rem; overflow: auto; min-height: 0; }
  `,
})
export class Sheet {
  readonly visible = model(false);
  readonly header = input('');
  readonly label = input('Dialog');
  readonly variant = input<'dialog' | 'sheet'>('dialog');
  readonly width = input('560px');

  private readonly content = viewChild.required<TemplateRef<unknown>>('content');
  private readonly dialog = inject(MatDialog);
  private readonly bottomSheet = inject(MatBottomSheet);
  private ref: MatDialogRef<unknown> | MatBottomSheetRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const open = this.visible();
      untracked(() => (open ? this.open() : this.close()));
    });
  }

  private open(): void {
    if (this.ref) return;
    const ariaLabel = this.header() || this.label();
    const ref = this.variant() === 'sheet'
      ? this.bottomSheet.open(this.content(), { ariaLabel, panelClass: 'ros-bottom-sheet', autoFocus: 'dialog' })
      : this.dialog.open(this.content(), { ariaLabel, width: this.width(), maxWidth: '96vw', maxHeight: '92dvh', panelClass: 'ros-dialog', autoFocus: 'dialog' });
    this.ref = ref;
    const closed = 'afterDismissed' in ref ? ref.afterDismissed() : ref.afterClosed();
    closed.subscribe(() => {
      if (this.ref === ref) this.ref = null;
      if (this.visible()) this.visible.set(false);
    });
  }

  private close(): void {
    const ref = this.ref;
    this.ref = null;
    if (ref && 'dismiss' in ref) ref.dismiss();
    else ref?.close();
  }
}
