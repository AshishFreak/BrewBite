# RestaurantOS: frontend

Multi-restaurant café/restaurant platform. An Nx monorepo of Angular 22 apps that share one domain model, one API contract and one UI kit (Angular Material + CDK).

The backend is not built yet. The apps run on a **dummy data layer** that follows the same rules the .NET API will, and pushes live updates between apps.

## Run

```bash
npm install
npm start          # all apps behind one dev gateway → http://localhost:4200/
```

| App | URL (dev) | Device | What it does |
|---|---|---|---|
| `guest` | `/guest/t/T5` | Phone | QR menu, options, cart, live order status, call staff, bill, UPI pay |
| `pos` | `/pos/` | Tablet | Floor plan, live alerts, order entry, GST checkout, discounts with manager PIN, split payment, receipt |
| `kitchen` | `/kitchen/` | Kitchen screen | Live tickets per station, timers, late flags, sound alert |
| `owner` | `/owner/` | Phone | Net sales, sales by hour, payment mix, top items, live tables |
| `admin` | `/admin/` | Desktop | Menu with live availability toggles; tables & guest QR links |

Open several apps in separate windows and they update each other instantly.

### Staff sign-in and roles

Every staff app (`pos`, `kitchen`, `owner`, `admin`) requires sign-in. The guest app does not, because guests arrive by QR code.

The dummy layer has these demo accounts. Every password is `demo123`.

| Username | Role | Lands in | Can also open |
|---|---|---|---|
| `owner` | Owner | Owner dashboard | Admin, POS, Kitchen |
| `admin` | Admin | Admin | POS, Kitchen |
| `manager` | Manager | POS | Kitchen |
| `cashier` | Cashier | POS | — |
| `waiter` | Waiter | POS (no payments) | — |
| `kitchen` | Kitchen staff | Kitchen display | — |

Access rules live in `libs/shared/domain/src/lib/access.ts`. The sign-in page, route guard and user menu live in `libs/shared/auth`.

Inside the POS:
- Waiters take orders but can't check out.
- Managers and above approve discounts over 10% without a PIN.

### Menu management

**Admin › Menu** can:
- add, edit and delete items: picture, name, description, category, veg/egg/non-veg, kitchen station, prep time, sizes and prices, add-on groups, and "Popular"
- manage categories: add, rename, re-icon, and delete empty categories
- toggle availability

Changes reach the guest menu and POS instantly. Past orders keep their original names and prices.

Other commands: `npm test`, `npm run lint`, `npm run build`, or a single project such as `npx nx serve pos` or `npx nx test shared-domain`.

## Structure

```
apps/        guest  pos  kitchen  owner  admin
libs/shared/
  domain/        Pure TypeScript: models, pricing & GST, order rules, time helpers   (type:domain)
  data-access/   RestaurantApi contract, Clock, CartStore, dummy implementation     (type:data-access)
  ui/            RosButton, Sheet (MatDialog/MatBottomSheet), Notifier (snack bar),
                 ProductOptions, FoodMark, InrPipe, shared theme (styles/_ros-theme.scss)  (type:ui)
tools/dev-gateway.mjs   Dev only: one origin for all apps
```

ESLint enforces the dependency direction: app → ui / data-access → domain. The domain library never imports Angular.

## Swapping dummy data for the real API

Screens only use `RestaurantApi` (`libs/shared/data-access/src/lib/restaurant-api.ts`):
- reads are signals
- writes are async commands

When the .NET API exists:
1. Add an HTTP + SignalR implementation of `RestaurantApi`.
2. Change `provideRestaurantApi()` to bind it.
3. Delete `lib/dummy/`.

No screen changes are needed.

## Notes

- The dummy layer stores data in the browser and syncs tabs on the same origin, so separate devices don't share data until the backend exists.
- Guest links use readable table codes for now. Production QR codes carry an opaque, revocable token.
- The GSTIN, FSSAI number and invoices are placeholders. Confirm GST rules with a CA.
- Licensing: PrimeNG 20+ needs a paid PrimeUI license, so it isn't used. Icons are `primeicons@7.0.0` (MIT).
