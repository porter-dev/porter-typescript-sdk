#!/usr/bin/env bash
# Sync generated SDK code from the sdk-gen workspace into this repo.
#
# Usage: ./scripts/sync-generated.sh <path/to/sdk-gen/out/typescript>
#
# Copies only files that the emitter owns. Hand-written runtime/domain files
# (_baseClient.ts, _config.ts, _retries.ts, sandbox.ts, index.ts) are
# preserved.

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <path/to/sdk-gen/out/typescript>" >&2
    exit 1
fi

SRC="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -d "$SRC/src" ]]; then
    echo "Error: $SRC/src not found" >&2
    exit 1
fi

# Files the emitter owns (overwrite freely).
GENERATED_FILES=(
    src/_client.ts
    src/_errors.ts
    src/_models.ts
    src/enums.ts
)

for f in "${GENERATED_FILES[@]}"; do
    if [[ -f "$SRC/$f" ]]; then
        cp "$SRC/$f" "$REPO_ROOT/$f"
        echo "  copied $f"
    fi
done

# Public client and namespace wrappers are generated too. Copy top-level
# generated modules, but preserve hand-written runtime/domain modules.
# Note: src/index.ts is hand-written (it re-exports the public client/domain
# classes alongside generated wrappers). Don't sync it.
for f in "$SRC"/src/*.ts; do
    name="$(basename "$f")"
    case "$name" in
        index.ts|_*.ts|enums.ts|sandbox.ts)
            continue
            ;;
    esac
    cp "$f" "$REPO_ROOT/src/$name"
    echo "  copied src/$name"
done

# Resources are a whole directory.
rm -rf "$REPO_ROOT/src/resources"
cp -r "$SRC/src/resources" "$REPO_ROOT/src/resources"
echo "  copied src/resources/"

# Generated tests go alongside hand-written ones.
mkdir -p "$REPO_ROOT/tests"
if [[ -f "$SRC/tests/models.test.ts" ]]; then
    cp "$SRC/tests/models.test.ts" "$REPO_ROOT/tests/models.test.ts"
    echo "  copied tests/models.test.ts"
fi

echo "Done."
