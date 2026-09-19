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

## The limit the Fan Zone is built to

Prediction games with prize money and a coin economy carry real-money and
skill-gaming exposure in India. The Fan Zone holds predictions, reactions and
chat only. There is no entry fee, no coin wallet and no cash payout, and the
screens say so. Nothing here changes until the rules are checked.

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

`web/` holds the first Tournament OS surface: sign-in, player profile, event entry,
the organiser admin and umpire scoring. It needs a Node server, so GitHub Pages
cannot host it.

Run it from `web/`:

```sh
npm install
cp .env.example .env.local   # DEMO_AUTH=true enables the demo sign-in
npm run dev                  # http://localhost:3100
```

| Route | Who | What |
|---|---|---|
| `/signin` | Everyone | Google sign-in when configured; demo account when `DEMO_AUTH=true` |
| `/home` | Players | Next step, partner invitations, entries, next match, player card with record and certificates, tournament details |
| `/profile` | Players | Name, date of birth, gender, mobile, club, best ranking, past tournaments |
| `/register` | Players | Choose an event (Open singles, Women's 30+, U-15 juniors, Open doubles, 40+ singles); doubles need a partner name and email |
| `/register/<entry id>` | Players | Entry confirmation and, while unpaid, the Pay button, visible only to the player who entered; for doubles, the partner link and a way to change partner |
| `/partner/<entry id>` | Invited partners | Accept or decline a doubles invitation, visible only to the invited email |
| `/draws` and `/draws/<event>` | Everyone | Published draws with scores; a signed-in player's own lines are marked |
| `/results` and `/results/<match id>` | Everyone | Matches in progress and completed by event, and one match's score and statistics |
| `/order-of-play` | Everyone | A published day's order of play; a signed-in player's own matches are marked |
| `/live` | Everyone | Every court, the score on it now, and what follows |
| `/live/<court number>` | Everyone | One court: the stream, the live score, reactions, set predictions and the chat |
| `/live/leaderboard` | Everyone | Fans by points from their set predictions |
| `/admin` | Admins | Overview: entries by status and event, time to close, latest entries |
| `/admin/entries` | Admins | Every entry, with event and status filters and status actions (`/entries` redirects here) |
| `/admin/entries/<entry id>` | Admins | Player and entry details, with status actions |
| `/admin/entries/export` | Admins | CSV of entries; takes the same `status` and `category` filters |
| `/admin/draws` | Admins | Each event's accepted entries, draw size, seeds and draw status |
| `/admin/draws/<event>` | Admins | Seed entrants, generate a draw, publish it or move it back to draft |
| `/admin/order-of-play` | Admins | Each day's matches and sessions by court, with times and umpires; publish a day for umpires |
| `/admin/order-of-play/print` | Admins | A day's published order of play as a sheet to print |
| `/admin/results` | Admins | Matches in progress and completed, by event, with scores |
| `/admin/results/<match id>` | Admins | One match's score and statistics |
| `/admin/players` | Admins | Everyone with a profile or entry, their entries, and search by name, email, club or mobile |
| `/admin/fan` | Admins | Every court chat message with the account behind it; hide a message or mute a fan |
| `/admin/settings` | Admins | Name, dates, venue, closing time (IST), a fee for each event, entries open or closed, schedule confirmed, courts, stream links |
| `/score` | Admins and umpires | Matches in progress, ready to start, waiting on earlier results, and completed |
| `/score/<match id>` | Admins and umpires | Umpire scoring screen, which keeps working when the signal drops |
| `/score/schedule/<day>` | Admins and umpires | A day's published order of play |

Draws take an event's confirmed and paid entries. The draw size is the next power
of two, up to 128 lines, with one seed per four lines (at least two). Seeds 1 and 2
take the top and bottom lines, and later seed groups draw lots, so seeds 1–4 of a
32-line draw sit on lines 1, 16, 17 and 32. Byes go to seeds in seed order. A
published draw is locked; move it back to draft to change seeds or generate it
again. Once any match in the draw has started, it cannot go back to draft, because
that would delete scores. Published draws show at `/draws`, which anybody can read.

### Scoring

Publishing a draw creates its matches. A match against a bye is complete at once,
and each winner moves into the next round.

Umpires score at `/score`. Emails in `ADMIN_EMAILS` or `UMPIRE_EMAILS` can open it,
and umpires cannot open `/admin`. The scoring screen follows the LiveScore umpire
artboard. It records points, faults, double faults and lets. It handles deuce,
tiebreaks and an optional 10-point match tiebreak for the deciding set. The umpire
confirms the point that ends the match before it saves.

Scoring keeps working when the connection drops. The phone holds the score: each
tap shows at once and stays in the browser's localStorage. Saves run in the
background and retry until the connection returns. The header shows Saved,
Saving, Offline or Conflict. Each save carries the match version it builds on, so
when another device changed the match, the umpire chooses which score to keep.
Retire and reset need a connection.

A service worker (`public/sw.js`) keeps each scoring page an umpire opens, with
the app files it needs, so the page reopens or reloads with no signal. It
controls only `/score` pages and fetches from the network first. It waits up to
5 seconds for a page before it falls back to a kept copy. A scoring page never
opened on the phone shows a "No connection" notice instead. The sign-in page
deletes the kept pages, so the next person on a shared phone cannot open them
offline. Scores kept in localStorage stay, because they may not have reached
the server yet.

### Order of play

Admins add courts in `/admin/settings`, each with a name and a surface. A court
keeps its number for the whole tournament, because matches and umpires' phones
record scores against that number. A court on any order of play cannot be
deleted.

`/admin/order-of-play` builds one tournament day at a time, with a column for
each court. A court lists its matches and sessions in playing order. A match
starts at a time, starts not before a time, or follows the item above it. A
session is court time that is not a match, such as a Challenge Kit session. It
has a start time and an optional end time. Each match can have an umpire from
`UMPIRE_EMAILS` or `ADMIN_EMAILS`. A match has one place across all days, and a
bye needs none. Times are venue times in India.

Umpires see only what an admin published. Publishing copies the day, so later
edits wait for the next publish, and the page shows "Unpublished changes" until
then. The print sheet shows the published day without the admin sidebar.

On `/score`, "Your matches" lists the unfinished matches assigned to the
signed-in umpire, and each scheduled match shows its day, court and time.
`/score/schedule/<day>` shows a published day. The day is part of the path,
because the service worker keeps pages by path. When courts exist, the scoring
screen offers them as a list and picks the scheduled court.

### Match statistics

Statistics come from the events the umpire records: who won each point,
faults, double faults and lets. `src/lib/match-stats.ts` replays them and counts
points won, first serves in, points won on first and second serve, double
faults, break points won, service games held, tiebreak points won and the
longest run of points. The umpire does not record how a point ended, so there
are no aces, winners or unforced errors. Doubles statistics are for each team.
A retired match has statistics up to the retirement.

The statistics show under the result on the scoring screen when a match ends,
and on each match's page in `/admin/results`.

Entry status moves submitted → confirmed → paid. A Razorpay payment moves a
submitted or confirmed entry straight to paid and stores Razorpay's payment id
(`pay_…`) as the payment reference. Any live entry can be cancelled, and a
cancelled entry can be reinstated as submitted. Marking an entry paid by hand
records the payment reference `manual`.

### Player pages

Sign-in lands on `/home`, which uses the landing page's club theme, as do
`/draws`, `/results` and `/order-of-play`. Those three are open to everyone:
signing in adds the "You" markers and nothing else. `/home` leads with the
player's next match: one in play, then the earliest on the published order of
play, then the earliest round still to play.

The player card shows a player ID such as `FL-2026-0117`. A new profile takes
the next player number, and existing profiles were numbered in the order they
were made. Players can add the hand they play with. Matches and win–loss count
completed matches with points played, so byes and walkovers are left out.

A player who played a match can download a participation certificate for that
event as a PDF, and the winner of a final also gets a winner's certificate. The
PDFs use the standard PDF fonts, which print Latin letters only; a name in
another script gets a "cannot be made yet" message instead of a certificate.
"Share card" makes a PNG of the card. It shows the name, player ID, hand, club,
ranking and match record, not the date of birth, mobile or email. Where the
browser can share files, it opens the share sheet; otherwise it saves the image.
Both downloads serve only the signed-in player's own certificates and card.

`/register` sends players to `/profile` until they save a profile. A player can
enter each event once, including an event they joined as a doubles partner. A
unique index on user and category guards the player's own entries.

A doubles entry waits for its partner. The entry page gives the player a link
to send. The partner signs in with the email the player gave, then accepts or
declines at `/partner/<entry id>`, and `/home` lists their open invitations. The
app sends no email. A doubles entry goes into a draw only after the partner
accepts. After a decline, or while waiting, the player can name a new partner,
unless the entry is already in a published draw.

### Payments

Payments go through Razorpay. They are off until `RAZORPAY_KEY_ID` and
`RAZORPAY_KEY_SECRET` are set; until then an entry is stored as `submitted` and
nobody is charged.

With the keys set, "Continue to payment" saves the entry and opens Razorpay
Checkout on the entry page. The server creates each order from the event's fee in
`/admin/settings`, never from the browser. The player who enters doubles pays the
whole team fee. When Checkout reports success, the server checks Razorpay's
signature before it marks the entry paid. A player who closes Checkout can pay
later from the entry page, which creates a new order.

Razorpay also posts payments to `/api/payments/razorpay/webhook`. It marks the
entry paid when the player closes the page before Checkout reports back. Set it
up in the Razorpay dashboard under **Webhooks**, with the `payment.captured` and
`order.paid` events, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. Razorpay
cannot reach `localhost`, so locally only the Checkout path runs.

Each order is a row in the `payments` table. A payment for an entry that is
already paid or cancelled is kept there, and the server logs it for a refund in
the Razorpay dashboard. Refunds are made in the dashboard; the app does not issue
them.

To try it, create test keys in the Razorpay dashboard (Account & Settings > API
Keys, test mode) and add them to `web/.env.local`. Test mode takes Razorpay's test
cards and UPI IDs and moves no money.

Only emails listed in `ADMIN_EMAILS` can open `/admin`, and demo mode does not
change that. To use the admin interface locally, add `demo@rubstaopen.local`
to `ADMIN_EMAILS` in `.env.local`. The database migrates and seeds Rubsta Open 2026 on
first use. The seeded fees are the Rubsta Open 2026 fees: Open singles ₹3,000,
Open doubles ₹4,000 per team (₹2,000 each), 40+ singles ₹3,000, U-15 juniors
₹2,000 and Women's 30+ ₹2,500. The seeded closing time (22 Sep, 18:00 IST) comes
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
npm run test:e2e:production      # the same tests against next build and next start
```

The offline reload test runs only in the production run. Under `next dev`, a
page reopened with no signal gets its files from the service worker but does not
hydrate.

### Fan Zone

`/live` is open to everyone, signed in or not, and uses the club colours on a
dark ground. It lists every court with the score on it now, and a court page
carries the stream, the scoreboard, reactions, the set prediction and the chat.
The page asks the server for all of it every five seconds, and stops while the
tab is in the background.

Signing in is needed only to join in. A fan who signs in without making a
player profile is named from their account, as "Arjun K.", or simply "Fan"
when the account carries no name either. Chat messages carry
a display name and nothing else: no email address and no account id reaches the
public page.

Admins paste a court's YouTube link in `/admin/settings`. Only a link that reads
as a YouTube video is shown, so no other site can be framed on the page.

Fans pick who takes the set being played and may change their mind until the set
reaches five games. A point goes to each correct pick, counted only once the set
finishes, so a set abandoned by a retirement scores nothing. Points come from
replaying each match, which means a corrected score corrects the leaderboard.
Resetting a match drops its predictions and reactions with the score.

A fan sends each reaction once per match. A chat message is refused when it
carries blocked language, and a fan may post once every five seconds. The word
list in `src/lib/fan-chat.ts` catches obvious cases only: hiding a message and
muting the fan at `/admin/fan` are the real protection. Hiding keeps the message
in the table and takes it off the Fan Zone.

Watching counts are held in memory, not in the database, so that polling never
slows down the umpires' saves. They start again from zero after a restart, and
one server holds one count.

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

As verified on 19 September 2026, the live public website uses GitHub Pages,
publishing `main` at `www.rubstaopen.com`. The Sites ID in `.openai/hosting.json`
is historical and is unavailable to the currently connected account.

The themed landing page uses `/register` and `/internal` links. In localhost
previews, `assets/register.js` sends them to the Next.js app on port 3100.
`/internal` requires sign-in and directs admins to `/admin`, umpires to `/score`,
and players to `/home`; destination pages retain their existing access checks.

Deployment of these links requires a Node host with persistent SQLite storage
and routing to the app. GitHub Pages cannot run the registration backend.
The previously proposed `register.rubstaopen.com` domain does not currently
resolve. Do not publish this branch over the live site until backend hosting and
routing are configured and the current main-branch sponsorship integration is
preserved. No payment keys or local databases belong in the deployment artifact.
