import { describe, expect, it } from 'vitest';
import { InrPipe } from './inr.pipe';

describe('InrPipe', () => {
  const pipe = new InrPipe();

  it('formats whole rupees with Indian digit grouping', () => {
    expect(pipe.transform(123456)).toBe('₹1,23,456');
  });

  it('shows paise when asked and handles empty values', () => {
    expect(pipe.transform(8.925, 2)).toBe('₹8.93');
    expect(pipe.transform(null)).toBe('');
  });
});
