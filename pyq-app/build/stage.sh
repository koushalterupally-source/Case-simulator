#!/usr/bin/env bash
# Assemble a deployable copy of the app: the source files plus the generated question data,
# in the layout both GitHub Pages and the Android WebView wrapper expect.
#
#   ./build/stage.sh <medqbank-assets-dir> <output-dir>
#
# Example, staging into a Medqbank checkout so the existing APK and Pages workflows pick it up:
#   ./build/stage.sh /tmp/medqbank/android/app/src/main/assets ./dist
#
# The data is rebuilt from source every time rather than copied from a previous run, so a stage
# can never ship a stale index.

set -euo pipefail

if [ $# -ne 2 ]; then
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

SRC_ASSETS="$1"
OUT="$2"
HERE="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$SRC_ASSETS/pyq" ] || [ ! -d "$SRC_ASSETS/cereb" ]; then
  echo "error: $SRC_ASSETS does not look like the Medqbank assets directory" >&2
  echo "       (expected pyq/ and cereb/ inside it)" >&2
  exit 66
fi

echo "==> Building the index"
python3 "$HERE/build/build_index.py" --src "$SRC_ASSETS" --out "$HERE/data"

echo "==> Verifying the index"
python3 "$HERE/build/verify_index.py" --dir "$HERE/data"

echo "==> Staging into $OUT"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$HERE/index.html" "$HERE/manifest.webmanifest" "$HERE/sw.js" "$OUT/"
cp -r "$HERE/src" "$HERE/icons" "$HERE/data" "$OUT/"

# Tests and scratch output are not part of a deployable build.
rm -rf "$OUT/.shots"

echo
echo "Staged $(du -sh "$OUT" | cut -f1) into $OUT"
echo "  files: $(find "$OUT" -type f | wc -l | tr -d ' ')"
echo
echo "Serve it with:  python3 -m http.server 8000 --directory $OUT"
