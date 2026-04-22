#!/usr/bin/env python3
"""Send Jefferson + Washington photo picks to Matt for approval.

All photos sourced from Unsplash (Unsplash License — free commercial, no attribution required).
"""

import base64
import json
import os
import sys
import urllib.request

ENV_PATH = "/sessions/stoic-sweet-dirac/mnt/RyanRealty/.env.local"
PEAK_DIR = "/sessions/stoic-sweet-dirac/mnt/RyanRealty/peak_options"

def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
RESEND_KEY = env["RESEND_API_KEY"]

# Inline attachments (cid references in HTML)
JEFFERSON = [
    ("jefferson_1", "jefferson_unsplash_1.jpg", "Jefferson — Pre-dawn blue hour, distant profile",
     "Peter Thomas", "Unsplash", "4000×2667", "Quiet, cinematic, distant-skyline energy. Bend-feel."),
    ("jefferson_2", "jefferson_unsplash_2.jpg", "Jefferson — Dramatic alpenglow sunset with cloud cap",
     "Dan Meyers", "Unsplash", "3992×2992", "The hero. Golden alpenglow hitting the double-summit, wild cloud cap overhead. Cinema-grade opener."),
    ("jefferson_3", "jefferson_unsplash_3.jpg", "Jefferson — Sunset over Detroit Lake",
     "Dan Meyers", "Unsplash", "9504×6052", "Warm horizon, mirror lake foreground, rugged craggy summit. Very 'Oregon.'"),
]

WASHINGTON = [
    ("washington_1", "washington_unsplash_1.jpg", "Washington — Moody clouds + sharp pinnacle",
     "Dan Meyers", "Unsplash", "9504×6336", "The spire. Mt Washington's volcanic plug silhouetted against stormlight. Unmistakable."),
    ("washington_2", "washington_unsplash_3.jpg", "Washington + Sisters at alpenglow (Hwy 20 context)",
     "Dan Meyers", "Unsplash", "5750×3833", "Jagged Washington right, Three Sisters background left. Shows the closing card in its Cascade context."),
]

BRAND_NAVY = "#102742"
BRAND_GOLD = "#D4AF37"
BRAND_CREAM = "#F5EFE2"

def b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def card(cid, title, photog, source, res, blurb, badge=None):
    badge_html = ""
    if badge:
        badge_html = f'<div style="position:absolute;top:14px;right:14px;background:{BRAND_GOLD};color:{BRAND_NAVY};font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:900;letter-spacing:1.5px;padding:6px 10px;border-radius:3px;">{badge}</div>'
    return f'''
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px 0;background:{BRAND_CREAM};border-radius:12px;overflow:hidden;border:1px solid #e5e0d0;">
      <tr>
        <td style="position:relative;padding:0;">
          <div style="position:relative;line-height:0;">
            <img src="cid:{cid}" alt="{title}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />
            {badge_html}
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 20px 20px 20px;">
          <div style="font-family:Georgia,serif;font-size:17px;font-weight:700;color:{BRAND_NAVY};margin:0 0 6px 0;line-height:1.3;">{title}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#555;margin:0 0 10px 0;">{photog} · {source} · {res}</div>
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#333;line-height:1.5;">{blurb}</div>
        </td>
      </tr>
    </table>'''

def section(heading, subline, cards):
    return f'''
    <tr>
      <td style="padding:28px 24px 8px 24px;">
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:{BRAND_NAVY};letter-spacing:-0.3px;margin:0 0 4px 0;">{heading}</div>
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#666;margin:0 0 20px 0;">{subline}</div>
        {cards}
      </td>
    </tr>'''

def build():
    att = []
    def add(cid, fn):
        path = os.path.join(PEAK_DIR, fn)
        att.append({"filename": fn, "content": b64(path), "content_id": cid})
        size_kb = os.path.getsize(path) // 1024
        print(f"  {cid}: {size_kb} KB")

    cards_j = []
    for i, (cid, fn, title, photog, source, res, blurb) in enumerate(JEFFERSON):
        add(cid, fn)
        badge = "TOP PICK" if i == 1 else None
        cards_j.append(card(cid, f"Jefferson · Option {i+1}", photog, source, res, blurb, badge=badge))

    cards_w = []
    for i, (cid, fn, title, photog, source, res, blurb) in enumerate(WASHINGTON):
        add(cid, fn)
        badge = "TOP PICK" if i == 0 else None
        cards_w.append(card(cid, f"Washington · Option {i+1}", photog, source, res, blurb, badge=badge))

    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Opening + Closing photo picks</title>
</head>
<body style="margin:0;padding:0;background:#f0ede4;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f0ede4;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;">

          <!-- HERO -->
          <tr>
            <td style="background:{BRAND_NAVY};padding:32px 24px;color:#ffffff;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;color:{BRAND_GOLD};text-transform:uppercase;margin:0 0 10px 0;">Cascade Peaks Video · Photo Picks</div>
              <div style="font-family:Georgia,serif;font-size:26px;font-weight:700;line-height:1.2;margin:0 0 8px 0;">Jefferson for the opener. Washington for the close.</div>
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#cfd6e0;line-height:1.5;margin:0;">3 Jefferson options, 2 Washington options. All from Unsplash (free commercial, no attribution required). Top picks flagged. Reply with your numbers — e.g. <strong style="color:{BRAND_GOLD};">Jefferson 2, Washington 1</strong> — and I'll lock it in and render.</div>
            </td>
          </tr>

          {section("Opening Card · Mt. Jefferson", "10,497 ft · 82 mi NNW from Bend · the tallest peak on the list.", "".join(cards_j))}

          {section("Closing Card · Mt. Washington", "7,794 ft · 47 mi NW from Bend · the sharp volcanic plug in the skyline.", "".join(cards_w))}

          <!-- Creative direction confirmed -->
          <tr>
            <td style="padding:8px 24px 28px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#102742;border-radius:10px;">
                <tr>
                  <td style="padding:22px 24px;color:#ffffff;">
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:3px;color:{BRAND_GOLD};text-transform:uppercase;margin:0 0 10px 0;">Creative direction locked</div>
                    <div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#ffffff;margin:0 0 12px 0;">Playful, not a nature documentary.</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#cfd6e0;line-height:1.6;margin:0 0 10px 0;">Every peak gets elevation, origin story, and the one distinguishing feature that lets you pick it out of the skyline. Broken Top looks like someone took a bite out of it. Black Butte looks like a giant anthill. Washington is the sharp spire. That's the value — you walk away able to say "that's Three Fingered Jack" the next time you're stuck in traffic on Highway 97.</div>
                    <div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#cfd6e0;line-height:1.6;margin:0;">Brand locked: Amboqia headlines, AzoSans body, navy + gold — same tile aesthetic as the dog parks reel.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:0 24px 28px 24px;">
              <div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#999;line-height:1.6;border-top:1px solid #e5e5e5;padding-top:16px;">
                Photos also saved to <span style="color:#333;">~/RyanRealty/peak_options/</span> on your computer. Reply with picks, then the 3D tile render kicks off.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>'''

    payload = {
        "from": "Ryan Realty Studio <onboarding@resend.dev>",
        "to": "matt@ryan-realty.com",
        "subject": "Cascade Peaks — Jefferson + Washington photo options (pick your favorites)",
        "html": html,
        "attachments": att,
    }
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {RESEND_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode()
            print(f"Status: {r.status}")
            print(f"Response: {body}")
            return 0 if r.status in (200, 201) else 2
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()}")
        return 2

if __name__ == "__main__":
    sys.exit(build())
