#!/bin/bash
set -e

SRC="D:/src/aicoding/openhanako"
DST="D:/src/aicoding/remu"

fix_file() {
    local f="$1"
    # Add // @ts-nocheck if not present
    if ! head -1 "$f" | grep -q "@ts-nocheck"; then
        sed -i '1i\// @ts-nocheck' "$f"
    fi
    # Fix .ts imports to .js
    sed -i "s/\.ts'/\.js'/g" "$f"
    sed -i 's/\.ts"/\.js"/g' "$f"
}

for i in $(seq 1 100); do
    echo "[$i] Trying server..."
    OUTPUT=$(node -e "try { require('./dist/server/index.js'); } catch(e) { console.error(e.message); }" 2>&1)
    
    if [ -z "$OUTPUT" ]; then
        echo "✅ Server loaded successfully!"
        break
    fi
    
    MODULE=$(echo "$OUTPUT" | grep -oP "Cannot find module '\K[^']+" | head -1)
    if [ -z "$MODULE" ]; then
        echo "Unknown error: $OUTPUT"
        break
    fi
    
    # Convert dist/lib/foo.js to lib/foo.ts
    REL=$(echo "$MODULE" | sed 's|.*/dist/||' | sed 's|\.js$|.ts|')
    echo "  Missing: $REL"
    
    # Find in openhanako
    SRC_FILE=$(find "$SRC/lib" "$SRC/core" "$SRC/server" "$SRC/shared" "$SRC/plugins" -name "$(basename $REL)" 2>/dev/null | head -1)
    if [ -z "$SRC_FILE" ]; then
        echo "  NOT FOUND in openhanako"
        break
    fi
    
    DST_FILE="$DST/$REL"
    mkdir -p "$(dirname $DST_FILE)"
    cp "$SRC_FILE" "$DST_FILE"
    echo "  Copied: $SRC_FILE -> $DST_FILE"
    
    fix_file "$DST_FILE"
    
    echo "  Recompiling..."
    node ./node_modules/typescript/bin/tsc 2>&1 | tail -20
done
