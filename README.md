# Tournament OS

Software for running a digital-first tennis tournament: entries and draws, live
scoring, player records, on-court challenges and a fan surface.

The product is sport-agnostic. Tennis is the first deployment, not the product —
the same rule the rest of the ForgeLabs tree follows.

## Products

| Product | What it covers | Existing ForgeLabs work behind it |
|---|---|---|
| **Tournament OS** | Landing page, registration and payment, account creation, draw generation, order of play, court allocation, results, certificates | None — this is the new build |
| **LiveScore** | Umpire scoring app, live scores and match stats, real-time draw and fixture updates | `multisync` — Yjs 13 CRDT records over a WebSocket relay, deployed on Cloud Run |
| **Player Card** | Profile, previous tournaments, best ranking, stat card, participation certificate, ranking | Forgeon/AMS athlete model; Ekana's per-user auth and GCS ledger pattern |
| **Challenge Kit** | Serve speed, groundstroke speed, accuracy, reaction | PaceLab; `shot-sync`'s `hits.csv` already carries an empty `speed` column for radar readings |
| **Fan Zone** | Predictions, reactions, chat over the stream | None |

Capture and highlights are a sixth surface, handled by `multisync` (synced
multi-phone capture) and `shot-sync` (per-stroke cutting). The gap there is
publishing, not capture.

## Deliberately out of scope

Three items from the original brief are not software and do not belong here:

- **Premium player development** — a coaching service sold per athlete
- **Sponsor and ad platform** — a CMS plus an inventory calendar
- **Merch and crowdfunding** — buy it off the shelf

## Open question before Fan Zone is built

Prediction games with prize money and a coin economy carry real-money and
skill-gaming exposure in India. The designed screens show predictions, reactions
and chat only; the coin wallet and any cash payout stay out until the rules are
checked.

## Design

`design/screens/` holds the initial screens as Claude Design artboards — one
`.dc.html` per screen, laid out by `canvas.json`. They follow the Forgeon AMS
house language (powder-blue accent, sharp corners, Inter with JetBrains Mono for
numerals) lifted from `forgeon/frontend/src/app/globals.css`.

Canvas: https://claude.ai/code/artifact/03717cab-8b12-4a02-be17-7394af9dae09

`design/tools/` regenerates the artboards. Run each generator from
`design/screens/` with `design/tools` on the path.

## Landing page

The Rubsta Open landing page leads with “Powered by ForgeLabs” and marks event
dates, venue, categories and registration details as coming soon. It uses the AMS
layout and typography with powder-green
accents. It includes keyboard-accessible tournament phase tabs and modal previews
of the existing screen designs. All scores are illustrative; this is a frontend
prototype with no registration, payment or live-scoring backend.

Run from the repository root:

```sh
python3 -m http.server 3000 --bind 127.0.0.1
```

Open http://127.0.0.1:3000. Serve over HTTP so the screen previews can load.
Edit `index.html`, `assets/landing.css` and `assets/landing.js`.
Fonts use Google Fonts with local system fallbacks.

## Stack

The landing page is plain HTML, CSS and JavaScript, with no build dependencies.
The registration app in `web/` uses Next.js 16, Auth.js v5, Drizzle ORM and SQLite.

## Registration app

`web/` holds the first Tournament OS surface: sign-in, player profile, event entry
and the organiser entries table. It needs a Node server, so GitHub Pages cannot
host it.

Run it from `web/`:

```sh
npm install
cp .env.example .env.local   # DEMO_AUTH=true enables the demo sign-in
npm run dev                  # http://localhost:3100
```

| Route | Who | What |
|---|---|---|
| `/signin` | Everyone | Google sign-in when configured; demo account when `DEMO_AUTH=true` |
| `/home` | Players | Next step, entries, player card summary, tournament details and upcoming features |
| `/profile` | Players | Name, date of birth, gender, mobile, club, best ranking, past tournaments |
| `/register` | Players | Choose an event (MS, WS, MD, WD); doubles need a partner name and email |
| `/register/<entry id>` | Players | Entry confirmation, visible only to the player who entered |
| `/entries` | Organisers | Every entry, with status filters and counts |

Sign-in lands on `/home`, which uses the landing page's club theme. Its player
card marks matches, win–loss, player ID, handedness, certificates and card
sharing as coming soon, because the app does not record them yet.

`/register` sends players to `/profile` until they save a profile. A player can
enter each event once. A unique index on user and category enforces this.

Payments are off by default, and an entry is stored as `submitted`. With
`NEXT_PUBLIC_PAYMENTS_ENABLED=true`, a stub checkout stores the entry as `paid`
with `paymentRef: razorpay-stub`. No money moves in either mode.

In demo mode any signed-in user can open `/entries`. Otherwise only emails in
`ENTRIES_ADMIN_EMAILS` can. The database migrates and seeds Rubsta Open 2026 on
first use. The seeded fee (₹1,500) and closing time (22 Sep, 18:00 IST) come
from the design artboard, not a confirmed schedule.

Checks, from `web/`:

```sh
npm run lint
npx tsc --noEmit
npm test                         # Vitest unit and component tests
npx playwright install chromium  # once
npm run test:e2e                 # starts its own dev server with a fresh database
```

### Event images and sponsors

Six local SVG image placeholders live in `assets/images/`. In `index.html`, replace
an image's `src` with the real photo path and update its `alt` text:

- `hero-court.svg`, `hero-action.svg`, `hero-community.svg`: three hero slides;
  use landscape photos, ideally at least 1600 px wide. Images crop with `object-fit: cover`.
- `story-players.svg`, `story-venue.svg`, `story-moments.svg`: story images;
  use 4:3 photos, ideally at least 1200 px wide.

Adjust `object-position` on individual images to keep faces in frame. The hero
slider uses arrows and slide selectors, supports keyboard arrows, and does not
auto-advance. No external image service is required.

The sponsors section contains five fictional text logos in presenting, equipment,
hydration, community and wellness slots. Replace each `.dummy-logo` with an actual
logo image (with the sponsor name as alt text) once confirmed. Remove the placeholder
labels only when the corresponding partnerships and assets are confirmed.

### Club theme

The current event theme is `assets/club.css`, loaded after the original layout
styles. It uses forest green, warm cream, a serif wordmark and court markings,
inspired by the supplied tennis-club reference. The hero keeps real HTML text
("Rubsta Open" / "Powered by ForgeLabs") over an original AI-generated backdrop.
The three hero slides currently use different crops of that concept image;
replace their `src` and `alt` attributes independently with real event photos.
The three story-image placeholders and five dummy sponsor slots remain editable.

The entrance has a tennis-ball animation with a bounded dismissal (1.65 seconds).
Section navigation uses an 800 ms court wipe, moves keyboard focus to the target,
and preserves ordinary anchor navigation without JavaScript. Reduced-motion
preferences disable the loader, wipes and slide fades. The top court-line indicator
tracks reading progress. The existing screen previews remain design prototypes.

Hero asset: `assets/images/club-court.jpg` (web version), with the original saved as
`assets/images/club-court.png`. Generated using the built-in imagegen tool, not a
photograph of the confirmed Rubsta Open venue. Generation prompt:

> Use case: photorealistic-natural. Asset: full-width website hero background for an elegant tennis tournament. Generate an original editorial architectural photograph, wide 1536x1024 composition: a perfectly symmetrical secluded outdoor green tennis court, viewed from behind the near baseline, net across the lower middle, a tall unmarked dark forest-green windscreen across the center background, lush mature trees above and around it. Pale limestone surround, afternoon natural soft sunlight, refined private tennis club atmosphere, rich forest greens and olive court. Keep the center windscreen dark and visually quiet to overlay very large cream website typography. Realistic court lines and net. No people, no text, no letters, no logos, no watermark. This is an atmospheric concept image, not a real venue.

### Current visual direction and scroll interactions

The current theme returns to the tennis-club reference: rich court greens, ivory,
oversized serif type and a lightly shaded photograph. Pastel blocks, rotated sponsor
cards and rounded feature tiles were removed. Tennis yellow is limited to the ball,
progress indicator and small interaction accents.

A shorter scroll sequence moves a ball along a drawn court path. Hero drift is capped
at 35 px and reveal travel at 14 px. Scroll updates use the shared passive,
requestAnimationFrame-throttled handler. Reduced-motion preferences disable the sticky
sequence, drift and reveals, including changes while the page is open. Content stays
visible without JavaScript.

### AI and technology section

`#technology` highlights planned ForgeLabs AI use cases: match review and player
learning, candidate highlight discovery, and editorially reviewed tournament recaps.
The court-analysis graphic is illustrative. Copy explicitly labels the capabilities
as planned, dependent on available footage, data and event setup; no AI service or
tracking backend is connected. This section is linked from the desktop navigation
and uses the existing reduced-motion-aware reveal behavior.

### Gallery and full technology catalogue

The former scroll-rally section is now `#gallery`: four replaceable image slots,
an enlarged modal view, previous/next controls and keyboard navigation. Its first
image is the AI concept court; the remaining slots are clearly labelled placeholders.
Edit the images and captions in `.gallery-item` elements in `index.html`.
The obsolete rally animation is no longer run; gentle hero drift and reveals remain.

The technology section now covers Tournament OS, LiveScore, Player Card, Capture &
Highlights, Challenge Kit and Fan Zone, followed by the planned AI capabilities.
Available product previews open the existing artboards, with sample data clearly
labelled. Nothing in this update connects production services.

### Public hosting

Production uses Sites; the original GitHub repository stays private. GitHub Pages
was unavailable for this account's private-repository plan. `.openai/hosting.json`
records the Sites project. `python3 scripts/build-site.py` assembles only public
website assets into `dist/`, excluding the original large PNG and repository files.
Publish a saved version from the exact source commit pushed to the Sites repository.
