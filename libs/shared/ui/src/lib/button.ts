import { booleanAttribute, Component, computed, input, output } from '@angular/core';
import { MatButton, MatButtonAppearance } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

/** Thin wrapper over Material buttons that adds our severities, sizes and a loading state. */
@Component({
  selector: 'ros-button',
  imports: [MatButton, MatProgressSpinner],
  host: { '[class.fluid]': 'fluid()' },
  template: `
    <button [matButton]="appearance()" [type]="type()" class="ros-btn ros-btn-{{ severity() }} ros-btn-{{ size() }}"
            [disabled]="disabled() || loading()" [attr.aria-busy]="loading() || null" (click)="pressed.emit($event)">
      @if (loading()) {
        <mat-spinner diameter="18" aria-hidden="true" />
      } @else if (icon()) {
        <i class="pi {{ icon() }}" aria-hidden="true"></i>
      }
      @if (label()) { <span>{{ label() }}</span> }
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    :host(.fluid) { display: flex; width: 100%; }
    .ros-btn { flex: 1; gap: .5rem; white-space: nowrap; --mat-button-filled-container-shape: 10px; --mat-button-outlined-container-shape: 10px; --mat-button-tonal-container-shape: 10px; }
    .ros-btn i { margin-right: .45rem; }
    .ros-btn mat-spinner { margin-right: .45rem; display: inline-block; vertical-align: middle; --mat-progress-spinner-active-indicator-color: currentColor; }
    .ros-btn-small { --mat-button-filled-container-height: 34px; --mat-button-outlined-container-height: 34px; --mat-button-tonal-container-height: 34px; font-size: .85rem; }
    .ros-btn-normal { --mat-button-filled-container-height: 42px; --mat-button-outlined-container-height: 42px; --mat-button-tonal-container-height: 42px; }
    .ros-btn-large { --mat-button-filled-container-height: 52px; --mat-button-outlined-container-height: 52px; --mat-button-tonal-container-height: 52px; font-size: 1.05rem; }
    .ros-btn-success { --mat-button-filled-container-color: #15803d; --mat-button-filled-label-text-color: #fff; }
    .ros-btn-secondary { --mat-button-outlined-label-text-color: currentColor; --mat-button-outlined-outline-color: currentColor; }
  `,
})
export class RosButton {
  readonly label = input<string>();
  readonly icon = input<string>();
  readonly severity = input<'primary' | 'secondary' | 'success'>('primary');
  readonly size = input<'small' | 'normal' | 'large'>('normal');
  readonly type = input<'button' | 'submit'>('button');
  readonly fluid = input(false, { transform: booleanAttribute });
  readonly outlined = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly pressed = output<MouseEvent>();

  protected readonly appearance = computed<MatButtonAppearance>(() => {
    if (this.outlined()) return 'outlined';
    return this.severity() === 'secondary' ? 'tonal' : 'filled';
  });
}
