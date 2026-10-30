import { InjectionToken } from '@angular/core';

/**
 * True while the apps run on the dummy backend (including the hosted demo), so screens can show
 * demo helpers such as sample sign-ins and table shortcuts. Provide `false` once a real backend is wired in.
 */
export const DEMO_MODE = new InjectionToken<boolean>('DEMO_MODE', { factory: () => true });
