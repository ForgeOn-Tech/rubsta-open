# Google Cloud deployment

The approved deployment is a GCS asset bucket plus one Compute Engine VM with
persistent SQLite storage. The internal environment is provisioned in project
`forgeon`, zone `asia-south1-a`: VM `rubsta-internal` (e2-medium), reserved address
`rubsta-internal-ip` (`8.231.95.59`), 20 GB data disk `rubsta-internal-data`, and
private bucket `forgeon-rubsta-internal-assets`. These are billable resources.
DNS `internal.rubstaopen.com` points to this address. The existing public site is
unchanged. Deployment verification is recorded below.

The VM runs the app and Caddy. The organisation disallows public bucket access;
keep that policy intact. An authenticated deployer downloads the immutable GCS
release to `/var/lib/rubsta/site/FULL_COMMIT_SHA` on the VM. Caddy serves that
read-only copy and sends every other route to Next.js. Register and Team access
therefore stay on one HTTPS origin. Authentication callbacks return to `/home`,
not the public landing page.

## Prerequisites for future deployments

- Authenticate `gcloud` to project `forgeon` using `tech@forgelabs.in`.
- Choose internal demo or public registration. Google OAuth is not configured
  locally. Public registration must use Google OAuth with demo sign-in disabled.
- Select the hostname and point its DNS at the VM's reserved IP. Keep the existing
  `www.rubstaopen.com` GitHub Pages site until the replacement is verified.

## Deployment files

- `Dockerfile` builds the standalone Next app on Linux, including SQLite's native
  dependency. `.dockerignore` excludes credentials, local databases and caches.
  It pins npm 11.17.0 to match the lockfile producer; bundled npm 10 fails clean
  installation with a spurious missing esbuild dependency.
- `compose.yaml` exposes only Caddy on ports 80/443. The app has no published port.
- `Caddyfile` routes `/` and `/assets/*` to the downloaded GCS release and other
  paths to the app. GCS contains website assets, never credentials or a database.
- `access.internal.caddy` password-protects the entire origin. Use test payments
  only. Razorpay cannot deliver unauthenticated webhooks through this gate.
- `access.public.caddy` relies on the app's Google sign-in and role checks.
- `preflight.mjs` checks configuration without displaying secrets.

Copy `.env.example` to `.env` and `app.env.example` to `.env.app` inside this
directory. Both destinations are ignored by Git. Generate a new auth secret and,
for internal access, a separate random password and bcrypt hash. Do not reuse a
demo database or publish its shared admin identity without the password gate.

For public sign-in, the Google OAuth redirect is
`https://YOUR_HOST/api/auth/callback/google`. For public payments, the webhook is
`https://YOUR_HOST/api/payments/razorpay/webhook` and handles `payment.captured`
and `order.paid`. Add the corresponding secrets to `.env.app` on the VM. Do not
print expanded Compose configuration because it contains environment secrets.

## Cloud resources and deployment sequence

1. Inspect the authenticated project first. Use a dedicated VM, reserved IP and
   asset bucket, with labels identifying this application. Open 80/443 for Caddy
   and use IAP for SSH; do not expose the Node port.
2. Attach a dedicated persistent data disk with automatic deletion disabled.
   Mount it at `/var/lib/rubsta` and create `data` (owned by UID/GID 1000) and `tls`
   directories there. A container rebuild must never replace that mount.
3. Publish `index.html` and `assets/` from the reviewed, committed source to
   `gs://BUCKET/releases/FULL_COMMIT_SHA/`. Keep the bucket private. Download that
   prefix using authenticated `gcloud storage cp`, transfer it over IAP, and put
   `index.html` and `assets/` in `/var/lib/rubsta/site/FULL_COMMIT_SHA`. Use release
   prefixes for rollback; do not upload the
   repository, `.env` files, `web/`, or database files. HTML should revalidate.
4. Copy the exact same source commit and separate protected environment files to
   the VM. Set `RUBSTA_RELEASE` to that full SHA and validate configuration:

   ```sh
   node deploy/preflight.mjs
   docker compose --project-directory deploy -f deploy/compose.yaml config --quiet
   docker compose --project-directory deploy -f deploy/compose.yaml build app
   docker compose --project-directory deploy -f deploy/compose.yaml up -d --wait
   ```

5. Verify HTTPS, assets, `/register`, `/internal`, a saved entry across container
   restart, and the chosen access controls. Before public registration, configure
   the actual event in admin settings: the developer seed has provisional dates.
   Preserve the live main branch's sponsorship integration before replacing it.
6. Schedule encrypted disk snapshots/backups before accepting real entries.
   Rollback uses the previous app image and GCS release prefix, retaining the
   database. Review migration compatibility before rolling app versions back.

## Verified internal deployment — 19 September 2026

- URL: `https://internal.rubstaopen.com`; Team access: `/internal`.
- Running source/image release: `2277d6bca391421c639960d068862a0dc5a09235`.
  Later documentation-only commits do not require rebuilding this release.
- Browser credentials are in the local, permission-restricted, Git-ignored
  `deploy/.env.preview-access`. After the browser password prompt, use
  **Continue with demo account**. This shared demo has admin access; do not share
  the preview password publicly or enter real player data.
- VM working directory: `/home/devansh/rubsta-release`; Compose files and
  protected environment files are in its `deploy/` directory. Connect with
  `gcloud compute ssh rubsta-internal --project=forgeon --zone=asia-south1-a --tunnel-through-iap`.
- HTTPS certificate issued, HTTP redirects to HTTPS, and unauthenticated page,
  asset, admin and auth API requests return 401. Anonymous GCS access returns 403.
  Tagged firewall rules allow web and IAP SSH at priority 800 and deny other
  ingress at 900, overriding unrelated default-network allowances for this VM.
- Linux production build and TypeScript passed; app is healthy. Caddy runtime
  validation and six deployment preflight tests passed. The production-only npm
  audit reported zero vulnerabilities (development dependencies reported four
  moderate findings during installation; no automatic upgrades were applied).
- Browser checks passed at desktop/mobile widths: homepage, same-origin links,
  demo sign-in, profile creation, event entry and admin routing, with no browser
  errors. One clearly labelled `Preview Test` profile and Open singles entry
  remain for inspection. Initially submitted, the entry was subsequently paid
  during the test-payment verification below.
- Entry and settings survived an app-container restart. SQLite quick_check
  returned `ok`. The dedicated data disk has automatic deletion disabled.
- Preview dates/venue are 24–25 October 2026 at Vazirani National Sports Academy.
  Schedule remains provisional: the seed's 22 September entry deadline is NOT
  the confirmed tournament deadline. Confirm/update it before real registration.
- Razorpay test payments were enabled after the initial deployment at the user's
  request. Existing test credentials are stored only in the ignored, protected
  app environment on the VM. No local database or live payment keys were copied.
  Public launch still needs Google OAuth, rotated payment credentials and webhook
  verification if payments are enabled, confirmed entry deadline, backups, and
  preservation of the live main branch's sponsorship integration. The preview's
  sponsorship form does not send enquiries.

## Team payment testing

Verified on 19 September 2026: checkout displayed Test Mode and ₹3,000; choosing
Failure left the entry unpaid and retryable after reload. A successful retry
created `pay_TdrmcP0qfQpgIm` for `order_TdrmSAjMifMmei`. The Razorpay API confirmed
`captured`, INR 300000 paise, method netbanking. The application verified the
callback signature and stored Paid with the payment reference; player reload and
the admin entries page both showed Paid. No manual Paid override or fabricated
signature was used. All 28 targeted payment unit/persistence tests passed.

Sign in to the preview, open an unpaid entry and click **Pay**. The Razorpay
window must display **Test Mode**. Choose **Netbanking → Canara Bank**, then
**Success** or **Failure** on the mock bank page. No bank login or real payment
details are needed. Keep the original app tab open for payment confirmation.

The browser callback verifies Razorpay's signature server-side. Webhook recovery
after closing the browser is not configured: no dashboard webhook or webhook
secret is set, and the preview password gate protects that route as well.
Do not treat this as a verified webhook/reconciliation flow.

Everyone currently shares the demo account; an event already paid by one tester
cannot be paid again by another. Separate tester accounts remain a prerequisite
for independent parallel testing. Test keys previously shared in chat should be
rotated before wider use; do not paste replacement secrets into chat.

References: [GCS static hosting](https://docs.cloud.google.com/storage/docs/hosting-static-website),
[persistent disk deletion settings](https://docs.cloud.google.com/compute/docs/disks/modify-persistent-disk),
[Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy),
[Caddy basic authentication](https://caddyserver.com/docs/caddyfile/directives/basic_auth).
