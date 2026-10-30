import { EnvironmentProviders, Injectable, makeEnvironmentProviders, signal, Signal } from '@angular/core';
import { Customer, newId, normalizeIndianMobile } from '@ros/shared/domain';

export interface OtpChallenge {
  id: string;
  phone: string;
  expiresAt: number;
  /** Earliest time a new code may be requested for this number. */
  resendAt: number;
  /** Dummy backend only: the code, shown on screen because no SMS is sent. */
  devCode?: string;
}

export interface CustomerDetails {
  name?: string;
  marketingOptIn: boolean;
}

/**
 * Mobile-number + OTP sign-in for diners. Production sends the code by SMS/WhatsApp from the
 * .NET API (rate-limited per number and per device) and returns a short-lived customer token.
 */
export abstract class CustomerAuth {
  abstract readonly customer: Signal<Customer | null>;
  abstract requestOtp(phone: string, details: CustomerDetails): Promise<OtpChallenge>;
  abstract verifyOtp(challengeId: string, code: string): Promise<Customer>;
  abstract signOut(): void;
}

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_RESEND_MS = 30_000;
export const OTP_MAX_ATTEMPTS = 5;
const REMEMBER_MS = 30 * 24 * 60 * 60_000;
const SESSION_KEY = 'ros-dummy-customer';
const DIRECTORY_KEY = 'ros-dummy-customers';

interface PendingChallenge extends OtpChallenge {
  code: string;
  attempts: number;
  details: CustomerDetails;
}

@Injectable()
export class DummyCustomerAuth extends CustomerAuth {
  private readonly current = signal<Customer | null>(this.readSession());
  readonly customer = this.current.asReadonly();
  private readonly pending = new Map<string, PendingChallenge>();

  async requestOtp(phoneInput: string, details: CustomerDetails): Promise<OtpChallenge> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const phone = normalizeIndianMobile(phoneInput);
    if (!phone) throw new Error('Enter a valid 10-digit Indian mobile number.');
    const now = Date.now();
    const active = [...this.pending.values()].find(c => c.phone === phone && c.resendAt > now);
    if (active) throw new Error(`Please wait ${Math.ceil((active.resendAt - now) / 1000)}s before requesting a new code.`);

    for (const [id, c] of this.pending) if (c.phone === phone) this.pending.delete(id);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    const challenge: PendingChallenge = {
      id: newId(), phone, code, attempts: 0, details, expiresAt: now + OTP_TTL_MS, resendAt: now + OTP_RESEND_MS, devCode: code,
    };
    this.pending.set(challenge.id, challenge);
    const { code: _code, attempts: _attempts, details: _details, ...visible } = challenge;
    return visible;
  }

  async verifyOtp(challengeId: string, code: string): Promise<Customer> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const challenge = this.pending.get(challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      this.pending.delete(challengeId);
      throw new Error('This code has expired. Request a new one.');
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) throw new Error('Too many attempts. Request a new code.');
    if (code.trim() !== challenge.code) {
      challenge.attempts++;
      const left = OTP_MAX_ATTEMPTS - challenge.attempts;
      throw new Error(left > 0 ? `Incorrect code. ${left} attempt${left > 1 ? 's' : ''} left.` : 'Too many attempts. Request a new code.');
    }
    this.pending.delete(challengeId);

    const directory = this.readDirectory();
    const existing = directory[challenge.phone];
    const customer: Customer = {
      id: existing?.id ?? `c-${newId()}`,
      phone: challenge.phone,
      name: challenge.details.name?.trim() || existing?.name,
      marketingOptIn: challenge.details.marketingOptIn,
      verifiedAt: Date.now(),
    };
    this.writeDirectory({ ...directory, [customer.phone]: customer });
    this.writeSession(customer);
    return customer;
  }

  signOut(): void {
    this.writeSession(null);
  }

  private readSession(): Customer | null {
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as { customer: Customer; expiresAt: number } | null;
      return saved && saved.expiresAt > Date.now() ? saved.customer : null;
    } catch {
      return null;
    }
  }

  private writeSession(customer: Customer | null): void {
    this.current.set(customer);
    try {
      if (customer) localStorage.setItem(SESSION_KEY, JSON.stringify({ customer, expiresAt: Date.now() + REMEMBER_MS }));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      // Storage unavailable: stay signed in for this page only.
    }
  }

  private readDirectory(): Record<string, Customer> {
    try {
      return JSON.parse(localStorage.getItem(DIRECTORY_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  private writeDirectory(directory: Record<string, Customer>): void {
    try {
      localStorage.setItem(DIRECTORY_KEY, JSON.stringify(directory));
    } catch {
      // Ignore.
    }
  }
}

export function provideCustomerAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: CustomerAuth, useClass: DummyCustomerAuth }]);
}
