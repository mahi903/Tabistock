#!/bin/bash
#
# optimize-images.sh
# images/ 配下の写真をWeb用に一括最適化するスクリプト（mac標準 sips 使用）
#
#   - 長辺が MAX_DIM(px) より大きい画像をリサイズ
#   - JPEG は品質 QUALITY% で再圧縮
#   - 拡張子を小文字に統一（.JPG/.JPEG -> .jpg、.PNG -> .png）※Vercelは大文字小文字を区別するため
#   - 元画像は各フォルダの _original/ に自動バックアップ（既にあればスキップ）
#
# 使い方:
#   ./optimize-images.sh            # images/ 全体を処理
#   ./optimize-images.sh images/mongolia   # 特定フォルダだけ処理
#
set -euo pipefail

MAX_DIM=1600        # 長辺の最大ピクセル
QUALITY=80          # JPEG品質(%)
TARGET="${1:-images}"

# _original バックアップ配下や logo 等の単体素材は対象外にしたい場合はここで除外
process_one() {
  local f="$1"
  local dir base ext lower stem
  dir="$(dirname "$f")"
  base="$(basename "$f")"
  ext="${base##*.}"
  stem="${base%.*}"
  lower="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
  [ "$lower" = "jpeg" ] && lower="jpg"

  # バックアップ（同名が無ければ保存）
  mkdir -p "$dir/_original"
  if [ ! -e "$dir/_original/$base" ]; then
    cp "$f" "$dir/_original/$base"
  fi

  local width
  width="$(sips -g pixelWidth "$f" 2>/dev/null | awk '/pixelWidth/{print $2}')"
  local height
  height="$(sips -g pixelHeight "$f" 2>/dev/null | awk '/pixelHeight/{print $2}')"
  [ -z "${width:-}" ] && { echo "skip(not image): $f"; return; }

  local longest=$width
  [ "$height" -gt "$width" ] && longest=$height

  # リサイズ（長辺がMAX_DIM超のときだけ）
  if [ "$longest" -gt "$MAX_DIM" ]; then
    sips -Z "$MAX_DIM" "$f" >/dev/null
  fi
  # JPEGは再圧縮
  if [ "$lower" = "jpg" ]; then
    sips -s format jpeg -s formatOptions "$QUALITY" "$f" >/dev/null
  fi

  # 拡張子を小文字へ確実にリネーム（macは大小無視なので一時名を経由）
  local target="$dir/$stem.$lower"
  if [ "$f" != "$target" ]; then
    mv "$f" "$f.__tmp__"
    mv "$f.__tmp__" "$target"
  fi

  local newsize
  newsize="$(du -h "$target" | awk '{print $1}')"
  echo "ok: $target  (${longest}px -> max ${MAX_DIM}px, ${newsize})"
}

export -f process_one
export MAX_DIM QUALITY

echo "== optimizing under: $TARGET =="
# _original は除外して画像を列挙
find "$TARGET" -type d -name _original -prune -o \
  -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) -print | while read -r f; do
  process_one "$f"
done
echo "== done. 元画像は各フォルダの _original/ にあります =="
