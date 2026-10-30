import { Component, computed, input } from '@angular/core';
import { FoodType } from '@ros/shared/domain';

const LABELS: Record<FoodType, string> = { veg: 'Vegetarian', nonveg: 'Non-vegetarian', egg: 'Contains egg' };

/** FSSAI-style square food mark; shape differs per type so it never relies on colour alone. */
@Component({
  selector: 'ros-food-mark',
  template: `<span class="mark" [class]="type()" role="img" [attr.aria-label]="label()" [title]="label()"><span></span></span>`,
  styles: `
    :host { display: inline-flex; vertical-align: middle; }
    .mark { width: 14px; height: 14px; border: 1.5px solid; border-radius: 3px; display: inline-grid; place-items: center; }
    .mark span { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .veg { color: #15803d; }
    .nonveg { color: #b91c1c; }
    .nonveg span { border-radius: 0; width: 0; height: 0; background: none;
      border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 7px solid currentColor; }
    .egg { color: #ca8a04; }
    .egg span { border-radius: 1px; }
  `,
})
export class FoodMark {
  readonly type = input.required<FoodType>();
  protected readonly label = computed(() => LABELS[this.type()]);
}
