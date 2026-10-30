import { computed, EnvironmentProviders, Injectable, makeEnvironmentProviders, signal, Signal } from '@angular/core';
import { hasPermission, Permission, StaffApp, StaffUser, canOpenApp } from '@ros/shared/domain';

/**
 * Staff authentication. The production implementation signs in against the .NET API
 * (short-lived JWT + httpOnly refresh cookie); the screens only use this contract.
 */
export abstract class AuthService {
  abstract readonly user: Signal<StaffUser | null>;
  abstract login(username: string, password: string): Promise<StaffUser>;
  abstract logout(): void;

  readonly signedIn = computed(() => this.user() !== null);

  can(permission: Permission): boolean {
    const user = this.user();
    return !!user && hasPermission(user.role, permission);
  }

  canOpen(app: StaffApp): boolean {
    const user = this.user();
    return !!user && canOpenApp(user.role, app);
  }
}

/** Demo staff accounts for the dummy backend. Every password is `demo123`. */
export const DEMO_ACCOUNTS: StaffUser[] = [
  { id: 'u-owner', name: 'Asha Rao', username: 'owner', role: 'owner' },
  { id: 'u-admin', name: 'Dev Mehta', username: 'admin', role: 'admin' },
  { id: 'u-manager', name: 'Neha Iyer', username: 'manager', role: 'manager' },
  { id: 'u-cashier', name: 'Ravi Kumar', username: 'cashier', role: 'cashier' },
  { id: 'u-waiter', name: 'Imran Shaikh', username: 'waiter', role: 'waiter' },
  { id: 'u-kitchen', name: 'Joseph D’Souza', username: 'kitchen', role: 'kitchen' },
];
const DEMO_PASSWORD = 'demo123';
const AUTH_KEY = 'ros-dummy-auth';

@Injectable()
export class DummyAuthService extends AuthService {
  private readonly current = signal<StaffUser | null>(this.read());
  readonly user = this.current.asReadonly();

  constructor() {
    super();
    // Signing in or out in one app or tab applies to every open app on this origin.
    window.addEventListener('storage', e => {
      if (e.key === AUTH_KEY) this.current.set(this.read());
    });
  }

  async login(username: string, password: string): Promise<StaffUser> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const user = DEMO_ACCOUNTS.find(u => u.username === username.trim().toLowerCase());
    if (!user || password !== DEMO_PASSWORD) throw new Error('Incorrect username or password.');
    this.write(user);
    return user;
  }

  logout(): void {
    this.write(null);
  }

  private read(): StaffUser | null {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      return raw ? (JSON.parse(raw) as StaffUser) : null;
    } catch {
      return null;
    }
  }

  private write(user: StaffUser | null): void {
    this.current.set(user);
    try {
      if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      else localStorage.removeItem(AUTH_KEY);
    } catch {
      // Storage unavailable: the session lasts for this tab only.
    }
  }
}

export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: AuthService, useClass: DummyAuthService }]);
}
