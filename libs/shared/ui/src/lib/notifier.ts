import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface Notice {
  severity?: 'success' | 'info' | 'warn' | 'error';
  summary: string;
  detail?: string;
  life?: number;
}

/** App-wide notifications on top of MatSnackBar, with severity styling. */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly snackBar = inject(MatSnackBar);

  add(notice: Notice): void {
    const severity = notice.severity ?? 'info';
    this.snackBar.open(notice.detail ? `${notice.summary} · ${notice.detail}` : notice.summary, 'Dismiss', {
      duration: notice.life ?? 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['ros-snack', `ros-snack-${severity}`],
      politeness: severity === 'error' ? 'assertive' : 'polite',
    });
  }
}
