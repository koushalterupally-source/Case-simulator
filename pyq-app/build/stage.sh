#!/usr/bin/env bash
# Assemble the whole product — the PYQ app and the clinical case simulator — into one deployable
# directory, sharing one origin, one navigation and one palette.
#
#   ./build/stage.sh <medqbank-assets-dir> <output-dir>
#
# Example:
#   ./build/stage.sh /tmp/medqbank/android/app/src/main/assets ./dist
#
# Layout produced:
#   <out>/              the PYQ app (practice, grand tests, review, stats)
#   <out>/simulator/    the clinical case simulator, its own bundle and service worker
#
# SITE_BASE overrides the URL path the site is served from (default "/"). GitHub Pages project
# sites live under /<repo>/, and the simulator's asset URLs are baked in at build time, so this
# has to be right or the simulator loads a blank page.
#
# The question index is rebuilt from source every run, so a stage can never ship a stale index
# against fresh code.

set -euo pipefail

if [ $# -ne 2 ]; then
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

SRC_ASSETS="$1"
OUT="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
APP="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$APP/.." && pwd)"
SITE_BASE="${SITE_BASE:-/}"

if [ ! -d "$SRC_ASSETS/pyq" ] || [ ! -d "$SRC_ASSETS/cereb" ]; then
  echo "error: $SRC_ASSETS does not look like the Medqbank assets directory" >&2
  echo "       (expected pyq/ and cereb/ inside it)" >&2
  exit 66
fi

echo "==> Building the question index"
python3 "$APP/build/build_index.py" --src "$SRC_ASSETS" --out "$APP/data"

echo "==> Verifying the question index"
python3 "$APP/build/verify_index.py" --dir "$APP/data"

echo "==> Staging the PYQ app"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$APP/index.html" "$APP/manifest.webmanifest" "$APP/sw.js" "$OUT/"
cp -r "$APP/src" "$APP/icons" "$APP/data" "$OUT/"

echo "==> Building the case simulator (base ${SITE_BASE}simulator/)"
if [ ! -d "$REPO/node_modules" ]; then
  echo "    installing dependencies"
  (cd "$REPO" && npm ci --silent)
fi
(cd "$REPO" && VITE_BASE_PATH="${SITE_BASE}simulator/" npm run build --silent)

echo "==> Staging the case simulator"
mkdir -p "$OUT/simulator"
cp -r "$REPO/dist/." "$OUT/simulator/"

echo
echo "Staged $(du -sh "$OUT" | cut -f1) into $OUT"
echo "  PYQ app:   $(find "$OUT" -maxdepth 1 -type f | wc -l | tr -d ' ') files at the root"
echo "  simulator: $(find "$OUT/simulator" -type f | wc -l | tr -d ' ') files"
echo
echo "Serve it with:  python3 -m http.server 8000 --directory $OUT"
