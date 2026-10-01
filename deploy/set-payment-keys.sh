#!/usr/bin/env bash
# Install Razorpay credentials into deploy/.env.app on the deployment VM.
#
# Run it on the VM, interactively:
#   gcloud compute ssh rubsta-internal --project=forgeon --zone=asia-south1-a --tunnel-through-iap
#   cd ~/rubsta-release && bash deploy/set-payment-keys.sh
#
# Secrets are read from the terminal, never from arguments, so they stay out of the
# shell history and the process list. Nothing is echoed back.
set -euo pipefail

ENV_APP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.env.app"
LIVE_PREFIX='rzp_live_'
TEST_PREFIX='rzp_test_'

if [ ! -f "$ENV_APP" ]; then
  echo "No $ENV_APP. Create it from app.env.example first." >&2
  exit 1
fi

read -rp 'Razorpay key id (rzp_live_… or rzp_test_…): ' KEY_ID
case "$KEY_ID" in
  "$LIVE_PREFIX"*|"$TEST_PREFIX"*) ;;
  *) echo "Key id must start with $LIVE_PREFIX or $TEST_PREFIX." >&2; exit 1 ;;
esac

read -rsp 'Razorpay key secret: ' KEY_SECRET; echo
read -rsp 'Razorpay webhook secret (blank to leave unchanged): ' WEBHOOK_SECRET; echo

for value in "$KEY_ID" "$KEY_SECRET" "$WEBHOOK_SECRET"; do
  case "$value" in
    *[[:space:]]*|*'"'*|*"'"*) echo "Values cannot contain whitespace or quotes." >&2; exit 1 ;;
  esac
done

if [ -z "$KEY_SECRET" ]; then
  echo "The key secret is required." >&2
  exit 1
fi

# Mirror deploy/preflight.mjs: a live key without a webhook secret loses payments
# whenever the player closes the page before Checkout reports back.
EXISTING_WEBHOOK="$(sed -n 's/^RAZORPAY_WEBHOOK_SECRET=//p' "$ENV_APP" | head -1)"
EFFECTIVE_WEBHOOK="${WEBHOOK_SECRET:-$EXISTING_WEBHOOK}"
case "$KEY_ID" in
  "$LIVE_PREFIX"*)
    if [ -z "$EFFECTIVE_WEBHOOK" ]; then
      echo "A live key needs RAZORPAY_WEBHOOK_SECRET. Create the webhook in the Razorpay dashboard first." >&2
      exit 1
    fi ;;
esac

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="$ENV_APP.$STAMP.bak"
attempt=1
while [ -e "$BACKUP" ]; do
  BACKUP="$ENV_APP.$STAMP-$attempt.bak"
  attempt=$((attempt + 1))
done
cp -p "$ENV_APP" "$BACKUP"
chmod 600 "$BACKUP"

umask 077
TMP="$(mktemp "$ENV_APP.XXXXXX")"
KEY_ID="$KEY_ID" KEY_SECRET="$KEY_SECRET" WEBHOOK_SECRET="$WEBHOOK_SECRET" \
  awk '
    /^RAZORPAY_KEY_ID=/      { print "RAZORPAY_KEY_ID=" ENVIRON["KEY_ID"]; seen_id = 1; next }
    /^RAZORPAY_KEY_SECRET=/  { print "RAZORPAY_KEY_SECRET=" ENVIRON["KEY_SECRET"]; seen_secret = 1; next }
    /^RAZORPAY_WEBHOOK_SECRET=/ {
      print "RAZORPAY_WEBHOOK_SECRET=" (ENVIRON["WEBHOOK_SECRET"] == "" ? substr($0, index($0, "=") + 1) : ENVIRON["WEBHOOK_SECRET"])
      seen_hook = 1; next
    }
    { print }
    END {
      if (!seen_id)     print "RAZORPAY_KEY_ID=" ENVIRON["KEY_ID"]
      if (!seen_secret) print "RAZORPAY_KEY_SECRET=" ENVIRON["KEY_SECRET"]
      if (!seen_hook && ENVIRON["WEBHOOK_SECRET"] != "") print "RAZORPAY_WEBHOOK_SECRET=" ENVIRON["WEBHOOK_SECRET"]
    }
  ' "$ENV_APP" > "$TMP"
chmod 600 "$TMP"
mv "$TMP" "$ENV_APP"

case "$KEY_ID" in
  "$LIVE_PREFIX"*) MODE='live' ;;
  *) MODE='test' ;;
esac
echo "Installed $MODE payment credentials. Previous file: $BACKUP"
echo "Next: validate, then recreate the app container."
