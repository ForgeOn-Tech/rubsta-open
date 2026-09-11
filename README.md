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

The public page at the repository root is the Rubsta Open waitlist. The first fold
shows the tournament at a glance: October dates, cash prizes, six courts and five
categories. Exact dates and prize amounts are marked as coming soon.

Every “Show interest” button opens the form in a pop-up, and so does a link to
`#interest`. The form takes a name, an email, an optional mobile number, the
categories a player wants and a free-text category request. A request with no
category ticked is a valid submission. While the details go to Google, the Send
button's pop-up shows a tennis ball rallying across a small court. A confirmation
screen then names the player's categories and any request. Both skip their animation
when the visitor prefers reduced motion.

On the first page load of a browser session, a short entrance plays: a tennis ball
bounces onto a court, then the page fades in. It skips when the visitor prefers
reduced motion and when a link opens the form directly.

Below the first fold, “Be the first to hear” lists the five categories with their
planned draw sizes.

The earlier full landing page now lives at `preview/`. It keeps the gallery,
technology catalogue, phase tabs and screen-design previews, and asks search engines
not to index it. All scores there are illustrative.

Run from the repository root:

```sh
python3 -m http.server 3000 --bind 127.0.0.1
```

Open http://127.0.0.1:3000 for the waitlist and http://127.0.0.1:3000/preview/ for
the full page. Serve over HTTP so the form script and the screen previews load.
Fonts use Google Fonts with local system fallbacks.

| Files | Purpose |
| --- | --- |
| `index.html`, `assets/waitlist.css`, `assets/waitlist.js` | Waitlist page and form behaviour |
| `assets/waitlist-form.js` | Form checks, used by the page and the tests |
| `apps-script/waitlist.gs` | Google Apps Script that saves interest to a Google Sheet |
| `preview/index.html`, `assets/landing.css`, `assets/club.css`, `assets/landing.js` | Full landing page |

### Waitlist form setup

Submissions go to a Google Sheet through an Apps Script web app. Until the form has
an `action` URL, it tells visitors that the list is not open yet.

1. Create a Google Sheet that only the organisers can open.
2. In the sheet, open **Extensions > Apps Script**. Replace the editor contents with
   `apps-script/waitlist.gs` and save.
3. Select **Deploy > New deployment > Web app**. Set **Execute as** to *Me* and
   **Who has access** to *Anyone*. Deploy and approve the permissions.
4. Copy the web app URL, which ends in `/exec`. Open it in a browser to check it: it
   shows `{"ok":true,"service":"rubsta-open-interest"}`.
5. In `index.html`, add the URL to the form tag as
   `action="https://script.google.com/macros/s/…/exec"`.

If **Extensions > Apps Script** shows “Sorry, unable to open the file at present”,
create the project at https://script.google.com with **New project** instead. Paste
the script, set `SPREADSHEET_ID` to the sheet's ID (the part of its URL between `/d/`
and `/edit`), save, and continue from step 3. If script.google.com shows the same
error, a Google Workspace admin has likely turned Apps Script off for the domain.

The script creates an “Interest” tab on the first submission and keeps one row per
email address. A second submission from the same address updates that row, so a
retry never adds a duplicate. The script checks every field again, stores text that
looks like a formula as plain text, and drops submissions that fill the hidden
bot-trap field. After you change the script, publish it under **Deploy > Manage
deployments** as a new version of the same deployment, so the URL stays the same.

With *Anyone* access, anyone who has the URL can post to the script, and the URL is
visible in the page source. The field checks limit what a post can write.

Run the form tests with Node.js (tested with Node 26). They need no install:

```sh
node --test tests/*.test.mjs
```

The tests also check that the script accepts exactly the categories on the page and
uses the same limits and messages as the browser checks.

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
| `/admin` | Admins | Overview: entries by status and event, time to close, latest entries |
| `/admin/entries` | Admins | Every entry, with event and status filters and status actions (`/entries` redirects here) |
| `/admin/entries/<entry id>` | Admins | Player and entry details, with status actions |
| `/admin/entries/export` | Admins | CSV of entries; takes the same `status` and `category` filters |
| `/admin/draws` | Admins | Each event's accepted entries, draw size, seeds and draw status |
| `/admin/draws/<event>` | Admins | Seed entrants, generate a draw, publish it or move it back to draft |
| `/admin/players` | Admins | Everyone with a profile or entry, their entries, and search by name, email, club or mobile |
| `/admin/settings` | Admins | Name, dates, venue, closing time (IST), fee, entries open or closed, schedule confirmed |

Draws take an event's confirmed and paid entries. The draw size is the next power
of two, up to 128 lines, with one seed per four lines (at least two). Seeds 1 and 2
take the top and bottom lines, and later seed groups draw lots, so seeds 1–4 of a
32-line draw sit on lines 1, 16, 17 and 32. Byes go to seeds in seed order. A
published draw is locked; move it back to draft to change seeds or generate it
again. Players do not see draws yet.

Entry status moves submitted → confirmed → paid. Any live entry can be cancelled,
and a cancelled entry can be reinstated as submitted. Marking an entry paid by hand
records the payment reference `manual`.

Sign-in lands on `/home`, which uses the landing page's club theme. Its player
card marks matches, win–loss, player ID, handedness, certificates and card
sharing as coming soon, because the app does not record them yet.

`/register` sends players to `/profile` until they save a profile. A player can
enter each event once. A unique index on user and category enforces this.

Payments are off by default, and an entry is stored as `submitted`. With
`NEXT_PUBLIC_PAYMENTS_ENABLED=true`, a stub checkout stores the entry as `paid`
with `paymentRef: razorpay-stub`. No money moves in either mode.

Only emails listed in `ADMIN_EMAILS` can open `/admin`, and demo mode does not
change that. To use the admin interface locally, add `demo@rubstaopen.local`
to `ADMIN_EMAILS` in `.env.local`. The database migrates and seeds Rubsta Open 2026 on
first use. The seeded fee (₹1,500) and closing time (22 Sep, 18:00 IST) come
from the design artboard, not a confirmed schedule. Player pages call the fee and
closing time provisional until an admin ticks "Schedule confirmed" in
`/admin/settings`, which needs a start date and venue.

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

GitHub Pages publishes the root of `main`. The `CNAME` file sets the custom domain to
https://www.rubstaopen.com. GitHub redirects the bare domain and the old
https://forgeon-tech.github.io/rubsta-open/ address to it. Every push to `main`
redeploys the site. `_config.yml` keeps `web/`, `apps-script/` and `tests/` out of the
Pages build. After a push, check the “pages build and deployment” run in GitHub Actions.

The rubstaopen.com DNS records live at GoDaddy and point to GitHub Pages:

| Type | Name | Value |
| --- | --- | --- |
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | forgeon-tech.github.io |

GitHub issues the HTTPS certificate after DNS points to it. Then turn on **Enforce
HTTPS** in the repository's Pages settings.

`python3 scripts/build-site.py` assembles the public files, including `preview/`, into
`dist/` for other static hosts. It leaves out the original large PNG and repository files.
