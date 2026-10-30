import { Catalog, MenuCategory, Product } from './models';

/** Server-side checks for menu edits. Returns readable problems; an empty list means valid. */
export function validateProduct(product: Product, catalog: Catalog): string[] {
  const problems: string[] = [];
  const name = product.name.trim();
  if (!name) problems.push('Item name is required.');
  if (name.length > 60) problems.push('Item name must be 60 characters or fewer.');
  if (product.description.length > 200) problems.push('Description must be 200 characters or fewer.');
  if (!catalog.categories.some(c => c.id === product.categoryId)) problems.push('Choose a category.');
  if (!Number.isInteger(product.prepMinutes) || product.prepMinutes < 1 || product.prepMinutes > 120) {
    problems.push('Prep time must be between 1 and 120 minutes.');
  }
  if (product.variants.length === 0) problems.push('Add at least one size or price.');
  const variantNames = new Set<string>();
  for (const v of product.variants) {
    if (!v.name.trim()) problems.push('Every size needs a name.');
    if (!(v.price > 0) || v.price > 100_000) problems.push(`Price for "${v.name || 'size'}" must be more than ₹0.`);
    const key = v.name.trim().toLowerCase();
    if (variantNames.has(key)) problems.push(`Size "${v.name}" is listed twice.`);
    variantNames.add(key);
  }
  for (const id of product.modifierGroupIds) {
    if (!catalog.modifierGroups[id]) problems.push('An add-on group no longer exists.');
  }
  const duplicate = catalog.products.find(p => p.id !== product.id && p.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) problems.push(`An item called "${duplicate.name}" already exists.`);
  return problems;
}

export function validateCategory(category: MenuCategory, catalog: Catalog): string[] {
  const problems: string[] = [];
  const name = category.name.trim();
  if (!name) problems.push('Category name is required.');
  if (name.length > 40) problems.push('Category name must be 40 characters or fewer.');
  if (catalog.categories.some(c => c.id !== category.id && c.name.trim().toLowerCase() === name.toLowerCase())) {
    problems.push(`A category called "${name}" already exists.`);
  }
  return problems;
}

/** URL-safe id from a name, e.g. "Masala Chai" → "masala-chai-x7k2". */
export function slugId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'item';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
