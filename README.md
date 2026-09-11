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

## Stack

Not chosen yet.
