# Optional player avatars

After a paid entry, player home offers an optional photo-to-sticker flow with a custom quote,
private preview and 1080 × 1350 PNG download. It does not post to Instagram or authorize
Rubsta to publish a player's card. Obtain separate publication consent outside this flow.

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
- Migration `0010` adds only avatar art and attempt tables; normal startup applies it.
  Generated PNGs reside in the existing private SQLite database/data volume.

## Privacy and safeguards

The server checks the authenticated owner, paid entry, age 18+, explicit processing consent,
same-origin requests, 5 MB upload limit, decoded format and pixel count. It strips photo
metadata and resizes before sending to OpenAI. Original photos are not saved by this app;
OpenAI's separate data policies still apply. Only generated art and consent timestamps are
stored. Image GETs require ownership and send private/no-store headers. Deletion removes
the saved art and cancels in-flight persistence, but not downloaded copies or database backups.
Quotas are retained after deletion. Quotes are rendered locally and not sent to OpenAI.

Junior registration is unchanged. Photo generation for under-18s is intentionally disabled
pending a reviewed guardian-consent and child-data setup. Do not simply remove this gate.
OpenAI's guidance requires zero data retention before processing personal data of children
under 13 or the applicable age of digital consent.

## Verification before enabling

Run unit tests/type checks and test the optional UI with mocked image responses first.
Then, with a configured key and an adult volunteer's permission, test a real portrait,
preview/download, provider failure, mobile layout, and delete. Verify model access and
the deployed proxy's request timeout. Do not claim the real generation path is verified
until this live API test has succeeded.

References:
- https://developers.openai.com/api/reference/resources/images/methods/edit
- https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance
