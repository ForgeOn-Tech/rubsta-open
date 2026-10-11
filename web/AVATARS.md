# Optional player avatars

After a paid entry, player home links to `/avatar`, a dedicated photo-to-sticker page with a
custom quote, private preview, avatar-only download and 1080 × 1350 PNG card download.
Players can separately approve the exact previewed card for Rubsta Open's Instagram account.
The publication permission box is selected by default on the preview, but no permission is
stored until the player clicks the explicit approval button. Unchecking it disables that
button and is respected when editing the caption. Photo-processing consent remains a separate,
unchecked box. Downloading never implies publication permission. Nothing posts automatically.

The studio reveals three steps: Photo → Caption → Save. Photo-processing consent appears
after a valid photo is selected. Captions are prefilled and editable; “Suggest another
caption” randomly selects from 2,048 combinations without repeating within browser history.
Only numeric suggestion IDs are saved in localStorage. If storage is blocked, history lasts
for the current visit. Exhausting the pool asks the player to write a caption rather than
silently recycling suggestions. No model request or generation fee is used for captions.
The photo step uses an upload button. During generation the form is hidden behind a tennis-ball
loader, which fades out before the avatar appears. Reduced-motion preferences disable these
animations. Once an avatar exists, there is no regeneration option or return to the photo step.
The final preview shows the selected Instagram permission and the approval/download actions.
Additional actions, including withdrawal and deletion, are under “Avatar options”.

`/admin/avatars` lists approved cards and their recorded permission text and timestamp.
Only admins can download these cards. The team posts them manually on Rubsta's Instagram;
players do not connect their own Instagram accounts. Refresh the list before posting.
Withdrawing permission immediately removes the card from the list and download route.
Existing external posts, downloaded files and backups cannot be recalled by this action.
Editing a quote does not change the approved card: preview and approve again to replace it.
Generating a new avatar or deleting it clears the previous publication permission.

## Setup

- Put `OPENAI_API_KEY` in ignored `web/.env.local` for development, or ignored
  `deploy/.env.app` for the deployed app; restart the app after changing it. Never use a
  `NEXT_PUBLIC_` key or commit/paste the secret.
- Enable API billing and image-model access in the intended OpenAI project. ChatGPT
  subscriptions do not configure this server.
- Generation uses `gpt-image-1.5` with the Images edits endpoint, medium quality,
  one 1024 × 1024 PNG. No automatic retries. Without a key the feature shows a safe
  unavailable message; registration/payment still work.
- Configure provider-side budgets/alerts before enabling production use. The database
  additionally limits attempts to three per player and fifty globally in a rolling 24 hours.
  Failed/time-out attempts count because the provider may already have incurred cost.
- Migration `0010` adds avatar art and attempt tables; `0013` adds exact approved cards
  and their publication permission. Normal startup applies them.
  Generated PNGs reside in the existing private SQLite database/data volume.

## Privacy and safeguards

The server checks the authenticated owner, paid entry, age 18+, explicit processing consent,
same-origin requests, 5 MB upload limit, decoded format and pixel count. It strips photo
metadata and resizes before sending to OpenAI. Original photos are not saved by this app;
OpenAI's separate data policies still apply. Only generated art and consent timestamps are
stored. Explicit Instagram approval additionally stores the rendered card (including its
name and quote), the avatar version and the publication permission text and timestamp.
Private image GETs require ownership; approved-card GETs require admin access. Both send
private/no-store headers. Deletion removes
the saved art and cancels in-flight persistence, but not downloaded copies or database backups.
Quotas are retained after deletion. Quotes are rendered locally and not sent to OpenAI.

Junior registration is unchanged. Photo generation for under-18s is intentionally disabled
pending a reviewed guardian-consent and child-data setup. Do not simply remove this gate.
OpenAI's guidance requires zero data retention before processing personal data of children
under 13 or the applicable age of digital consent.

## Verification before enabling

Run unit tests/type checks and `npm run test:e2e:production`. The avatar browser check uses
a synthetic image and an intercepted generation response, then exercises real storage,
preview/download, publication permission, admin download, withdrawal and deletion routes.
No real portrait or paid provider request is involved in that check.
Then, with a configured key and an adult volunteer's permission, test a real portrait,
preview/download, provider failure, mobile layout, and delete. Verify model access and
the deployed proxy's request timeout. Do not claim the real generation path is verified
until this live API test has succeeded.

References:
- https://developers.openai.com/api/reference/resources/images/methods/edit
- https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance
