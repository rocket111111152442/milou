#!/usr/bin/env bash
# Assemblage des blocs rendus, normalisation audio et export des livrables.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=output/tmp
OUT=output
NAME=LullinWeb_Ad_2026_Vertical_1080x1920
MIX=assets/audio/lullin_ad_mix.wav

# 1) Master image (sans perte, 60 i/s, RVB)
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/chunks.txt" -c copy "$TMP/master.mkv"

# 2) Normalisation audio en deux passes : -14 LUFS intégrés, crête vraie -1 dBTP (recommandations réseaux sociaux)
M=$(ffmpeg -hide_banner -nostats -i "$MIX" -af loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'])")
mtp=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_tp'])")
mlra=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_lra'])")
mth=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_thresh'])")
moff=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['target_offset'])")
ffmpeg -v error -y -i "$MIX" -af "loudnorm=I=-14:TP=-2.0:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:offset=$moff:linear=true,aresample=48000" -c:a pcm_s24le "$TMP/mix_norm.wav"

# 3) Encodage H.264 Rec.709 (léger grain de luminance contre les aplats en bandes)
VF="format=gbrp,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,noise=c0s=2:c0f=t"
X264=(-c:v libx264 -preset slow -crf 16 -maxrate 30M -bufsize 60M -profile:v high -level:v 4.2 -pix_fmt yuv420p
      -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709")
AAC=(-c:a aac -b:a 320k -ar 48000 -ac 2)

# Principal : 60 i/s + son
ffmpeg -v error -y -i "$TMP/master.mkv" -i "$TMP/mix_norm.wav" -map 0:v -map 1:a -vf "$VF" -r 60 -g 120 "${X264[@]}" "${AAC[@]}" -shortest -movflags +faststart "$OUT/$NAME.mp4"
# Sans son (même image)
ffmpeg -v error -y -i "$OUT/$NAME.mp4" -map 0:v -c copy -an -movflags +faststart "$OUT/${NAME}_SansAudio.mp4"
# 30 i/s (chaque image garde une exposition de 1/60 s = obturateur 180°)
ffmpeg -v error -y -i "$TMP/master.mkv" -i "$TMP/mix_norm.wav" -map 0:v -map 1:a -vf "fps=30,$VF" -r 30 -g 60 "${X264[@]}" "${AAC[@]}" -shortest -movflags +faststart "$OUT/${NAME}_30fps.mp4"
# Contrôle des zones sûres (calque indicatif, à ne pas publier)
python3 render/safe_overlay.py "$TMP/safe.png"
ffmpeg -v error -y -i "$OUT/${NAME}_30fps.mp4" -i "$TMP/safe.png" -filter_complex "[0:v][1:v]overlay=0:0,format=yuv420p" -c:v libx264 -preset medium -crf 20 -c:a copy -movflags +faststart "$OUT/${NAME}_ControleZonesSures.mp4"
# Vignette (image de couverture)
ffmpeg -v error -y -ss 25.6 -i "$TMP/master.mkv" -frames:v 1 "$OUT/${NAME}_Couverture.png"
ls -la "$OUT"
