# DEMO-POS

Free-trial builds of the three Arroyo POS editions. One repository, three
independent demos, each on its own GitHub Pages URL.

## Links

Once Pages is enabled:

| Demo | URL | Built from | Sample store |
|---|---|---|---|
| Chooser page | `/DEMO-POS/` | — | — |
| Cloud, daylight theme | `/DEMO-POS/cloud-light/` | `Arroyo_Deployer_v7_1_1` | Brew & Bite Café |
| Cloud, midnight theme | `/DEMO-POS/cloud-dark/` | `Arroyo_Deployer_v6_1_2` | Kanto Grill & Rice |
| Offline | `/DEMO-POS/offline/` | `Arroyo_POS_Builder_Application_Only_V6_3` | Sweet Crumb Bakeshop |
| Offline, BIR receipts | `/DEMO-POS/minimart/` | `MyStore_POS_Builder_v31` | Bayanihan Mini Mart |

- https://interptools.github.io/DEMO-POS/
- https://interptools.github.io/DEMO-POS/cloud-light/
- https://interptools.github.io/DEMO-POS/cloud-dark/
- https://interptools.github.io/DEMO-POS/offline/
- https://interptools.github.io/DEMO-POS/minimart/

## Enabling Pages

1. Push these files to the root of `interptools/DEMO-POS`.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Wait for the green check. The chooser page is the repository root.

`.nojekyll` is included so Jekyll leaves the folders alone.

## Trial credentials

| Demo | Sign in | Manager / admin password |
|---|---|---|
| `cloud-light` | pre-filled (`demo@brewandbite.test` / `demo1234`) | `demo1234` |
| `cloud-dark` | pre-filled (`demo@kantogrill.test` / `demo1234`) | `demo1234` |
| `offline` | password `login123` | `admin123` |
| `minimart` | Manager PIN `1234`, Cashier PIN `1111` | same PINs |

In `minimart` the PINs are **hashed with a per-build salt** before they reach
the page source, exactly as in a paid build — `1234` never appears in the HTML.

Both cloud demos use **one password throughout** — `demo1234` gets you in and
also unlocks the manager screens, so there is nothing for a customer to
mix up.

Each cloud demo also accepts **Create account** — sign-up works locally, so a
customer can make their own trial login if they want to see that flow.

## Seeded staff and regulars (cloud demos)

Both cloud demos open with a working team rather than empty screens.

| Demo | Cashiers (offered at the till) | Other staff (attendance only) |
|---|---|---|
| `cloud-light` | Ana Reyes, Mico Pascual | Joy Alvarez (Barista), Ramon Cruz (Supervisor) |
| `cloud-dark` | Jomar Tolentino, Bea Lim | Efren Diaz (Cook), Marites Santos (Supervisor) |

The two lists are deliberately different things. Everyone above is an
**employee** — they appear on the attendance tab, and the cashiers are shown
clocked in this morning while the rest are clocked out with 8 hours logged.
Only the ones whose role is `Cashier` sync into the till's own cashier list, so
a demo sale has a real name to stamp on the receipt. The seeded sales history
is already attributed across both cashiers, which makes the per-cashier
breakdown in the reports show something.

Each cloud demo also has three regulars seeded so **Charge to Utang** and
loyalty points can be tried: one customer carries an outstanding balance, one
carries points, one carries both at zero.

## How the trial limit works

Each demo allows **30 sales**, then a lock screen replaces the till and offers
your phone number and email. The counter ignores the sample sales that ship
with the store — those carry a `DEMO-` transaction id — so every visitor gets a
full 30 of their own.

A small pill in the corner shows how many are left and can be collapsed. It
also has a "Get it" button, so an interested customer can reach you before
running out.

To reset a demo before showing it to the next customer, append `?reset=1`:

```
https://interptools.github.io/DEMO-POS/cloud-light/?reset=1
```

That clears every `arroyo*` key in that browser and reloads. The lock screen
deliberately has no reset button, so a customer cannot lift the limit.

## What changed from the builder output

**No live credentials ship in this repository.** The two cloud demos had these
values found and replaced:

| Constant | Demo value |
|---|---|
| `SUPA_URL` | `https://demo.arroyopos.local` (resolves nowhere) |
| `SUPA_KEY` | `demo-local-anon-key-not-a-real-token` |
| `CREATOR_PASS` | `arroyo-demo` |
| `GITHUB_PAGES_URL` | the demo host, so the updater cannot pull the real build |

In their place each cloud demo carries a **demo backend** (`build/shim.js`): a
script that intercepts `window.fetch`, recognises the demo host, and answers the
Supabase auth and PostgREST calls out of `localStorage`. Sign-in, sign-up,
product loading, sale sync, voiding, expenses and reports all behave normally,
but there is no server, no bill and no shared data. The seeded database holds
the sample business, its catalogue, four staff records with today's clock-ins,
and six days of takings.

Staff are seeded as `employees` rows rather than only as a local cashier list,
because the till auto-syncs any employee whose role is `Cashier` into its own
cashier picker. Each sample sale is stamped with one of those cashiers, so the
Attendance tab, the cashier picker and the sales history all agree:

| Demo | Cashiers (on the floor) | Other staff |
|---|---|---|
| `cloud-light` | Ana Reyes, Mico Pascual | Joy Alvarez (Barista), Ramon Cruz (Supervisor) |
| `cloud-dark` | Jomar Tolentino, Bea Lim | Efren Diaz (Cook), Marites Santos (Supervisor) |

Edit the `team=[...]` list in each spec in `build.py` to change them.

Also removed:

- The **installation password gate**. In the paid build this screen tells the
  operator to phone you for `CREATOR_PASS`; in a trial it is a dead end, so the
  demos set `S.installed = true` and go straight to sign-in.
- The `manifest.json` link and the service worker registration, so a demo can
  never serve a stale cached copy after you redeploy.

### The MyStore demo (`minimart/`)

That builder rewrites its template across roughly 6,500 lines of chained string
surgery — namespaced storage keys, hashed PINs, an injected Waste/Expenses tab,
CSS fixes, a bootstrap seeder. Reimplementing that in `build.py` would drift out
of sync with every new builder version, so instead the builder's own
`generateApp()` runs headlessly in Node under a DOM shim (`mystore_run.cjs`),
with the form readers overridden to return `mystore_cfg.json`. The demo is
therefore byte-identical to what a paying client would receive, minus the
service worker, the manifest link and plus the trial layer.

To change the sample store, edit `mystore_cfg.json` and rebuild. Nothing about
that demo is hand-edited.

### The offline demo (`offline/`)

The offline demo needed no backend work. The previous client's name was
replaced throughout with the fictional Sweet Crumb Bakeshop, including the
`localStorage` key prefix, before publishing.

## Audit

`build/audit.cjs` and `build/audit2.cjs` drive all four demos in real headless
Chromium and assert on behaviour, not on markup. Run them after any rebuild:

```
node build/audit.cjs     # happy path: boot, sign in, open shift, sell
node build/audit2.cjs    # lock screen, isolation, reset, mobile, landing page
```

Pass 1 covers, per demo: boots without an install gate, credentials pre-filled,
signs in, cashier gate appears with the right names, opening-float modal accepts
a figure, shift starts, the right catalogue and staff load, an item goes in the
cart, exact tender enables Confirm, the sale is recorded and stamped with the
cashier, the trial counter moves, and the pill covers no controls. It also fails
the run on any console error or any outbound network request.

Pass 2 covers the 30-sale lock (appears, covers the viewport, blocks clicks to
the till, offers phone and email, has no self-serve reset), cross-demo isolation
on one origin, `?reset=1` scoping, mobile layout at 390x844, and the landing
page's links and tap targets.

Both passes report **all checks passed** on the current build, with zero console
errors and zero outbound requests from any demo.

### What the audit caught and what was fixed

- **The two cloud demos shared every `localStorage` key.** All four demos live
  on one `interptools.github.io` origin, and both cloud builds shipped with
  `arroyo_pos`, `arroyo_cloud`, `arroyo_sync_queue` and the same demo-database
  key. Signing into one and then opening the other showed the first one's store,
  catalogue, staff and trial count. Every key is now suffixed per demo
  (`arroyo_pos_cloudlight`, `arroyo_pos_clouddark`), which the audit verifies by
  loading both in one tab and comparing.
- **`?reset=1` was unscoped.** It cleared every `arroyo*` key, so resetting one
  cloud demo also wiped its neighbour. Each demo now resets only its own keys.
- **The trial pill sat on top of the bottom navigation** in the offline demo,
  covering Sell, Stock and Sales. Bar heights were measured in the browser
  (52px and 39px) and the pill is offset per demo.
- **The MyStore demo 404'd on `assets/icons/icon-192.png`**, which ships in the
  PWA zip but not in a single-file build. Both link tags removed.
- **The MyStore demo nagged the manager to change the shipped PINs**, warning
  that anyone reading the page source could work them out. Accurate for a paid
  build, alarming in a trial. The reminder flag is left off.
- **Landing-page tap targets were 39px and 20px on mobile**, under the 44px
  guideline. Now 44px and 40px.

## Rebuilding

```
python3 build/build.py
```

Reads the builder HTML files from `SRC` (and `MYSTORE_SRC`) and regenerates
`cloud-light/`, `cloud-dark/`, `offline/`, `minimart/` and `index.html`.
Nothing in those folders is edited by hand. Node is required for `minimart`.

The script never hard-codes a secret: it discovers the real constants in the
builder source with a regex, swaps them, and then asserts they are absent from
the output. If an anchor string ever moves in a future builder version, the
build stops with `ANCHOR MISSING` rather than shipping a half-scrubbed file.
