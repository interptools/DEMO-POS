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
the sample business, its catalogue and six days of takings.

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
