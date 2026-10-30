import { Injectable, signal } from '@angular/core';

/** One shared ticking clock so timers across a screen stay in step. */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(Date.now());

  constructor() {
    setInterval(() => this.now.set(Date.now()), 1000);
  }
}
