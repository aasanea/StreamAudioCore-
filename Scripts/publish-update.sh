#!/usr/bin/env bash
# =============================================================================
# StreamAudio Update Publisher Script
# Usage: ./publish-update.sh <version> <nsis-zip-file> <nsis-sig-file>
# Example: ./publish-update.sh 0.3.0 streamaudio-core_0.3.0_x64-setup.nsis.zip streamaudio-core_0.3.0_x64-setup.nsis.zip.sig
# =============================================================================

set -euo pipefail

VERSION="${1:?Usage: $0 <version> <nsis-zip> <nsis-sig>}"
NSIS_ZIP="${2:?Missing NSIS zip file}"
NSIS_SIG="${3:?Missing NSIS sig file}"

PROXMOX_HOST="root@192.168.3.177"
CONTAINER_ID="102"
RELEASES_DIR="/srv/streamaudio/releases"
NOTES="${UPDATE_NOTES:-تحديثات وتحسينات عامة.}"
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "📦 Publishing StreamAudio v${VERSION}..."

# 1. Generate the latest.json manifest
read -r -d '' MANIFEST << EOF || true
{
  "version": "${VERSION}",
  "notes": "${NOTES}",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "windows-x86_64": {
      "signature": "$(cat "${NSIS_SIG}")",
      "url": "https://updates.aasanea.com/releases/${NSIS_ZIP##*/}"
    }
  }
}
EOF

# 2. Upload files to Proxmox host then push to container
echo "⬆️  Uploading release files..."
scp "${NSIS_ZIP}" "${NSIS_SIG}" "${PROXMOX_HOST}:/tmp/"

ssh "${PROXMOX_HOST}" "
  pct push ${CONTAINER_ID} /tmp/${NSIS_ZIP##*/} ${RELEASES_DIR}/${NSIS_ZIP##*/}
  pct push ${CONTAINER_ID} /tmp/${NSIS_SIG##*/} ${RELEASES_DIR}/${NSIS_SIG##*/}
  echo '${MANIFEST}' | pct exec ${CONTAINER_ID} -- bash -c 'cat > ${RELEASES_DIR}/latest.json'
  pct exec ${CONTAINER_ID} -- chown -R www-data:www-data ${RELEASES_DIR}/
  echo 'Release files uploaded successfully.'
"

echo "✅ v${VERSION} published! Update server is live."
echo "🔗 Manifest: https://updates.aasanea.com/releases/latest.json"
