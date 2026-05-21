#!/usr/bin/env bash
# Verifies that every binary asset under apps/nowflow/public matches the
# file format implied by its extension.
#
# Background — 2026-04-01 a `mona-sans-variable.woff2` was committed that was
# actually an HTML 404 page (botched curl through a proxy that returned
# HTML). It sat in the bundle for 41 days emitting `OTS parsing error:
# invalid sfntVersion: 168430090` (= 0x0A0A0A0A) on every page load before
# anyone noticed. Browsers fell back to system-ui, so no visible breakage —
# only console noise. This script makes the same mistake impossible to land
# again: a single non-binary file in public/ → CI red.
#
# Run locally:   npm run check:assets
# Wired into:    .github/workflows/ci.yml + .husky/pre-commit (lint-staged)
#
# Adding new asset types: extend the case statement with the expected MIME
# prefix and (optionally) the magic-byte signature. Magic-byte check is
# cheap insurance — `file --mime-type` is heuristic and occasionally
# misidentifies short files.

set -euo pipefail

ROOT="${1:-apps/nowflow/public}"
if [ ! -d "$ROOT" ]; then
  echo "check-public-assets: directory not found: $ROOT" >&2
  exit 2
fi

violations=0

while IFS= read -r -d '' file; do
  ext="${file##*.}"
  ext="${ext,,}"
  mime=$(file -b --mime-type "$file")

  case "$ext" in
    woff)
      # WOFF magic = 'wOFF' (0x77 0x4F 0x46 0x46)
      magic=$(head -c 4 "$file" | od -An -t x1 | tr -d ' \n')
      [ "$magic" = "774f4646" ] || { echo "  ✗ $file → magic=$magic mime=$mime (expected wOFF)"; violations=$((violations+1)); }
      ;;
    woff2)
      # WOFF2 magic = 'wOF2' (0x77 0x4F 0x46 0x32)
      magic=$(head -c 4 "$file" | od -An -t x1 | tr -d ' \n')
      [ "$magic" = "774f4632" ] || { echo "  ✗ $file → magic=$magic mime=$mime (expected wOF2)"; violations=$((violations+1)); }
      ;;
    ttf|otf)
      case "$mime" in font/*|application/font-sfnt|application/x-font-ttf) ;;
        *) echo "  ✗ $file → mime=$mime (expected font/*)"; violations=$((violations+1)) ;;
      esac
      ;;
    png)
      # PNG magic = 89 50 4E 47 0D 0A 1A 0A
      magic=$(head -c 8 "$file" | od -An -t x1 | tr -d ' \n')
      [ "$magic" = "89504e470d0a1a0a" ] || { echo "  ✗ $file → magic=$magic (expected PNG)"; violations=$((violations+1)); }
      ;;
    jpg|jpeg)
      # JPEG magic = FF D8 FF
      magic=$(head -c 3 "$file" | od -An -t x1 | tr -d ' \n')
      [ "$magic" = "ffd8ff" ] || { echo "  ✗ $file → magic=$magic (expected JPEG)"; violations=$((violations+1)); }
      ;;
    webp)
      # WebP = 'RIFF????WEBP'
      header=$(head -c 12 "$file" | tr -d '\0')
      case "$header" in RIFF*WEBP) ;;
        *) echo "  ✗ $file → header=$header (expected RIFF…WEBP)"; violations=$((violations+1)) ;;
      esac
      ;;
    gif)
      magic=$(head -c 6 "$file" | tr -d '\0')
      case "$magic" in GIF87a|GIF89a) ;;
        *) echo "  ✗ $file → magic=$magic (expected GIF87a/GIF89a)"; violations=$((violations+1)) ;;
      esac
      ;;
    ico)
      case "$mime" in image/*) ;;
        *) echo "  ✗ $file → mime=$mime (expected image/*)"; violations=$((violations+1)) ;;
      esac
      ;;
    svg)
      # SVG is XML text — verify it's not the literal bytes 0x0A repeated etc.
      case "$mime" in image/svg+xml|text/xml|text/html|application/xml) ;;
        *) echo "  ✗ $file → mime=$mime (expected image/svg+xml)"; violations=$((violations+1)) ;;
      esac
      ;;
    mp3|wav|ogg|mp4|webm|m4a|m4v)
      case "$mime" in audio/*|video/*) ;;
        *) echo "  ✗ $file → mime=$mime (expected audio/* or video/*)"; violations=$((violations+1)) ;;
      esac
      ;;
    pdf)
      magic=$(head -c 5 "$file" | tr -d '\0')
      [ "$magic" = "%PDF-" ] || { echo "  ✗ $file → magic=$magic (expected %PDF-)"; violations=$((violations+1)); }
      ;;
    # Text-by-design files in public/ — skip.
    json|txt|xml|html|css|js|webmanifest|map) continue ;;
    # Skip files without a recognised binary extension.
    *) continue ;;
  esac
done < <(find "$ROOT" -type f -print0)

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "check-public-assets: $violations file(s) FAILED magic-byte check." >&2
  echo "This usually means a download was hijacked by a proxy / login page" >&2
  echo "and an HTML response got saved as a binary asset. Re-fetch from the" >&2
  echo "real source and verify with \`file <path>\` before committing." >&2
  exit 1
fi

echo "check-public-assets: all binary assets in $ROOT match their extension."
