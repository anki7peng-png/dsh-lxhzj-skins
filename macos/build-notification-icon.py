#!/usr/bin/env python3
"""Build the transparent Heixiu notification icon from the supplied artwork.

Keep only the round black Heixiu and its two large eyes.  The pale-green tile,
corner background and floor shadow are removed; a soft pale halo keeps the
black ball visible on dark cards. Export a 1024 master and 512 web PNG.
"""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "macos/notification-heixiu-source.jpg"
MASTER = ROOT / "macos/notification-heixiu-1024.png"
WEB = ROOT / "assets/xiaohei-forest/notification-heixiu.png"

im = Image.open(SOURCE).convert("RGB")
a = np.array(im)
# Near-black body; the cream eyes are holes in this silhouette and are filled below.
dark = (a.max(2) < 95).astype(np.uint8)
dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
contours, _ = cv2.findContours(dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
largest = max(contours, key=cv2.contourArea)
mask = np.zeros(dark.shape, np.uint8)
cv2.drawContours(mask, [largest], -1, 255, -1)
mask = Image.fromarray(mask).filter(ImageFilter.GaussianBlur(1.2))
rgba = Image.new("RGBA", im.size, (0, 0, 0, 0))
rgba.paste(im, (0, 0), mask)

# Tight square canvas with a little breathing room; no badge or shadow.
bbox = rgba.getbbox()
x0, y0, x1, y1 = bbox
w, h = x1 - x0, y1 - y0
side = int(max(w, h) * 1.20)
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.alpha_composite(rgba.crop(bbox), ((side - w) // 2, (side - h) // 2))
master = canvas.resize((1024, 1024), Image.LANCZOS)
# A soft pale-mint halo keeps the black ball legible on dark notification cards.
halo_alpha = master.getchannel("A").filter(ImageFilter.GaussianBlur(30))
halo_alpha = halo_alpha.point(lambda value: min(150, int(value * 0.9)))
halo = Image.new("RGBA", master.size, (222, 235, 203, 0))
halo.putalpha(halo_alpha)
master = Image.alpha_composite(halo, master)
master.save(MASTER)
master.resize((512, 512), Image.LANCZOS).save(WEB)
