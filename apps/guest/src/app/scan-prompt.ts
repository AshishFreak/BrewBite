import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DEMO_MODE, RestaurantApi } from '@ros/shared/data-access';

/** Landing for `/` with no table token: guests should arrive by scanning a table QR code. */
@Component({
  selector: 'app-scan-prompt',
  imports: [RouterLink],
  template: `
    <main class="prompt">
      <div class="icon" aria-hidden="true"><i class="pi pi-qrcode"></i></div>
      <h1>Scan the QR code on your table</h1>
      <p>Point your phone camera at the code on the table to open the menu and order.</p>
      @if (demoMode) {
        <section class="dev" aria-label="Demo shortcuts">
          <h2>Demo: open a table</h2>
          <div class="tables">
            @for (t of api.tables(); track t.id) { <a [routerLink]="['/t', t.code]">{{ t.code }}</a> }
          </div>
        </section>
      }
    </main>
  `,
  styles: `
    .prompt { max-width: 480px; margin: 0 auto; padding: 4rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: .8rem; }
    .icon { width: 84px; height: 84px; border-radius: 24px; display: grid; place-items: center; background: var(--brand-soft); color: var(--brand); font-size: 2.4rem; }
    h1 { margin: .4rem 0 0; font-size: 1.4rem; }
    p { margin: 0; color: var(--muted); line-height: 1.5; }
    .dev { margin-top: 2rem; width: 100%; padding: 1rem; border: 1px dashed var(--line); border-radius: 14px; }
    .dev h2 { margin: 0 0 .7rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
    .tables { display: flex; flex-wrap: wrap; gap: .5rem; justify-content: center; }
    .tables a { padding: .5rem .8rem; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--text); font-weight: 700; text-decoration: none; }
  `,
})
export class ScanPrompt {
  protected readonly api = inject(RestaurantApi);
  protected readonly demoMode = inject(DEMO_MODE);
}
