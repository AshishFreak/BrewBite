import { Pipe, PipeTransform } from '@angular/core';

const formatters = new Map<number, Intl.NumberFormat>();

/** Indian rupee formatting: `180 | inr` → ₹180, `1234.5 | inr:2` → ₹1,234.50 */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals: 0 | 2 = 0): string {
    if (value == null) return '';
    let formatter = formatters.get(decimals);
    if (!formatter) {
      formatter = new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: decimals, maximumFractionDigits: decimals,
      });
      formatters.set(decimals, formatter);
    }
    return formatter.format(value);
  }
}
