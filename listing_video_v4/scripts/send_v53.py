#!/usr/bin/env python3
"""Email v5.3 to Matt with the full change log against v5.2."""
import json, urllib.request
from pathlib import Path


def load_env(path):
    env = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


env = load_env(Path("/Users/matthewryan/RyanRealty/.env.local"))
URL = "https://raw.githubusercontent.com/RyanRealty/RyanRealty/main/public/v5_library/schoolhouse_v53.mp4"

html = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a1714;color:#F2EBDD;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;">
<div style="max-width:600px;margin:0 auto;padding:24px 20px;">
<h1 style="font-family:Georgia,serif;font-weight:normal;color:#F2EBDD;font-size:26px;margin:0 0 8px;">Schoolhouse v5.3</h1>
<p style="color:#C8A864;font-size:13px;margin:0 0 24px;text-transform:uppercase;letter-spacing:0.06em;">Cinemagraph motion, gimbal walk interiors, every beat reworked</p>

<p style="font-size:15px;margin:0 0 20px;">Punch list from your last note, every item.</p>

<div style="margin:24px 0;text-align:center;">
<a href="{URL}" style="display:inline-block;background:#C8A864;color:#1a1714;text-decoration:none;font-weight:600;padding:14px 28px;border-radius:6px;font-size:16px;letter-spacing:0.02em;">Watch v5.3</a>
</div>
<p style="font-size:12px;color:#A39684;margin:0 0 24px;text-align:center;word-break:break-all;">{URL}</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Open frame</h2>
<p style="font-size:14px;margin:0 0 10px;">Map is now black and white with a deeper vignette so the gold reads as gold. Boundary now has a faint gold stroke line drawing along with the radial glow, not just glow alone. Period dropped after 1892.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Family arc</h2>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">William.</strong> Swapped to the younger portrait so he matches Sadie's age range. No more older with cane.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Rockpile pan.</strong> Two real fixes. First, the photo now renders in wide mode at its natural 1.6 aspect, so panning translates within the photo rather than past its edge into the dark background. No more black space. Second, direction is true left to right now, reveals the boy with the bat, the girl on the rock, the mustached man, the baby in the wicker carriage, the dog. Three anchor pan, dwells at each anchor.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Surrey.</strong> Real pan amplitude this time, traverses the whole family standing with the carriage, not just a wedge of it.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Ranch life</h2>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Sheep dip dropped.</strong> Replaced with the kids on the footbridge over the river, with a cinemagraph water ripple mask under the bridge. Subtle, real, no AI slop. The river surface breathes while the kids and the bridge stay locked.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Barn / Newberry Crater.</strong> Cinemagraph sky drift mask on the upper third of the frame. The mountain stays still, the sky drifts. Same Remotion masked-overlay technique you saw in the first market video.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Home tour</h2>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Hero exterior.</strong> Now in vignette letterbox so the whole horizontal house is visible. Soft gradient bands top and bottom instead of crop. Slight push.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Window plus Mt. Bachelor.</strong> Cinemagraph sky drift on the upper part of the window. Mountain holds, sky drifts behind it. Push pulls you toward the view.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Every interior.</strong> New gimbal walk move. Compound: slow horizontal pan plus slow forward push plus a soft vertical bob plus a counter translate that fakes parallax. Reads like a steady-cam walk-through, not a flat zoom. Used on hearth, dining, bedroom, sunroom, shower.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Primary bath.</strong> Swapped #29 for #30. Now leads with the walk-in shower and the stonework, freestanding tub still in the foreground.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Fire patio.</strong> Cinemagraph flame flicker mask on the fireplace area. Subtle pixel-level jitter on the flames only. Push counter still anchors the framing.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Outdoor / wildlife</h2>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Elk on the river.</strong> The horse close-up is gone. The elk-fording-the-Little-Deschutes photo plays on the elk-at-dawn line with a cinemagraph water flow mask on the river surface where the herd is crossing.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Elk herd in the meadow.</strong> Stays. Slow horizontal pan.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Final aerial</h2>
<p style="font-size:14px;margin:0 0 10px;">Switched to the pond-facing aerial of the home, gimbal walk pan instead of zoom out. Whole home visible.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Voice over</h2>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Sheep dip line removed.</strong> Ranch life now splits across surrey and bridge: "They moved by surrey and ran sheep and cattle through the seasons. And the children kept their days at the river, until the family sold the land in nineteen seventy."</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">A line about the home.</strong> Added between Locati and the spec line, on the hero exterior beat: "Built to wear in."</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">Trout fill the streams.</strong> Folded into the river line. Deschutes now pronounced duh-shoots phonetically, so it sounds right.</p>
<p style="font-size:14px;margin:0 0 10px;"><strong style="color:#C8A864;">No overlap.</strong> Re-timed every sentence with a clear gap before the next, so "century later" does not run into "built in twenty seventeen" and "Some places are kept" does not collide with the river line.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Closing reveal</h2>
<p style="font-size:14px;margin:0 0 10px;">PENDING. $3,025,000. 56111 SCHOOLHOUSE ROAD / VANDEVERT RANCH. REPRESENTED BY RYAN REALTY. Address staged in between the price and the brokerage.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Photo credits</h2>
<p style="font-size:14px;margin:0 0 10px;">Small white credit line at the bottom of every historic photo: vandevertranch.org / Ted Haynes / David M. / Locati Architects / Snowdrift Visuals.</p>

<h2 style="font-family:Georgia,serif;color:#C8A864;font-size:18px;margin:24px 0 12px;font-weight:normal;">Runtime</h2>
<p style="font-size:14px;margin:0 0 10px;">122.5 seconds. Inside the 110 to 130 second cinematic short film window.</p>

<div style="background:#102742;color:#F2EBDD;padding:16px 20px;margin-top:32px;border-radius:6px;text-align:center;">
<div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.04em;">Ryan Realty</div>
<div style="font-size:13px;color:#C8A864;margin-top:4px;">541.213.6706 &middot; matt@ryan-realty.com</div>
</div>
</div>
</body></html>"""

req = urllib.request.Request(
    "https://api.resend.com/emails",
    data=json.dumps({
        "from": "Ryan Realty <onboarding@resend.dev>",
        "to": ["matt@ryan-realty.com"],
        "subject": "Schoolhouse v5.3 — punch list cleared",
        "html": html,
    }).encode(),
    headers={
        "Authorization": f"Bearer {env['RESEND_API_KEY']}",
        "Content-Type": "application/json",
        "User-Agent": "curl/8.4",
    },
)
print(json.loads(urllib.request.urlopen(req).read()))
