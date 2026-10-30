import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { RosButton } from './button';
import { CartLine, defaultModifierIds, ModifierGroup, Product, round2 } from '@ros/shared/domain';
import { FoodMark } from './food-mark';
import { InrPipe } from './inr.pipe';

/** Variant + modifier picker shared by the guest app and the POS. */
@Component({
  selector: 'ros-product-options',
  imports: [RosButton, FoodMark, InrPipe],
  templateUrl: './product-options.html',
  styleUrl: './product-options.scss',
})
export class ProductOptions {
  readonly product = input.required<Product>();
  readonly modifierGroups = input.required<Record<string, ModifierGroup>>();
  readonly submitLabel = input('Add to cart');
  readonly showNotes = input(true);
  /** Large picture header for the guest app; POS turns it off for speed. */
  readonly hero = input(true);
  readonly added = output<Omit<CartLine, 'key'>>();

  protected readonly groups = computed(() => this.product().modifierGroupIds.map(id => this.modifierGroups()[id]));
  protected readonly variantId = linkedSignal(() => this.product().variants[0].id);
  protected readonly selected = linkedSignal(() => defaultModifierIds({ modifierGroups: this.modifierGroups() }, this.product()));
  protected readonly quantity = linkedSignal(() => (this.product(), 1));
  protected readonly notes = linkedSignal(() => (this.product(), ''));

  protected readonly unitPrice = computed(() => {
    const product = this.product();
    const variant = product.variants.find(v => v.id === this.variantId()) ?? product.variants[0];
    const extras = this.groups().flatMap(g => g.modifiers).filter(m => this.selected().includes(m.id));
    return round2(variant.price + extras.reduce((s, m) => s + m.price, 0));
  });
  protected readonly total = computed(() => round2(this.unitPrice() * this.quantity()));
  protected readonly valid = computed(() =>
    this.groups().every(g => {
      const n = g.modifiers.filter(m => this.selected().includes(m.id)).length;
      return n >= g.min && n <= g.max;
    }));

  protected readonly foodLabel = computed(() => FOOD_TYPE_LABEL[this.product().foodType]);

  protected ruleText(g: ModifierGroup): string {
    if (g.min === 1 && g.max === 1) return 'Choose 1';
    if (g.min === 0) return `Optional · up to ${g.max}`;
    return `Choose ${g.min}–${g.max}`;
  }

  protected isOn(modifierId: string): boolean {
    return this.selected().includes(modifierId);
  }

  protected toggle(g: ModifierGroup, modifierId: string): void {
    const inGroup = new Set(g.modifiers.map(m => m.id));
    const current = this.selected();
    if (g.max === 1) {
      const turningOff = current.includes(modifierId) && g.min === 0;
      this.selected.set([...current.filter(id => !inGroup.has(id)), ...(turningOff ? [] : [modifierId])]);
      return;
    }
    if (current.includes(modifierId)) {
      this.selected.set(current.filter(id => id !== modifierId));
    } else if (current.filter(id => inGroup.has(id)).length < g.max) {
      this.selected.set([...current, modifierId]);
    }
  }

  protected setNotes(event: Event): void {
    this.notes.set((event.target as HTMLTextAreaElement).value);
  }

  protected add(): void {
    if (!this.valid()) return;
    this.added.emit({
      productId: this.product().id,
      variantId: this.variantId(),
      modifierIds: [...this.selected()],
      quantity: this.quantity(),
      notes: this.notes().trim() || undefined,
    });
  }
}

export const FOOD_TYPE_LABEL = { veg: 'Vegetarian', nonveg: 'Non-veg', egg: 'Contains egg' } as const;
