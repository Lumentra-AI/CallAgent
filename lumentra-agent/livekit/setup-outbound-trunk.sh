#!/bin/bash
# Setup outbound SIP trunk for consultation transfers
# Run ONCE on the LiveKit server. Reads SignalWire creds from lumentra-api .env,
# creates the outbound trunk in LiveKit, and writes the trunk ID to agent .env.
#
# Usage: bash setup-outbound-trunk.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_ENV="/opt/livekit/api/.env"
AGENT_ENV="/opt/livekit/agent/.env"
TRUNK_TEMPLATE="${SCRIPT_DIR}/outbound-trunk.json"

# Try to read SignalWire creds from API .env
if [ ! -f "$API_ENV" ]; then
  echo "ERROR: $API_ENV not found. Set API_ENV to your lumentra-api .env path."
  exit 1
fi

PROJECT_ID=$(grep -oP 'SIGNALWIRE_PROJECT_ID=\K.*' "$API_ENV" | tr -d '"' | tr -d "'")
API_TOKEN=$(grep -oP 'SIGNALWIRE_API_TOKEN=\K.*' "$API_ENV" | tr -d '"' | tr -d "'")
SPACE_URL=$(grep -oP 'SIGNALWIRE_SPACE_URL=\K.*' "$API_ENV" | tr -d '"' | tr -d "'")
PHONE=$(grep -oP 'SIGNALWIRE_PHONE_NUMBER=\K.*' "$API_ENV" | tr -d '"' | tr -d "'")

if [ -z "$PROJECT_ID" ] || [ -z "$API_TOKEN" ]; then
  echo "ERROR: SIGNALWIRE_PROJECT_ID or SIGNALWIRE_API_TOKEN not found in $API_ENV"
  exit 1
fi

echo "SignalWire space: ${SPACE_URL}"
echo "Project ID: ${PROJECT_ID}"
echo "Outbound caller ID: ${PHONE:-+19458001233}"

# Generate trunk config with real credentials
TMPFILE=$(mktemp /tmp/outbound-trunk-XXXXX.json)
cat > "$TMPFILE" <<EOF
{
  "trunk": {
    "name": "SignalWire Outbound",
    "address": "${SPACE_URL:-softel-techsource-llc.signalwire.com}",
    "numbers": ["${PHONE:-+19458001233}"],
    "auth_username": "${PROJECT_ID}",
    "auth_password": "${API_TOKEN}"
  }
}
EOF

echo ""
echo "Creating outbound SIP trunk in LiveKit..."
RESULT=$(lk sip outbound create "$TMPFILE" 2>&1)
rm -f "$TMPFILE"

# Extract trunk ID (format: ST_xxxxx)
TRUNK_ID=$(echo "$RESULT" | grep -oP 'ST_[A-Za-z0-9]+' | head -1)

if [ -z "$TRUNK_ID" ]; then
  echo "ERROR: Failed to create trunk. Output:"
  echo "$RESULT"
  exit 1
fi

echo "Outbound trunk created: ${TRUNK_ID}"

# Write to agent .env
if [ -f "$AGENT_ENV" ]; then
  if grep -q "LK_SIP_OUTBOUND_TRUNK_ID" "$AGENT_ENV"; then
    sed -i "s|LK_SIP_OUTBOUND_TRUNK_ID=.*|LK_SIP_OUTBOUND_TRUNK_ID=${TRUNK_ID}|" "$AGENT_ENV"
  else
    echo "" >> "$AGENT_ENV"
    echo "# Outbound SIP trunk for consultation transfers" >> "$AGENT_ENV"
    echo "LK_SIP_OUTBOUND_TRUNK_ID=${TRUNK_ID}" >> "$AGENT_ENV"
  fi
  echo "Written to ${AGENT_ENV}"
else
  echo ""
  echo "Add this to your agent .env:"
  echo "  LK_SIP_OUTBOUND_TRUNK_ID=${TRUNK_ID}"
fi

echo ""
echo "Done. Restart the agent to enable consultation transfers."
