"""Planche contact : python3 render/contact_sheet.py sortie.png img1.png img2.png ... (étiquette = temps)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont

out, files = sys.argv[1], sys.argv[2:]
cols = int(os.environ.get('COLS', 5))
tw, th = 270, 480
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * (th + 26)), (40, 40, 40))
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS)
    x, y = (i % cols) * tw, (i // cols) * (th + 26)
    sheet.paste(im, (x, y + 26))
    lab = os.path.basename(f).replace('f_', '').replace('.png', '') + 's'
    d.text((x + 6, y + 6), lab, fill=(210, 253, 121))
sheet.save(out)
print(out, sheet.size)
