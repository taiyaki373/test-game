#!/usr/bin/env bash
set -e
OUT_DIR="test-results/screenshots"
OUT_GIF="test-results/gameplay.gif"

mkdir -p "test-results"

if [ ! -d "$OUT_DIR" ] || [ -z "$(ls -A $OUT_DIR 2>/dev/null)" ]; then
  echo "No screenshots found in $OUT_DIR. Run Playwright tests to generate screenshots first."
  exit 1
fi

if command -v ffmpeg >/dev/null 2>&1; then
  echo "Building GIF using ffmpeg..."
  # Create palette for quality
  ffmpeg -y -framerate 10 -pattern_type glob -i "$OUT_DIR/*.png" -vf "palettegen" /tmp/aegis_palette.png
  ffmpeg -y -framerate 10 -pattern_type glob -i "$OUT_DIR/*.png" -i /tmp/aegis_palette.png -lavfi "paletteuse" "$OUT_GIF"
  rm -f /tmp/aegis_palette.png
  echo "GIF written to $OUT_GIF"
  exit 0
fi

if command -v convert >/dev/null 2>&1; then
  echo "Building GIF using ImageMagick convert..."
  convert -delay 10 -loop 0 "$OUT_DIR"/*.png "$OUT_GIF"
  echo "GIF written to $OUT_GIF"
  exit 0
fi

echo "Neither ffmpeg nor ImageMagick 'convert' found. Install one to assemble a GIF."
exit 1
