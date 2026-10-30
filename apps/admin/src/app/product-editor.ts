import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatOption } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { RestaurantApi } from '@ros/shared/data-access';
import { FoodType, Product, ProductVariant, Station } from '@ros/shared/domain';
import { Notifier, RosButton } from '@ros/shared/ui';

export interface ProductEditorData {
  product?: Product;
}

const EMOJI_CHOICES = ['☕', '🫖', '🧋', '🥤', '🍋', '🥭', '🍳', '🥑', '🥞', '🥐', '🥪', '🌯', '🍕', '🍝', '🍔', '🍟', '🥗', '🍛', '🍜', '🍰', '🍫', '🍮', '🍦', '🍩'];

@Component({
  selector: 'app-product-editor',
  imports: [
    MatButtonToggle, MatButtonToggleGroup, MatDialogActions, MatDialogContent, MatDialogTitle, MatError, MatFormField, MatHint,
    MatInput, MatLabel, MatOption, MatPrefix, MatSelect, MatSlideToggle, ReactiveFormsModule, RosButton,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.product ? 'Edit item' : 'Add item' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="form" (ngSubmit)="save()" id="product-form" novalidate>
        <div class="emoji-row">
          <span class="emoji-preview" aria-hidden="true">{{ form.controls.emoji.value || '🍽️' }}</span>
          <div class="emoji-picks" role="group" aria-label="Picture">
            @for (e of emojis; track e) {
              <button type="button" class="pick" [class.on]="form.controls.emoji.value === e" (click)="form.controls.emoji.setValue(e)" [attr.aria-label]="'Use ' + e">{{ e }}</button>
            }
          </div>
        </div>

        <div class="grid">
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Item name</mat-label>
            <input matInput formControlName="name" maxlength="60" required />
            @if (form.controls.name.hasError('required')) { <mat-error>Item name is required.</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="2" maxlength="200"></textarea>
            <mat-hint align="end">{{ form.controls.description.value.length }}/200</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Category</mat-label>
            <mat-select formControlName="categoryId" required>
              @for (c of api.catalog().categories; track c.id) { <mat-option [value]="c.id">{{ c.icon }} {{ c.name }}</mat-option> }
            </mat-select>
            @if (form.controls.categoryId.hasError('required')) { <mat-error>Choose a category.</mat-error> }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Prep time (minutes)</mat-label>
            <input matInput type="number" formControlName="prepMinutes" min="1" max="120" required />
            @if (form.controls.prepMinutes.invalid) { <mat-error>Between 1 and 120 minutes.</mat-error> }
          </mat-form-field>

          <div class="field-block">
            <span class="label">Food type</span>
            <mat-button-toggle-group formControlName="foodType" aria-label="Food type" hideSingleSelectionIndicator>
              <mat-button-toggle value="veg">Veg</mat-button-toggle>
              <mat-button-toggle value="egg">Egg</mat-button-toggle>
              <mat-button-toggle value="nonveg">Non-veg</mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <div class="field-block">
            <span class="label">Kitchen station</span>
            <mat-button-toggle-group formControlName="station" aria-label="Kitchen station" hideSingleSelectionIndicator>
              <mat-button-toggle value="Kitchen">Kitchen</mat-button-toggle>
              <mat-button-toggle value="Bar">Bar</mat-button-toggle>
            </mat-button-toggle-group>
          </div>
        </div>

        <section class="variants" formArrayName="variants">
          <div class="sec-head">
            <h3>Sizes & prices <small>excl. GST</small></h3>
            <button type="button" class="link" (click)="addVariant()"><i class="pi pi-plus" aria-hidden="true"></i> Add size</button>
          </div>
          @for (v of form.controls.variants.controls; track v; let i = $index) {
            <div class="variant" [formGroupName]="i">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Size name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Regular" required />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Price</mat-label>
                <span matTextPrefix class="rupee">₹&nbsp;</span>
                <input matInput type="number" formControlName="price" min="1" required />
              </mat-form-field>
              <button type="button" class="icon-btn" [disabled]="form.controls.variants.length === 1" (click)="removeVariant(i)" [attr.aria-label]="'Remove size ' + (i + 1)">
                <i class="pi pi-trash" aria-hidden="true"></i>
              </button>
            </div>
          }
        </section>

        <mat-form-field appearance="outline">
          <mat-label>Add-on groups</mat-label>
          <mat-select formControlName="modifierGroupIds" multiple>
            @for (g of groups(); track g.id) {
              <mat-option [value]="g.id">{{ g.name }} · {{ g.modifiers.length }} options{{ g.min ? ' (required)' : '' }}</mat-option>
            }
          </mat-select>
          <mat-hint>Guests choose these when ordering, e.g. milk type or toppings.</mat-hint>
        </mat-form-field>

        <mat-slide-toggle formControlName="popular">Show in “Popular items”</mat-slide-toggle>

        @if (error()) { <p class="error" role="alert"><i class="pi pi-exclamation-circle" aria-hidden="true"></i> {{ error() }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <ros-button label="Cancel" severity="secondary" (pressed)="ref.close()" />
      <ros-button type="submit" form="product-form" [label]="data.product ? 'Save changes' : 'Add item'" icon="pi-check" [loading]="saving()" (pressed)="save()" />
    </mat-dialog-actions>
  `,
  styles: `
    .form { display: flex; flex-direction: column; gap: .9rem; padding-top: .4rem; }
    .emoji-row { display: flex; gap: 1rem; align-items: center; }
    .emoji-preview { flex: none; width: 76px; height: 76px; border-radius: 50%; display: grid; place-items: center; font-size: 2.6rem; background: var(--brand-soft); }
    .emoji-picks { display: flex; flex-wrap: wrap; gap: .3rem; }
    .pick { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); font-size: 1.2rem; cursor: pointer; }
    .pick.on { border-color: var(--brand); background: var(--brand-soft); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
    .span-2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
    .field-block { display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1.2rem; }
    .label { font-size: .82rem; color: var(--muted); }
    .variants { display: flex; flex-direction: column; gap: .6rem; padding: .9rem; border-radius: 14px; background: var(--surface); border: 1px solid var(--line-soft); }
    .sec-head { display: flex; justify-content: space-between; align-items: center; }
    .sec-head h3 { margin: 0; font-size: .95rem; } .sec-head small { color: var(--muted); font-weight: 400; }
    .variant { display: grid; grid-template-columns: 1fr 160px 40px; gap: .6rem; align-items: center; }
    .rupee { color: var(--muted); padding-left: .2rem; }
    .icon-btn { width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--muted); cursor: pointer; }
    .icon-btn:disabled { opacity: .35; cursor: default; }
    .link { border: 0; background: none; color: var(--brand-strong); font: inherit; font-weight: 600; cursor: pointer; display: flex; gap: .35rem; align-items: center; }
    .error { margin: 0; color: #b91c1c; display: flex; gap: .4rem; align-items: center; }
  `,
})
export class ProductEditor {
  protected readonly data = inject<ProductEditorData>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<ProductEditor, Product>>(MatDialogRef);
  protected readonly api = inject(RestaurantApi);
  private readonly notifier = inject(Notifier);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly emojis = EMOJI_CHOICES;
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly groups = () => Object.values(this.api.catalog().modifierGroups);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', Validators.maxLength(200)],
    categoryId: [this.api.catalog().categories[0]?.id ?? '', Validators.required],
    emoji: ['🍽️'],
    foodType: ['veg' as FoodType],
    station: ['Kitchen' as Station],
    prepMinutes: [10, [Validators.required, Validators.min(1), Validators.max(120)]],
    popular: [false],
    modifierGroupIds: [[] as string[]],
    variants: this.fb.array([this.variantGroup({ id: '', name: 'Standard', price: 0 })]),
  });

  constructor() {
    const p = this.data.product;
    if (p) {
      this.form.patchValue({
        name: p.name, description: p.description, categoryId: p.categoryId, emoji: p.emoji, foodType: p.foodType,
        station: p.station, prepMinutes: p.prepMinutes, popular: !!p.popular, modifierGroupIds: [...p.modifierGroupIds],
      });
      this.form.controls.variants.clear();
      for (const v of p.variants) this.form.controls.variants.push(this.variantGroup(v));
    }
  }

  protected addVariant(): void {
    this.form.controls.variants.push(this.variantGroup({ id: '', name: '', price: 0 }));
  }

  protected removeVariant(index: number): void {
    if (this.form.controls.variants.length > 1) this.form.controls.variants.removeAt(index);
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please fix the highlighted fields.');
      return;
    }
    const v = this.form.getRawValue();
    const product: Product = {
      id: this.data.product?.id ?? '',
      categoryId: v.categoryId, name: v.name, description: v.description, emoji: v.emoji, foodType: v.foodType,
      station: v.station, prepMinutes: Number(v.prepMinutes), popular: v.popular, modifierGroupIds: v.modifierGroupIds,
      variants: v.variants.map(x => ({ id: x.id, name: x.name, price: Number(x.price) })),
    };
    this.saving.set(true);
    this.error.set('');
    try {
      const saved = await this.api.saveProduct(product);
      this.notifier.add({ severity: 'success', summary: `${saved.name} ${this.data.product ? 'updated' : 'added to the menu'}` });
      this.ref.close(saved);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.saving.set(false);
    }
  }

  private variantGroup(v: ProductVariant) {
    return this.fb.group({
      id: [v.id],
      name: [v.name, Validators.required],
      price: [v.price, [Validators.required, Validators.min(1)]],
    });
  }
}
