#!/usr/bin/env python3
"""
Send the Cascade Peaks Video v1 to Matt for review.
Attaches compressed MP4, inlines per-scene thumbnails, IG/TikTok/FB captions.
"""
import base64
import sys
from pathlib import Path

import requests

HERE = Path(__file__).parent
OUT = HERE / "out"
ROOT = Path("/sessions/stoic-sweet-dirac/mnt/RyanRealty")
ENV_PATH = ROOT / ".env.local"

RESEND_KEY = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("RESEND_API_KEY="):
        RESEND_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
assert RESEND_KEY, "No RESEND_API_KEY found"

# --- Attach the compressed MP4 + inline scene thumbs ---------------------
MP4 = OUT / "cascade_peaks_v1.mp4"
assert MP4.exists(), f"Missing compressed MP4: {MP4}"
mp4_bytes = MP4.read_bytes()
mp4_kb = len(mp4_bytes) / 1024
print(f"MP4: {mp4_kb:.0f} KB ({mp4_kb/1024:.1f} MB)")

attachments = [{
    "filename": "cascade_peaks_v1.mp4",
    "content": base64.b64encode(mp4_bytes).decode("utf-8"),
    "content_type": "video/mp4",
}]

# Scene thumbnails for inline display (cid: references)
SCENES = [
    ("open",    "thumb_open.jpg",       "Opening",               "Jefferson alpenglow + hook: \"How many can you name from Bend?\""),
    ("aubrey",  "thumb_aubrey.jpg",     "Aubrey Butte pan",      "Aubrey vantage sweep, 244° → 337° — Bachelor to Jefferson labeled in real time."),
    ("paulina", "thumb_paulina.jpg",    "Peak 1 — Paulina",      "Newberry Caldera rim, youngest eruption in Oregon (~1,300 yrs)."),
    ("bach",    "thumb_bachelor.jpg",   "Peak 2 — Mt. Bachelor", "Symmetrical cone, Oregon's largest ski area."),
    ("broken",  "thumb_broken_top.jpg", "Peak 3 — Broken Top",   "Shattered caldera, the jagged one that looks bitten."),
    ("south",   "thumb_south.jpg",      "Peak 4 — South Sister", "Oregon's 3rd highest, Teardrop Pool at summit."),
    ("middle",  "thumb_middle.jpg",     "Peak 5 — Middle Sister","The forgotten Sister — Hayden Glacier on her east face."),
    ("north",   "thumb_north.jpg",      "Peak 6 — North Sister", "Oldest Sister, the Terrible Traverse."),
    ("wash",    "thumb_wash.jpg",       "Peak 7 — Mt. Washington","Volcanic plug — the inside of a volcano, glaciers ate the rest."),
    ("jack",    "thumb_jack.jpg",       "Peak 8 — 3F Jack",      "Three jagged spires, shredded down from a 12,000 ft volcano."),
    ("black",   "thumb_black.jpg",      "Peak 9 — Black Butte",  "Textbook cone on the Sisters drive."),
    ("jeff",    "thumb_jeff.jpg",       "Peak 10 — Jefferson",   "Oregon's 2nd highest, five glaciers, ~200 summits/yr."),
    ("close",   "thumb_close.jpg",      "Closing",               "Washington silhouette + Ryan Realty contact card."),
]

for cid, name, _, _ in SCENES:
    p = OUT / name
    assert p.exists(), f"Missing thumbnail: {p}"
    b = p.read_bytes()
    attachments.append({
        "filename": name,
        "content": base64.b64encode(b).decode("utf-8"),
        "content_id": cid,
        "content_type": "image/jpeg",
    })

# --- HTML email body -----------------------------------------------------
scene_rows = ""
for cid, _, title, note in SCENES:
    scene_rows += f"""
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr><td><img src="cid:{cid}" width="100%" alt="{title}" style="display:block;width:100%;height:auto;max-width:600px;"></td></tr>
      <tr><td style="padding:12px 14px 14px;background:#fff;">
        <p style="margin:0 0 4px;font-size:11px;color:#888;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;">{title}</p>
        <p style="margin:0;font-size:13px;color:#333;line-height:1.55;">{note}</p>
      </td></tr>
    </table>"""

html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Cascade Peaks Video — v1</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">

<!-- Header -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#102742;">
  <tr><td align="center" style="padding:32px 20px;">
    <p style="margin:0;font-size:12px;color:#D4AF37;letter-spacing:2.5px;text-transform:uppercase;">Ryan Realty Studio</p>
    <h1 style="margin:10px 0 0;font-size:26px;font-weight:700;color:#fff;line-height:1.2;">Cascade Peaks — v1</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#a0b4c8;">99.4 sec, 1080×1920, 30 fps</p>
  </td></tr>
</table>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;">
  <tr><td style="padding:28px 22px 8px;">

    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#1a1a1a;">
      MP4 attached. 13 scenes: opening card, Aubrey Butte pan across the skyline, ten peak deep-dives with fact cards, closing card. All camera orbits use Google Photorealistic 3D Tiles; the two bookend stills are your graded Jefferson and Washington photos.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8f9fa;border-left:4px solid #D4AF37;margin:0 0 26px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1.2px;">What I want your eye on</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
          1. Peak order + pacing (8.5 sec per peak — enough to read every fact?)<br>
          2. Aubrey pan readability — callouts pop as camera reaches each bearing<br>
          3. Fact card copy, one peak at a time. Flag anything that reads stiff.<br>
          4. Bookends (Jefferson opener, Washington closer) — warm enough?
        </p>
      </td></tr>
    </table>

    <h2 style="margin:0 0 14px;font-size:20px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Scene by scene</h2>
    {scene_rows}

    <h2 style="margin:28px 0 14px;font-size:20px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Draft captions</h2>

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1px;">Instagram Reel</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fafbfc;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:14px;color:#333;line-height:1.7;">
          How many Cascade peaks can you name from Bend?<br><br>
          Here are all 10, and how to spot each — from the youngest eruption in Oregon to the sharpest spire in the state.<br><br>
          Save this for your next trip up Aubrey Butte. Which one did you learn today?<br><br>
          #Bend #BendOregon #CentralOregon #CascadeRange #Volcanoes #MtBachelor #ThreeSisters #MtJefferson #PNW #RyanRealty
        </p>
      </td></tr>
    </table>

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1px;">TikTok</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fafbfc;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:14px;color:#333;line-height:1.7;">
          10 Cascade peaks you can see from Bend. Save this before your next hike.<br><br>
          #BendOregon #CentralOregon #Cascades #Volcanoes #PNW #MtBachelor #ThreeSisters #Jefferson #LearnOnTikTok #OregonLife
        </p>
      </td></tr>
    </table>

    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1px;">Facebook</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#fafbfc;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 22px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:14px;color:#333;line-height:1.7;">
          Ten peaks, one skyline. Every mountain on the horizon from Bend — named, measured, and matched to its story.<br><br>
          From Paulina (the youngest eruption in Oregon, about 1,300 years ago) to Jefferson (Oregon's 2nd tallest, five glaciers), here's how to read the Central Oregon skyline from your favorite viewpoint.<br><br>
          Which one is your favorite view from Bend?
        </p>
      </td></tr>
    </table>

    <h2 style="margin:28px 0 14px;font-size:20px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">What's next</h2>

    <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#333;">
      Reply with any changes. Common next passes: tightening the pan speed, swapping a peak's hook line, or re-grading a peak's orbit if tile detail reads soft. Once you sign off, we post as a Reel + TikTok + FB video the same day.
    </p>

  </td></tr>
</table>
</td></tr></table>

<!-- Footer -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#102742;">
  <tr><td align="center" style="padding:22px 20px;">
    <p style="margin:0;font-size:12px;color:#6a8aa8;">Ryan Realty &middot; Bend, Oregon &middot; 541.213.6706</p>
  </td></tr>
</table>

</body>
</html>
"""

payload = {
    "from": "Ryan Realty Studio <onboarding@resend.dev>",
    "to": ["matt@ryan-realty.com"],
    "subject": "Cascade Peaks Video — v1 ready for review",
    "html": html,
    "attachments": attachments,
}

resp = requests.post(
    "https://api.resend.com/emails",
    headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
    json=payload,
    timeout=180,
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")
sys.exit(0 if resp.status_code in (200, 201) else 2)
