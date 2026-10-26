# Gallery release — 26 October 2026

App and static release: `48e1023e2f2abe5cb864239f00053b3728fb2d6c`.
Admin: `/admin/gallery`; public gallery: `/gallery`; homepage: `/#winners-gallery`.

The release was built on the existing `rubsta-internal` VM. Source lives at
`/home/devansh/rubsta-gallery-48e1023`. Active Compose configuration remains
`/home/devansh/rubsta-release/deploy`. Existing static files were copied into
`/var/lib/rubsta/site/48e1023e2f2abe5cb864239f00053b3728fb2d6c`; only the homepage
and two new gallery assets were replaced, preserving all other deployed assets.

Before activation, the database and deploy settings were backed up under
`/var/lib/rubsta/backups/gallery-48e1023` (root-only access). Migration 0030 was
rehearsed on a separate database copy: every existing table count stayed the
same, and the new gallery table started empty. The live database passed its
health check after activation. App and gateway are healthy.

Production browser checks passed for the public gallery/feed, homepage gallery
on mobile and desktop, admin sign-in protection, private image protection,
missing-image handling, and the existing OBS overlay. No test photos were added
to the live database. The upload → draft → publish → profile/homepage → edit →
unpublish flow passed against a local production build before deployment.

Previous app: `2c88fc05b40d0f24a1b93db5853d625a1a3b3351`.
Previous static site: `a392f8cf561c45882025b7a296f324f6cb99013e`.
For rollback, restore those values as `RUBSTA_RELEASE` and `RUBSTA_SITE_RELEASE`
in the active deploy `.env` and recreate the app/gateway with Compose. The new
additive gallery table can remain. Do not restore the old database as a routine
rollback: doing so would discard data saved since the backup.
