import { describe, expect, it } from 'vitest';
import { customerDisplayName, maskPhone, normalizeIndianMobile } from './customer';

describe('normalizeIndianMobile', () => {
  it('accepts common ways of writing an Indian mobile number', () => {
    expect(normalizeIndianMobile('98765 43210')).toBe('9876543210');
    expect(normalizeIndianMobile('+91 98765-43210')).toBe('9876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
  });

  it('rejects numbers that are too short, too long or not mobile', () => {
    expect(normalizeIndianMobile('98765')).toBeNull();
    expect(normalizeIndianMobile('98765432101')).toBeNull();
    expect(normalizeIndianMobile('5876543210')).toBeNull();
    expect(normalizeIndianMobile('')).toBeNull();
  });
});

describe('customer display', () => {
  it('masks the number and falls back to it when no name was given', () => {
    expect(maskPhone('9876543210')).toBe('98••••3210');
    const c = { id: 'c', phone: '9876543210', marketingOptIn: false, verifiedAt: 0 };
    expect(customerDisplayName(c)).toBe('Guest ••3210');
    expect(customerDisplayName({ ...c, name: ' Priya ' })).toBe('Priya');
  });
});
