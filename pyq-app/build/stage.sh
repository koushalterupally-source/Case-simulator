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
# ARROW_SRC (optional env var) points at a checkout of the THIRD PARTY
# thesauceypotato/Medtrix-Android-Final repo's medical-mcq-engine/ directory. When set, it is
# passed through to build_index.py as --arrow, adding Arrow as a third practice source built
# from source every run -- same rule as the Medqbank corpus: never committed. Unset (the
# default) leaves the build exactly as it is without Arrow; CI does not set it.
#
#   ARROW_SRC=/tmp/medtrix/medical-mcq-engine ./build/stage.sh /tmp/medqbank/.../assets ./dist
#
# SIMULATOR_SRC / SIMULATOR_REPO control where the clinical case simulator comes from. It lives
# in its own repository now; if this checkout still contains it the build uses that, otherwise it
# clones SIMULATOR_REPO. Point SIMULATOR_SRC at a checkout to skip the clone.
#
# The question index is rebuilt from source every run, so a stage can never ship a stale index
# against fresh code.

set -euo pipefail

if [ $# -ne 2 ]; then
  sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'
  exit 64
fi

SRC_ASSETS="$1"
mkdir -p "$(dirname "$2")"
OUT="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
if [ -d "$OUT" ]; then
  OUT="$(cd "$OUT" && pwd)"
fi
APP="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$APP/.." && pwd)"
SITE_BASE="${SITE_BASE:-/}"

case "$OUT" in
  ""|"/"|"//"|"$REPO"|"$APP"|"${HOME:-}"|"/bin"|"/boot"|"/dev"|"/etc"|"/home"|"/lib"|"/lib64"|"/opt"|"/proc"|"/root"|"/run"|"/sbin"|"/sys"|"/usr"|"/var")
    echo "error: unsafe output directory: $OUT" >&2
    exit 64
    ;;
esac

if [ ! -d "$SRC_ASSETS/pyq" ] || [ ! -d "$SRC_ASSETS/cereb" ]; then
  echo "error: $SRC_ASSETS does not look like the Medqbank assets directory" >&2
  echo "       (expected pyq/ and cereb/ inside it)" >&2
  exit 66
fi

echo "==> Building the question index"
ARROW_ARGS=()
if [ -n "${ARROW_SRC:-}" ]; then
  echo "    including Arrow from $ARROW_SRC"
  ARROW_ARGS=(--arrow "$ARROW_SRC")
fi
python3 "$APP/build/build_index.py" --src "$SRC_ASSETS" --out "$APP/data" "${ARROW_ARGS[@]}"

echo "==> Verifying the question index"
python3 "$APP/build/verify_index.py" --dir "$APP/data"

echo "==> Building the case simulator (base ${SITE_BASE}simulator/)"

# The simulator lives in its own repository. When this checkout still carries it (a package.json
# beside a src/ that Vite can build), build it in place; otherwise clone it. SIMULATOR_SRC points
# at an existing checkout, which is what CI and a local iteration loop want — cloning 40 MB on
# every build is waste.
SIM_REPO="${SIMULATOR_REPO:-https://github.com/koushalterupally-source/clinical-case-simulator}"
SIM_DIR="${SIMULATOR_SRC:-}"

if [ -z "$SIM_DIR" ] && [ -f "$REPO/package.json" ] && [ -f "$REPO/vite.config.ts" ]; then
  SIM_DIR="$REPO"
  echo "    building from this checkout"
elif [ -z "$SIM_DIR" ]; then
  SIM_DIR="$(mktemp -d)/clinical-case-simulator"
  echo "    cloning $SIM_REPO"
  git clone --depth 1 "$SIM_REPO" "$SIM_DIR"
else
  echo "    building from $SIM_DIR"
fi

if [ ! -f "$SIM_DIR/package.json" ]; then
  echo "error: no case simulator at $SIM_DIR" >&2
  echo "       set SIMULATOR_SRC to a checkout, or SIMULATOR_REPO to clone from" >&2
  exit 66
fi

if [ ! -d "$SIM_DIR/node_modules" ]; then
  echo "    installing dependencies"
  (cd "$SIM_DIR" && npm ci --silent)
fi
SIM_TMP="$SIM_DIR/.sim-dist"
rm -rf "$SIM_TMP"
(cd "$SIM_DIR" && VITE_BASE_PATH="${SITE_BASE}simulator/" npx vite build --outDir "$SIM_TMP" --emptyOutDir --logLevel error)

echo "==> Staging the PYQ app"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$APP/index.html" "$APP/manifest.webmanifest" "$APP/sw.js" "$OUT/"
cp -r "$APP/src" "$APP/icons" "$APP/data" "$OUT/"

echo "==> Staging the case simulator"
mkdir -p "$OUT/simulator"
cp -r "$SIM_TMP/." "$OUT/simulator/"
rm -rf "$SIM_TMP"

echo
echo "Staged $(du -sh "$OUT" | cut -f1) into $OUT"
echo "  PYQ app:   $(find "$OUT" -maxdepth 1 -type f | wc -l | tr -d ' ') files at the root"
echo "  simulator: $(find "$OUT/simulator" -type f | wc -l | tr -d ' ') files"
echo
echo "Serve it with:  python3 -m http.server 8000 --directory $OUT"
