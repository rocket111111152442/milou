"""Calque de contrôle des zones occupées par les interfaces TikTok / Reels / Shorts (repères indicatifs)."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
z = json.load(open(os.path.join(ROOT, 'src', 'timeline.json')))['safeZone']
im = Image.new('RGBA', (1080, 1920), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
red = (255, 70, 70, 70)
d.rectangle([0, 0, 1080, 220], fill=red)                    # en-tête de l'application
d.rectangle([0, 1480, 1080, 1920], fill=red)                # légende, pseudo, musique, barre de navigation
d.rectangle([z['right'], 760, 1080, 1480], fill=red)        # colonne d'icônes (j'aime, commentaires, partage)
d.rectangle([z['left'], z['top'], z['right'], z['bottom']], outline=(194, 249, 58, 255), width=4)
try:
    f = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Bold.otf', 28)
except Exception:
    f = ImageFont.load_default()
d.text((24, 160), 'ZONE INTERFACE (haut)', fill=(255, 255, 255, 230), font=f)
d.text((24, 1500), 'ZONE INTERFACE (légende, boutons)', fill=(255, 255, 255, 230), font=f)
d.text((z['left'] + 10, z['top'] + 8), f"ZONE SÛRE {z['left']}–{z['right']} × {z['top']}–{z['bottom']}", fill=(194, 249, 58, 255), font=f)
im.save(sys.argv[1])
