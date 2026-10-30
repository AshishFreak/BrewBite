#!/usr/bin/env node
/**
 * Builds every app for GitHub Pages and assembles one static site in dist/pages:
 *
 *   <base>            → landing page linking the apps
 *   <base>guest/      → guest ordering app (table QR codes point here)
 *   <base>pos/ …      → staff apps
 *   <base>404.html    → sends deep links (e.g. <base>guest/t/T2) back to the right app
 *
 * Usage: node tools/build-pages.mjs [--base=/BrewBite/]   (or PAGES_BASE env; must start and end with /)
 */
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APPS = ['guest', 'pos', 'kitchen', 'owner', 'admin'];
const arg = process.argv.find(a => a.startsWith('--base='));
const base = (arg?.slice('--base='.length) ?? process.env.PAGES_BASE ?? '/BrewBite/').replace(/\/?$/, '/');
if (!base.startsWith('/')) throw new Error(`Base must start with "/": ${base}`);

const out = 'dist/pages';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const app of APPS) {
  console.log(`\n▶ Building ${app} for ${base}${app}/`);
  execSync(`npx nx run ${app}:build:production --baseHref=${base}${app}/ --skip-nx-cache`, { stdio: 'inherit' });
  cpSync(join('dist/apps', app, 'browser'), join(out, app), { recursive: true });
}

// Serve files as-is (no Jekyll processing of folders/files that start with "_").
writeFileSync(join(out, '.nojekyll'), '');

// GitHub Pages has no SPA fallback: unknown paths get /404.html. Forward them to the owning app,
// whose index.html restores the original address before Angular boots.
writeFileSync(join(out, '404.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Redirecting…</title>
<script>
  (function () {
    var base = ${JSON.stringify(base)}, apps = ${JSON.stringify(APPS)};
    var rest = location.pathname.indexOf(base) === 0 ? location.pathname.slice(base.length) : '';
    var app = rest.split('/')[0];
    if (apps.indexOf(app) < 0) { location.replace(base); return; }
    var target = location.pathname + location.search + location.hash;
    location.replace(base + app + '/?__path=' + encodeURIComponent(target));
  })();
</script></head><body></body></html>
`);

const accounts = [
  ['Owner (all apps)', 'owner'], ['Admin', 'admin'], ['Manager', 'manager'],
  ['Cashier', 'cashier'], ['Waiter', 'waiter'], ['Kitchen', 'kitchen'],
];
writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Brew &amp; Bite · RestaurantOS demo</title>
<style>
  :root { color-scheme: light; --brand: #ea580c; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #fff7ed; color: #1c1917; }
  main { max-width: 640px; margin: 0 auto; padding: 32px 16px; }
  h1 { margin: 0 0 4px; } p { color: #57534e; }
  a.card { display: block; padding: 16px; margin: 12px 0; background: #fff; border-radius: 14px; text-decoration: none;
           color: inherit; box-shadow: 0 1px 3px rgb(0 0 0 / .08); border-left: 4px solid var(--brand); }
  a.card b { display: block; font-size: 1.1rem; } a.card span { color: #78716c; font-size: .9rem; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; } td { padding: 6px 4px; border-bottom: 1px solid #e7e5e4; }
  code { background: #ffedd5; padding: 1px 6px; border-radius: 6px; }
</style></head><body><main>
  <h1>Brew &amp; Bite</h1>
  <p>RestaurantOS demo with sample data. Data is saved in this browser only; open the apps in tabs of the same browser to see live updates.</p>
  <a class="card" href="guest/t/T2"><b>Customer app</b><span>What a diner sees after scanning the QR on table T2</span></a>
  <a class="card" href="pos/"><b>POS</b><span>Floor plan, table orders, billing</span></a>
  <a class="card" href="kitchen/"><b>Kitchen display</b><span>Live tickets</span></a>
  <a class="card" href="owner/"><b>Owner dashboard</b><span>Sales and reports</span></a>
  <a class="card" href="admin/"><b>Admin</b><span>Menu, categories, tables &amp; QR</span></a>
  <h2>Demo staff accounts</h2>
  <p>Username below, password for all: <code>demo123</code>. The customer app shows its OTP on screen in this demo.</p>
  <table>${accounts.map(([role, email]) => `<tr><td>${role}</td><td><code>${email}</code></td></tr>`).join('')}</table>
</main></body></html>
`);

console.log(`\n✔ Site ready in ${out} (base ${base})`);
