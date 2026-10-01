# Team password login

`/admin-login` accepts the configured team username and password and opens `/admin`.
Google player and team sign-in remains available at `/signin`.

Generate a strong random password and scrypt hash outside the repository:

```
node scripts/create-admin-login.mjs /private/path/to/new-credentials
```

`login.txt` is the private handoff to the owner. Install only `admin.env` on the
server. It contains the username, salted hash and session version, not the password.
Add `admin-password@rubstaopen.invalid` to `ADMIN_EMAILS`; the credentials provider
is disabled unless all configuration is present and that identity is authorised.

Passwords use Node scrypt with a random 16-byte salt and constant-time comparison.
The single-account login allows eight attempts per ten-minute window, held in the
single app process. Restarting the process clears that throttle. If the app scales
to multiple processes, move the throttle to shared storage before doing so.
Password sessions expire after eight hours. Rotate both the hash and session
version to invalidate existing password sessions. Remove the hash to disable the
login and invalidate password sessions without affecting Google sign-in.

Deployment uses an isolated checkout of the currently running release. Build and
test its image first. `deploy/install-admin-password.py PRIVATE_ENV RELEASE_SHA`
backs up the current protected deployment configuration, installs the hash and
adds the internal identity to the existing admin allowlist. It preserves all
payment/OAuth keys and the independent static-site release. Recreate only the app,
then reload Caddy so its upstream resolves the new app container. Keep the old image
and configuration backups for rollback. No database migrations are introduced.

Browser test: set `ADMIN_LOGIN_TEST_FILE` to the protected `login.txt` path. Never
enable Playwright traces, screenshots or video for credential-bearing tests.
