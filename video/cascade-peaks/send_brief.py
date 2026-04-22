#!/usr/bin/env python3
"""
Send the Cascade Peaks Video Decision Brief to Matt.
Phone-first mobile responsive HTML. Wikimedia images load via URL;
owned photos attached as inline cid: images so they render in-email.
"""
import base64
import sys
from pathlib import Path

import requests

ROOT = Path("/sessions/stoic-sweet-dirac/mnt/RyanRealty")
ENV_PATH = ROOT / ".env.local"

RESEND_KEY = None
for line in ENV_PATH.read_text().splitlines():
    if line.startswith("RESEND_API_KEY="):
        RESEND_KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
assert RESEND_KEY, "No RESEND_API_KEY found"

# Owned photos for inline cid attachment
OWNED = {
    "mountain_peak": Path("/sessions/stoic-sweet-dirac/mnt/Documents/Claude/Projects/BRAND MANAGER/Historical_Oregon_Carousel/sunriver_unsplash/photos/mountain_peak.jpg"),
    "mountain_starry": Path("/sessions/stoic-sweet-dirac/mnt/Documents/Claude/Projects/BRAND MANAGER/Historical_Oregon_Carousel/sunriver_unsplash/photos/mountain_starry.jpg"),
    "sunset_high_desert": Path("/sessions/stoic-sweet-dirac/mnt/Documents/Claude/Projects/ASSET_LIBRARY/PHOTOS/by_subject/sunriver/approved/vandevert_community/sunset_high_desert_01_1570452073.jpg"),
}

attachments = []
for cid, path in OWNED.items():
    b = path.read_bytes()
    attachments.append({
        "filename": path.name,
        "content": base64.b64encode(b).decode("utf-8"),
        "content_id": cid,
        "content_type": "image/jpeg",
    })
    print(f"{cid}: {len(b)/1024:.0f} KB")

# Image thumbnails — use Wikimedia "thumb" URLs so phones load fast (~400px wide)
WIKIMEDIA_THUMBS = {
    # Opening card options
    "opening_A": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Summit_South_Sister%2C_Three_Sisters_Wilderness%2C_Deschutes_National_Forest_%2835505538764%29.jpg/600px-Summit_South_Sister%2C_Three_Sisters_Wilderness%2C_Deschutes_National_Forest_%2835505538764%29.jpg",
    "opening_B": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Broken_Top_panorama.jpg/800px-Broken_Top_panorama.jpg",
    "opening_D": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Mt._Bachelor%2C_Oregon%2C_early_morning_-_Flickr_-_Bonnie_Moreland_%28free_images%29.jpg/600px-Mt._Bachelor%2C_Oregon%2C_early_morning_-_Flickr_-_Bonnie_Moreland_%28free_images%29.jpg",
    "opening_E": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Flying_Over_Oregon%27s_Mt._Hood_%2850677129341%29.jpg/600px-Flying_Over_Oregon%27s_Mt._Hood_%2850677129341%29.jpg",
    # Closing card options
    "closing_A": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Mount_Jefferson_and_Three_Fingered_Jack_at_sunset_from_Sand_Mountain_Lookout.jpg/600px-Mount_Jefferson_and_Three_Fingered_Jack_at_sunset_from_Sand_Mountain_Lookout.jpg",
    "closing_C": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Mt_Jefferson_in_snow%2C_Oregon_-_Flickr_-_Bonnie_Moreland_%28free_images%29.jpg/600px-Mt_Jefferson_in_snow%2C_Oregon_-_Flickr_-_Bonnie_Moreland_%28free_images%29.jpg",
}
# Unsplash thumbs — the /photos/<id>/download?w=600 pattern serves up a sized image
UNSPLASH_THUMBS = {
    "closing_B": "https://images.unsplash.com/photo-1603036050141-c61fde866f5c?w=600",  # fallback if direct photo-id fetch fails we use the link
}

# NOTE: Unsplash IDs don't map directly to image URLs without a request — we'll just link out
# For closing_B and closing_D we'll use a gold-framed placeholder + link

html = r"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Cascade Peaks Video — Decision Brief</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1a1a1a;">

<!-- Header -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#102742;">
  <tr><td align="center" style="padding:32px 20px;">
    <p style="margin:0;font-size:12px;color:#D4AF37;letter-spacing:2.5px;text-transform:uppercase;">Ryan Realty Studio</p>
    <h1 style="margin:10px 0 0;font-size:26px;font-weight:700;color:#fff;line-height:1.2;">Cascade Peaks Video</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#a0b4c8;">Decision Brief — three picks to make</p>
  </td></tr>
</table>

<!-- Main body -->
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;">
  <tr><td style="padding:28px 22px 8px;">

    <p style="margin:0 0 18px;font-size:16px;line-height:1.6;color:#1a1a1a;">
      Three decisions before we build. Reply with your picks and we're off — nothing renders until you sign off.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8f9fa;border-left:4px solid #D4AF37;margin:0 0 26px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1.2px;">What I need from you</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
          1. Which peaks make the cut (7–10 recommended)<br>
          2. Opening card photo (A / B / C / D / E / F)<br>
          3. Closing card photo (A / B / C / D / E)
        </p>
      </td></tr>
    </table>

    <!-- ========================================= -->
    <!-- DECISION 1 — PEAKS                         -->
    <!-- ========================================= -->

    <h2 style="margin:0 0 14px;font-size:22px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Decision 1 — Peaks to feature</h2>

    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#444;">
      62 named features in the full master list. These are the 12 peaks locals actually point at.
    </p>

    <p style="margin:22px 0 10px;font-size:13px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1px;">Tier A — The obvious ten</p>
"""

# Tier A rows
tier_a = [
    ("1", "South Sister", "10,358 ft", "29 mi W", "Tallest of the Sisters. Youngest volcano in Oregon (2,000 yrs). The one locals mean when they say 'that big one.'"),
    ("2", "Mt. Bachelor", "9,065 ft", "22 mi WSW", "Bend's ski mountain. The peak on every real-estate shot. Perfect symmetrical cone."),
    ("3", "Broken Top", "9,175 ft", "25 mi WNW", "Shattered caldera rim. The drama-king of the skyline."),
    ("4", "Middle Sister", "10,047 ft", "30 mi WNW", "Classic stratovolcano cone, Hayden Glacier on the east flank."),
    ("5", "North Sister", "10,085 ft", "32 mi WNW", "Oldest and gnarliest of the three. Technical Class 4 climb."),
    ("6", "Three Fingered Jack", "7,841 ft", "64 mi NNW", "The jagged silhouette everybody asks about on Hwy 20."),
    ("7", "Mt. Jefferson", "10,497 ft", "82 mi NNW", "Oregon's 2nd highest. Most glaciated volcano in the state."),
    ("8", "Mt. Washington", "7,794 ft", "47 mi NW", "The needle. Sharpest spire in the Oregon Cascades."),
    ("9", "Black Butte", "6,436 ft", "39 mi NNW", "Textbook cinder cone west of Sisters. You can't drive Hwy 20 without pointing at it."),
    ("10", "Pilot Butte", "4,138 ft", "2 mi E", "In the city. The best vantage to identify everything else on this list."),
]

for n, name, elev, dist, pitch in tier_a:
    html += f"""
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 10px;background:#fafbfc;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:12px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="30" valign="top" style="padding-right:10px;">
              <div style="width:26px;height:26px;background:#102742;color:#D4AF37;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700;">{n}</div>
            </td>
            <td valign="top">
              <p style="margin:0;font-size:16px;font-weight:700;color:#102742;line-height:1.2;">{name}</p>
              <p style="margin:3px 0 0;font-size:12px;color:#888;">{elev} &nbsp;·&nbsp; {dist}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#444;line-height:1.5;">{pitch}</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>"""

html += """
    <p style="margin:28px 0 10px;font-size:13px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1px;">Tier B — Strong additions (pick 2–3 more)</p>
"""

tier_b = [
    ("11", "Lava Butte", "5,020 ft", "10 mi SSW", "Perfect little cinder cone at Newberry NVM. Drive-to summit."),
    ("12", "Paulina Peak", "7,985 ft", "37 mi S", "Looks down into Newberry caldera. 2nd highest-risk volcano in the Cascades."),
    ("13", "Tam McArthur Rim", "7,710 ft", "29 mi WNW", "600-ft cliff over Three Creek Lake. A stunning reveal."),
    ("14", "Belknap Crater", "6,872 ft", "46 mi NW", "Oregon's most recent lava flow (~1,500 yrs). Black-on-green contrast from above."),
]
for n, name, elev, dist, pitch in tier_b:
    html += f"""
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 10px;background:#fafbfc;border:1px solid #e5e7eb;border-radius:8px;">
      <tr><td style="padding:12px 14px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td width="30" valign="top" style="padding-right:10px;">
              <div style="width:26px;height:26px;background:#D4AF37;color:#102742;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700;">{n}</div>
            </td>
            <td valign="top">
              <p style="margin:0;font-size:16px;font-weight:700;color:#102742;line-height:1.2;">{name}</p>
              <p style="margin:3px 0 0;font-size:12px;color:#888;">{elev} &nbsp;·&nbsp; {dist}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#444;line-height:1.5;">{pitch}</p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>"""

html += """

    <p style="margin:18px 0 0;font-size:13px;color:#666;line-height:1.6;font-style:italic;">
      Bookends (optional): Mt. Hood for a bigger opening, or save Diamond Peak / Thielsen / Maiden / Cowhorn for a separate Southern Cascades video.
    </p>

    <!-- ========================================= -->
    <!-- DECISION 2 — OPENING CARD                  -->
    <!-- ========================================= -->

    <h2 style="margin:36px 0 14px;font-size:22px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Decision 2 — Opening card photo</h2>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444;">
      Sets the tone. Holds ~2 sec before the 3D flyover kicks in.
    </p>
"""

# Opening card options
opening_options = [
    {
        "id": "A",
        "name": "South Sister summit — USFS",
        "recommend": True,
        "img_url": WIKIMEDIA_THUMBS["opening_A"],
        "stats": "5,368 × 3,640 · Public Domain · No attribution",
        "pitch": "Official USFS photo, 5K res, mountain fills the frame. Clean morning light, no humans, zero licensing friction. Safe recommended pick.",
    },
    {
        "id": "B",
        "name": "Broken Top panorama above No Name Lake",
        "recommend": False,
        "img_url": WIKIMEDIA_THUMBS["opening_B"],
        "stats": "9,733 × 3,244 · CC-BY-SA 4.0 (attribution + share-alike caveat)",
        "pitch": "Most editorially dramatic Broken Top shot anywhere. Oct light, Bachelor in the background. Share-alike clause needs a quick legal sign-off if we go with this.",
    },
    {
        "id": "C",
        "name": "Owned — mountain_peak.jpg",
        "recommend": False,
        "img_cid": "mountain_peak",
        "stats": "1,920 × 1,280 · Unsplash in library (intake, needs your approval)",
        "pitch": "Highest-res landscape we own. Clean peak composition. If you want the opener to come from our library, this is it.",
    },
    {
        "id": "D",
        "name": "Mt. Bachelor, Bonnie Moreland early morning",
        "recommend": False,
        "img_url": WIKIMEDIA_THUMBS["opening_D"],
        "stats": "5,167 × 2,951 · Public Domain · No attribution",
        "pitch": "Bachelor anchors Bend. Strong 'home' opener. Clean cone silhouette, early morning light, zero crowds.",
    },
    {
        "id": "E",
        "name": "Mt. Hood aerial flyover",
        "recommend": False,
        "img_url": WIKIMEDIA_THUMBS["opening_E"],
        "stats": "5,021 × 2,824 · CC-BY 2.0 (credit G. Lamar Yancy)",
        "pitch": "Aerial POV directly supports the 'flyover' concept. Hood isn't Central Oregon, but it's the instant-Oregon shot.",
    },
    {
        "id": "F",
        "name": "Owned — mountain_starry.jpg",
        "recommend": False,
        "img_cid": "mountain_starry",
        "stats": "1,920 × 1,281 · Unsplash in library (intake)",
        "pitch": "Night sky + mountain peak. Unique mood in our library. Slow zoom into stars before 3D takes over. Wildcard if you want moody.",
    },
]

for opt in opening_options:
    img_src = f'cid:{opt["img_cid"]}' if opt.get("img_cid") else opt["img_url"]
    ribbon = ''
    if opt["recommend"]:
        ribbon = '<span style="display:inline-block;background:#D4AF37;color:#102742;font-size:10px;font-weight:700;letter-spacing:1.2px;padding:3px 8px;border-radius:3px;vertical-align:middle;margin-right:8px;">RECOMMEND</span>'
    html += f"""
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border:2px solid {'#D4AF37' if opt['recommend'] else '#e5e7eb'};border-radius:10px;overflow:hidden;">
      <tr><td>
        <img src="{img_src}" width="100%" alt="Option {opt['id']} — {opt['name']}" style="display:block;width:100%;height:auto;max-width:600px;">
      </td></tr>
      <tr><td style="padding:14px 16px 16px;background:#fff;">
        <p style="margin:0 0 6px;font-size:12px;color:#888;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Option {opt['id']}</p>
        <p style="margin:0 0 8px;font-size:17px;color:#102742;font-weight:700;line-height:1.25;">{ribbon}{opt['name']}</p>
        <p style="margin:0 0 10px;font-size:12px;color:#666;font-family:monospace;">{opt['stats']}</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.55;">{opt['pitch']}</p>
      </td></tr>
    </table>"""

html += """

    <!-- ========================================= -->
    <!-- DECISION 3 — CLOSING CARD                  -->
    <!-- ========================================= -->

    <h2 style="margin:36px 0 14px;font-size:22px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Decision 3 — Closing card photo</h2>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#444;">
      Sits behind the navy card with the white Ryan Realty logo and 541.213.6706. Needs to grade into navy without fighting it.
    </p>
"""

closing_options = [
    {
        "id": "A",
        "name": "Jefferson + Three Fingered Jack at sunset (Sand Mountain)",
        "recommend": True,
        "img_url": WIKIMEDIA_THUMBS["closing_A"],
        "stats": "4,032 × 3,024 · CC-BY 4.0 (credit Mattsjc)",
        "pitch": "Only true sunset shot with clean CC-BY (no share-alike) in the whole set. Warm palette grades into navy overlay beautifully. Two iconic peaks locals recognize. Safe recommended pick.",
    },
    {
        "id": "B",
        "name": "Mountain silhouette sunset — aerial over Bend (DJI)",
        "recommend": False,
        "img_url": None,
        "unsplash_url": "https://unsplash.com/photos/e1HW05U5A1k",
        "stats": "Unsplash · Free commercial · No attribution",
        "pitch": "Drone aerial sunset silhouette shot in Bend. Minimal, graphic, sits perfectly under a navy overlay. Tap to preview.",
    },
    {
        "id": "C",
        "name": "Mt. Jefferson in snow (Bonnie Moreland)",
        "recommend": False,
        "img_url": WIKIMEDIA_THUMBS["closing_C"],
        "stats": "5,103 × 3,320 · Public Domain · No attribution",
        "pitch": "Full PD, high res, winter mood, clean snow-covered cone. Works well with white logo on navy overlay.",
    },
    {
        "id": "D",
        "name": "Black Butte sunset silhouette — Prineville",
        "recommend": False,
        "img_url": None,
        "unsplash_url": "https://unsplash.com/photos/f5idoAO4F6U",
        "stats": "Unsplash · Free commercial · No attribution",
        "pitch": "Pure silhouette against warm sky. Minimal. Quiet close. Tap to preview.",
    },
    {
        "id": "E",
        "name": "Owned — high-desert sunset with Cascade silhouette",
        "recommend": False,
        "img_cid": "sunset_high_desert",
        "stats": "1,000 × 667 · Already approved in library",
        "pitch": "Lower res for a closing card, but it's our asset. Keeps the closer entirely in-house.",
    },
]

for opt in closing_options:
    if opt.get("img_cid"):
        img_html = f'<img src="cid:{opt["img_cid"]}" width="100%" alt="{opt["name"]}" style="display:block;width:100%;height:auto;max-width:600px;">'
    elif opt.get("img_url"):
        img_html = f'<img src="{opt["img_url"]}" width="100%" alt="{opt["name"]}" style="display:block;width:100%;height:auto;max-width:600px;">'
    else:
        # Unsplash fallback — link block with gold frame
        img_html = f'''<a href="{opt["unsplash_url"]}" style="text-decoration:none;display:block;background:#102742;color:#D4AF37;text-align:center;padding:60px 20px;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Preview on Unsplash →</a>'''

    ribbon = ''
    if opt["recommend"]:
        ribbon = '<span style="display:inline-block;background:#D4AF37;color:#102742;font-size:10px;font-weight:700;letter-spacing:1.2px;padding:3px 8px;border-radius:3px;vertical-align:middle;margin-right:8px;">RECOMMEND</span>'
    html += f"""
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;border:2px solid {'#D4AF37' if opt['recommend'] else '#e5e7eb'};border-radius:10px;overflow:hidden;">
      <tr><td>{img_html}</td></tr>
      <tr><td style="padding:14px 16px 16px;background:#fff;">
        <p style="margin:0 0 6px;font-size:12px;color:#888;letter-spacing:1.5px;text-transform:uppercase;font-weight:700;">Option {opt['id']}</p>
        <p style="margin:0 0 8px;font-size:17px;color:#102742;font-weight:700;line-height:1.25;">{ribbon}{opt['name']}</p>
        <p style="margin:0 0 10px;font-size:12px;color:#666;font-family:monospace;">{opt['stats']}</p>
        <p style="margin:0;font-size:14px;color:#333;line-height:1.55;">{opt['pitch']}</p>
      </td></tr>
    </table>"""

html += """

    <!-- ========================================= -->
    <!-- PER-PEAK LIBRARY                           -->
    <!-- ========================================= -->

    <h2 style="margin:36px 0 14px;font-size:22px;color:#102742;font-weight:700;letter-spacing:-0.3px;border-bottom:2px solid #D4AF37;padding-bottom:8px;">Per-peak photo library</h2>

    <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#444;">
      For the callouts mid-flyover (and as fallbacks if a given 3D tile render comes out weak). Already vetted per license.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr style="background:#102742;">
        <th align="left" style="padding:10px 12px;color:#D4AF37;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Peak</th>
        <th align="left" style="padding:10px 12px;color:#D4AF37;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Best shot</th>
        <th align="left" style="padding:10px 12px;color:#D4AF37;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">License</th>
      </tr>
"""

library = [
    ("South Sister", "USFS summit (5,368×3,640)", "PD"),
    ("Mt. Bachelor", "Moreland early-morning (5,167×2,951)", "PD"),
    ("Broken Top", "USGS from Sparks Lake (3,296×2,131)", "PD"),
    ("Middle/North Sister", "USGS aerial all-three", "PD"),
    ("Three Fingered Jack", "NE face w/ glacier (5,312×2,988)", "CC-BY-SA 4.0"),
    ("Mt. Jefferson", "Moreland snow (5,103×3,320)", "PD"),
    ("Mt. Washington", "Moreland snow (5,905×3,855)", "PD"),
    ("Black Butte", "Canyon Creek Meadows (6,240×3,510)", "CC-BY 4.0"),
    ("Pilot Butte", "Bend cityscape (4,000×3,000)", "CC-BY-SA 3.0"),
    ("Lava Butte", "(sourcing gap)", "Shutterstock fallback"),
    ("Paulina Peak", "Chris Light caldera pano (13,955×3,575)", "CC-BY-SA 4.0"),
    ("Three Sisters (group)", "USGS aerial from south", "PD"),
]
for i, (peak, shot, lic) in enumerate(library):
    bg = "#fafbfc" if i % 2 == 0 else "#fff"
    html += f"""
      <tr style="background:{bg};">
        <td style="padding:10px 12px;font-size:13px;color:#102742;font-weight:600;border-top:1px solid #e5e7eb;">{peak}</td>
        <td style="padding:10px 12px;font-size:13px;color:#333;border-top:1px solid #e5e7eb;">{shot}</td>
        <td style="padding:10px 12px;font-size:12px;color:#666;font-family:monospace;border-top:1px solid #e5e7eb;">{lic}</td>
      </tr>"""

html += """
    </table>

    <!-- Next steps box -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8f9fa;border-left:4px solid #102742;margin:36px 0 24px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#102742;text-transform:uppercase;letter-spacing:1.2px;">Once you reply</p>
        <p style="margin:0 0 8px;font-size:13px;color:#333;line-height:1.65;">
          1. License-clean your chosen photos (PD / Unsplash pulled direct; Shutterstock handles any gaps)<br>
          2. Build the Remotion comp with @react-three/fiber + NASA-AMMOS 3D Tiles renderer<br>
          3. Camera choreography — Andras Ra ease-in/ease-out + asymmetric speed ramps<br>
          4. ElevenLabs-cloned Matt voiceover<br>
          5. Portrait 1080×1920 @ 30fps, &lt;4MB H.264 for IG<br>
          6. Closing card locked per market-report standard (navy + white logo + 541.213.6706)
        </p>
      </td></tr>
    </table>

    <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;line-height:1.65;">
      Reply with the three picks and we're off.
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
    "subject": "Cascade Peaks Video — three picks to make",
    "html": html,
    "attachments": attachments,
}

resp = requests.post(
    "https://api.resend.com/emails",
    headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
    json=payload,
    timeout=120,
)
print(f"Status: {resp.status_code}")
print(f"Response: {resp.text}")
sys.exit(0 if resp.status_code in (200, 201) else 2)
