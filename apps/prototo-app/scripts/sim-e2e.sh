#!/usr/bin/env bash
# Recipient-flow e2e for the Prototo Viewer, on a DEDICATED simulator.
# Run before every store cut (see docs/RELEASE-CHECKLIST.md).
#
# Why this exact flow: two traps burned three TestFlight builds (26-29).
# (a) Verifying link routing by loading shares through the
#     prototo://expo-development-client channel proves NOTHING — it bypasses
#     URL delivery, so expo-linking's registry never gets involved.
# (b) ExpoLinkingRegistry.initialURL is process-wide and outlives our runtime
#     swaps: a freshly mounted prototype runtime reads the scanned link as its
#     own initial URL and its router renders Unmatched Route. This script
#     drives the link THROUGH THE SHELL (prototo:///p/<token> — same registry
#     semantics as a Camera scan) so that class of bug cannot hide.
#
# Prereqs: a Supabase session JSON for a test account (the /p route is
# sign-in gated). Mint one: POST $SUPABASE_URL/auth/v1/otp {email, create_user},
# read the 6-digit code from the inbox, then POST /auth/v1/verify
# {email, token, type:"email"} and save the response JSON.
#
# Usage:
#   scripts/sim-e2e.sh --session /path/session.json [--token AQ3MWZ94J9EK]
#                      [--alt-token 360E2CFA4KYH] [--udid <sim>] [--skip-build]
#
# Xcode 27: simctl openurl shows an "Open in Prototo?" prompt, so the script
# taps Open through serve-sim (proto-cli's copy). The default "Prototo-Test-27"
# device (iPhone 18 Pro) goes on the newest iOS 27 runtime that accepts it
# (27.1 betas only take newer device types). For an iOS 26 pass, use --udid.
#
# NEVER point --udid at the desktop app's headless simulator (it is a live
# workflow device); the default creates/boots a "Prototo-Test-27" device.

set -euo pipefail

TOKEN="AQ3MWZ94J9EK"     # orbit-port (hi@, runtime prototo-57)
ALT_TOKEN="360E2CFA4KYH" # any valid-shape token != TOKEN; may 404, only routing is asserted
UDID=""
SESSION=""
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token) TOKEN="$2"; shift 2 ;;
    --alt-token) ALT_TOKEN="$2"; shift 2 ;;
    --udid) UDID="$2"; shift 2 ;;
    --session) SESSION="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    *) echo "unknown arg: $1"; exit 2 ;;
  esac
done

[[ -n "$SESSION" && -f "$SESSION" ]] || { echo "FAIL: --session <session.json> required (see header)"; exit 2; }

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$(mktemp -d /tmp/prototo-sim-e2e-XXXX)"
BUNDLE_ID="com.sherizan.prototo"
echo "run dir: $RUN_DIR"

if [[ -z "$UDID" ]]; then
  UDID=$(xcrun simctl list devices | grep -F "Prototo-Test-27 (" | grep -oE "[A-F0-9-]{36}" | head -1 || true)
  if [[ -z "$UDID" ]]; then
    for RUNTIME in $(xcrun simctl list runtimes | grep -oE "com\.apple\.CoreSimulator\.SimRuntime\.iOS-27-[0-9]+" | sort -t- -k3 -nr); do
      UDID=$(xcrun simctl create "Prototo-Test-27" "iPhone 18 Pro" "$RUNTIME" 2>/dev/null) && break
    done
    [[ -n "$UDID" ]] || { echo "FAIL: no iOS 27 runtime accepts an iPhone 18 Pro; install one in Xcode"; exit 2; }
  fi
fi
xcrun simctl bootstatus "$UDID" -b >/dev/null
echo "sim: $UDID"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "building Release (this takes a while)…"
  (cd "$APP_DIR" && npx expo run:ios --configuration Release --device "$UDID" > "$RUN_DIR/build.log" 2>&1) \
    || { echo "FAIL: build — see $RUN_DIR/build.log"; exit 1; }
  pkill -f "expo run:ios" 2>/dev/null || true
fi

# Fresh state + injected session (the /p route is sign-in gated).
xcrun simctl terminate "$UDID" "$BUNDLE_ID" 2>/dev/null || true
CONTAINER=$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" data)
STORAGE="$CONTAINER/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1"
mkdir -p "$STORAGE"
python3 - "$SESSION" "$STORAGE/manifest.json" <<'PY'
import json, sys
session = json.load(open(sys.argv[1]))
json.dump({"sb-wlnztkzlcvqiuzdavagt-auth-token": json.dumps(session)}, open(sys.argv[2], "w"))
PY

xcrun simctl spawn "$UDID" log stream --predicate 'eventMessage CONTAINS "PROTO"' --style compact > "$RUN_DIR/proto.log" 2>&1 &
LOGPID=$!
trap 'kill $LOGPID 2>/dev/null || true' EXIT

# Xcode 27 asks "Open in Prototo?" on every openurl; tap Open via serve-sim.
SERVE_SIM="$APP_DIR/../../packages/proto-cli/node_modules/serve-sim/dist/serve-sim.js"
XCODE_MAJOR=$(xcodebuild -version | awk 'NR==1{split($2,v,".");print v[1]}')
if [[ "$XCODE_MAJOR" -ge 27 ]]; then
  [[ -f "$SERVE_SIM" ]] || { echo "FAIL: serve-sim missing, run pnpm install"; exit 2; }
  # Device Hub can swallow serve-sim taps; the reset can fail right after boot, so best-effort.
  node "$SERVE_SIM" repair-input -d "$UDID" >/dev/null 2>&1 || true
  node "$SERVE_SIM" --no-preview "$UDID" > "$RUN_DIR/serve-sim.log" 2>&1 &
  SSPID=$!
  trap 'kill $LOGPID $SSPID 2>/dev/null || true' EXIT
  sleep 5
fi
open_link() {
  xcrun simctl openurl "$UDID" "$1"
  if [[ -n "${SSPID:-}" ]]; then
    sleep 2
    node "$SERVE_SIM" tap 0.685 0.5425 -d "$UDID" >/dev/null # the prompt's Open button
  fi
}

xcrun simctl launch "$UDID" "$BUNDLE_ID" >/dev/null
sleep 6

echo "1/3 share link through the shell (Camera-scan semantics)…"
open_link "prototo:///p/$TOKEN"
sleep 18
xcrun simctl io "$UDID" screenshot "$RUN_DIR/1-mounted.png" >/dev/null

echo "2/3 same link again with the prototype mounted (must be swallowed)…"
open_link "prototo:///p/$TOKEN"
sleep 4
xcrun simctl io "$UDID" screenshot "$RUN_DIR/2-same-link.png" >/dev/null

echo "3/3 different link with the prototype mounted (must re-route via shell)…"
open_link "prototo:///p/$ALT_TOKEN"
sleep 8
xcrun simctl io "$UDID" screenshot "$RUN_DIR/3-diff-link.png" >/dev/null
kill $LOGPID 2>/dev/null || true; sleep 1

fail=0
assert_log() { # assert_log <yes|no> <pattern> <label>
  if grep -q "$2" "$RUN_DIR/proto.log"; then found=yes; else found=no; fi
  if [[ "$found" != "$1" ]]; then echo "FAIL: $3"; fail=1; else echo "ok:   $3"; fi
}
assert_log yes "loadApp SUCCESS"                          "share loaded (loadApp SUCCESS)"
assert_log yes "PROTO mounted"                            "prototype runtime mounted"
assert_log no  "loadApp ERROR"                            "no native load errors"
assert_log yes "external URL is the mounted share — swallowed" "same-link re-delivery swallowed"
assert_log yes "parking + returning to shell"             "different link parked + shell remounted"
assert_log yes "flushing parked external URL"             "parked link flushed to the shell router"

echo "screenshots: $RUN_DIR (eyeball 1-mounted.png for the running prototype, no Unmatched Route)"
[[ $fail -eq 0 ]] && echo "PASS" || echo "FAILED — see $RUN_DIR/proto.log"
exit $fail
