#!/usr/bin/env bash
# Contrôle qualité des livrables : caractéristiques techniques, sonie, planche d'images extraites du MP4 final.
set -euo pipefail
cd "$(dirname "$0")/.."
F=output/LullinWeb_Ad_2026_Vertical_1080x1920.mp4
QA=${1:-output/tmp/qa}
mkdir -p "$QA"
for f in output/*.mp4; do
  echo "== $f ($(du -h "$f" | cut -f1))"
  ffprobe -v error -show_entries format=duration,bit_rate:stream=codec_name,profile,level,width,height,r_frame_rate,pix_fmt,color_space,color_transfer,color_primaries,sample_rate,channels,nb_frames -of compact=p=0:nk=0 "$f"
done
echo "== Sonie du fichier principal"
ffmpeg -nostats -i "$F" -map 0:a -af ebur128=peak=true -f null - 2>&1 | sed -n '/Summary/,$p' | grep -E "I:|LRA:|Peak:"
echo "== Images extraites"
for t in 0 0.42 0.95 1.8 2.3 3.9 4.6 5.5 6.3 7.2 8.6 9.1 10.1 11.0 11.8 12.4 13.2 14.0 14.31 14.9 15.6 16.3 17.6 18.4 19.6 20.4 21.9 23.3 24.5 25.6 27.1; do
  ffmpeg -v error -y -ss $t -i "$F" -frames:v 1 "$QA/f_$(printf '%07.3f' $t).png"
done
COLS=8 python3 render/contact_sheet.py "$QA/sheet.png" "$QA"/f_*.png
