/** A diner who signed in at the table with their mobile number. */
export interface Customer {
  id: string;
  /** 10-digit Indian mobile number without country code. */
  phone: string;
  name?: string;
  marketingOptIn: boolean;
  verifiedAt: number;
}

/** Accepts "98765 43210", "+91 98765-43210", "098765 43210"; returns the 10 digits or null if not a valid Indian mobile. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** "9876543210" → "98••••3210" */
export function maskPhone(phone: string): string {
  return phone.length < 6 ? phone : `${phone.slice(0, 2)}${'•'.repeat(phone.length - 6)}${phone.slice(-4)}`;
}

/** Name shown to staff on orders: the customer's name, or a masked number when they gave none. */
export function customerDisplayName(customer: Customer): string {
  return customer.name?.trim() || `Guest ••${customer.phone.slice(-4)}`;
}
