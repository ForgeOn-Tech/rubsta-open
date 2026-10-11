# Avatar release — 11 October 2026

Released branch `avatar`, based on main `c2621cbfddd873732f4ab17d61736e34f5e843f1`.
Live app and static site release: `3555828d4d870f68536737a6ad156d44c7ab47e7`.
Documentation-only commits after this SHA do not change the running image.

Includes the dedicated `/avatar` page, direct landing-page link, mobile upload and
creation animation, caption suggestions, card download and explicit Rubsta
Instagram approval. Approval starts checked but requires the approval button;
downloading does not grant permission. Approved cards are available to admins.
Posting to Instagram remains manual.

## Previous live versions

- App: `92e2ff0eede9bdc55dfc44ee0f90be60b38b1786`.
- Static site: `c2621cbfddd873732f4ab17d61736e34f5e843f1`.

Both old versions remain on the server. Payment, sign-in and gateway credentials
were preserved. Demo sign-in remains disabled. The existing image API key is set;
a real billable image generation was not performed during release verification.

## Verification

- 614 local tests passed; the same avatar app code had passed 12 production browser
  checks, including simulated generation, download, approval and withdrawal.
- Production Docker image built successfully on the existing VM.
- SQLite backup passed `quick_check`; candidate app started against an isolated
  copy of live data. Migration added `avatar_shares`, with all 22 existing
  application-table row counts unchanged.
- A second database backup was taken immediately before activation. Live database
  checks passed after activation; existing table counts did not decrease.
- App and gateway healthy. Released homepage is byte-identical to committed HTML.
- Live mobile browser verified avatar link → Google sign-in, registration/admin
  access protection, public draws/results/order of play, sponsorship, policy pages
  and admin login. No page errors. No real payment or Instagram post was made.

## Server files and backup

VM: `rubsta-internal`, project `forgeon`, zone `asia-south1-a`.

- Committed build source: `/home/devansh/rubsta-avatar-3555828`.
- Active Compose configuration: `/home/devansh/rubsta-release/deploy`.
  This directory's parent retains older source; do not rebuild that source as the
  current release. Build from the committed avatar source above or a fresh archive.
- Static files: `/var/lib/rubsta/site/3555828d4d870f68536737a6ad156d44c7ab47e7`.
- Protected backup directory:
  `/var/lib/rubsta/backups/avatar-3555828d4d870f68536737a6ad156d44c7ab47e7`.
  Contains verified SQLite backups, previous deploy settings, and rehearsal files.

Google Cloud Storage rejected the release archive upload with HTTP 403 because
the owning project's billing account is disabled/delinquent. The committed archive
was instead transferred over authenticated IAP SSH and built on the existing VM;
its SHA-256 was verified. No billing settings were changed. This release's static
files are on the VM, not in the intended GCS release prefix. Repair billing and
archive the exact release assets there before treating that remote copy as available.

## Rollback

Restore only `RUBSTA_RELEASE` and `RUBSTA_SITE_RELEASE` in the active deploy `.env`
to the previous values listed above, preserving all other settings, then run:

```sh
sudo docker compose --project-directory /home/devansh/rubsta-release/deploy \
  -f /home/devansh/rubsta-release/deploy/compose.yaml up -d --wait
```

Verify app health and public pages. The new table is additive and can stay in place
with the old app. Do not restore the old database routinely: that could discard
registrations or payments made since the backup.
