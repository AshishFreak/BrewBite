import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { Clock, CustomerAuth, OTP_RESEND_MS, OtpChallenge, RestaurantApi } from '@ros/shared/data-access';
import { DiningTable, maskPhone, normalizeIndianMobile } from '@ros/shared/domain';
import { Notifier, RosButton } from '@ros/shared/ui';

/** First screen after scanning a table QR: welcome, then sign in with mobile number + OTP. */
@Component({
  selector: 'app-guest-landing',
  imports: [RosButton],
  templateUrl: './guest-landing.html',
  styleUrl: './guest-landing.scss',
})
export class GuestLanding {
  readonly table = input.required<DiningTable>();

  private readonly api = inject(RestaurantApi);
  private readonly auth = inject(CustomerAuth);
  private readonly clock = inject(Clock);
  private readonly notifier = inject(Notifier);

  protected readonly cafe = this.api.cafe;
  protected readonly slots = [0, 1, 2, 3, 4, 5];

  protected readonly step = signal<'phone' | 'otp'>('phone');
  protected readonly phone = signal('');
  protected readonly name = signal('');
  protected readonly consent = signal(false);
  protected readonly marketing = signal(false);
  protected readonly phoneTouched = signal(false);
  protected readonly code = signal('');
  protected readonly challenge = signal<OtpChallenge | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  private readonly codeInput = viewChild<ElementRef<HTMLInputElement>>('codeInput');

  protected readonly normalized = computed(() => normalizeIndianMobile(this.phone()));
  protected readonly showPhoneError = computed(() => this.phoneTouched() && this.phone().trim() !== '' && !this.normalized());
  protected readonly maskedPhone = computed(() => maskPhone(this.challenge()?.phone ?? ''));
  protected readonly resendIn = computed(() => {
    const c = this.challenge();
    // The shared clock ticks once a second, so cap at the real limit to avoid showing 0:31.
    return c ? Math.min(OTP_RESEND_MS / 1000, Math.max(0, Math.ceil((c.resendAt - this.clock.now()) / 1000))) : 0;
  });

  protected setPhone(event: Event): void {
    // Keep digits, spaces and a leading + so pasted numbers like "+91 98765 43210" work.
    const value = (event.target as HTMLInputElement).value.replace(/[^\d+ -]/g, '').slice(0, 16);
    this.phone.set(value);
    this.error.set('');
  }

  protected async sendCode(event?: Event): Promise<void> {
    event?.preventDefault();
    this.phoneTouched.set(true);
    if (!this.normalized() || !this.consent() || this.busy()) return;
    await this.run(async () => {
      const challenge = await this.auth.requestOtp(this.phone(), { name: this.name(), marketingOptIn: this.marketing() });
      this.challenge.set(challenge);
      this.code.set('');
      this.step.set('otp');
      setTimeout(() => this.codeInput()?.nativeElement.focus());
    });
  }

  protected setCode(event: Event): void {
    const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    (event.target as HTMLInputElement).value = value;
    this.code.set(value);
    this.error.set('');
    if (value.length === 6) void this.verify();
  }

  protected async verify(event?: Event): Promise<void> {
    event?.preventDefault();
    const challenge = this.challenge();
    if (!challenge || this.code().length !== 6 || this.busy()) return;
    await this.run(async () => {
      const customer = await this.auth.verifyOtp(challenge.id, this.code());
      this.notifier.add({ severity: 'success', summary: customer.name ? `Welcome, ${customer.name}!` : 'You’re signed in' });
    }, () => {
      this.code.set('');
      const el = this.codeInput()?.nativeElement;
      if (el) { el.value = ''; el.focus(); }
    });
  }

  protected async resend(): Promise<void> {
    if (this.resendIn() > 0) return;
    await this.run(async () => {
      this.challenge.set(await this.auth.requestOtp(this.phone(), { name: this.name(), marketingOptIn: this.marketing() }));
      this.code.set('');
      this.notifier.add({ severity: 'info', summary: 'A new code has been sent' });
    });
  }

  protected changeNumber(): void {
    this.step.set('phone');
    this.challenge.set(null);
    this.code.set('');
    this.error.set('');
  }

  private async run(action: () => Promise<void>, onError?: () => void): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set((e as Error).message);
      onError?.();
    } finally {
      this.busy.set(false);
    }
  }
}
