import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { RosButton } from './button';

export interface ConfirmData {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'ros-confirm-dialog',
  imports: [MatDialogActions, MatDialogClose, MatDialogContent, MatDialogTitle, RosButton],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content><p>{{ data.message }}</p></mat-dialog-content>
    <mat-dialog-actions align="end">
      <ros-button label="Cancel" severity="secondary" [mat-dialog-close]="false" />
      <ros-button [label]="data.confirmLabel ?? 'Confirm'" [class.danger]="data.danger" [mat-dialog-close]="true" />
    </mat-dialog-actions>
  `,
  styles: `
    p { margin: 0; color: var(--muted); line-height: 1.5; }
    .danger { --mat-button-filled-container-color: #b91c1c; }
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmData>(MAT_DIALOG_DATA);
}

/** Opens a confirmation dialog and resolves true only when the user confirms. */
export async function confirmAction(dialog: MatDialog, data: ConfirmData): Promise<boolean> {
  const result = await firstValueFrom(dialog.open(ConfirmDialog, { data, width: '420px', panelClass: 'ros-dialog' }).afterClosed());
  return result === true;
}
