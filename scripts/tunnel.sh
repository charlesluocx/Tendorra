#!/usr/bin/env bash
# Runs the dev server and exposes it via a Cloudflare Tunnel, so staff who
# aren't on your local network can test against a live URL without any
# deployment. Run this on your own machine (needs real internet access) —
# it does not work from a sandboxed/cloud dev environment.
#
# Usage: ./scripts/tunnel.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed." >&2
  echo "Install it: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" >&2
  echo "  macOS:   brew install cloudflared" >&2
  echo "  Windows: winget install --id Cloudflare.cloudflared" >&2
  exit 1
fi

if [ ! -f .env.local ]; then
  echo ".env.local not found. Copy .env.example to .env.local and fill it in first." >&2
  exit 1
fi

echo "Starting Next.js dev server..."
npm run dev &
DEV_PID=$!
trap 'kill "$DEV_PID" 2>/dev/null || true' EXIT

echo "Waiting for http://localhost:3000 ..."
for _ in $(seq 1 30); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "Starting Cloudflare Tunnel — share the https://*.trycloudflare.com URL below with your staff."
echo "Press Ctrl+C to stop both the tunnel and the dev server."
echo ""
cloudflared tunnel --url http://localhost:3000
