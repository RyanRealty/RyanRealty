# Paul Stevenson — Email Signature Install Kit

Same v6 design as Matt's, with Paul's identity. Locked design 2026-05-14.

## What's in this kit

| File | Purpose |
|---|---|
| `signature.html` | Paste-ready HTML block. Drop into FUB signature editor's source-mode, or use Gmail's compose-trick install. |
| `../../public/images/brokers/stevenson-paul.png` | Inline headshot (transparent PNG, 800×1200). Served from `https://ryanrealty.vercel.app/images/brokers/stevenson-paul.png`. |
| `../../public/images/brand/logo-blue.png` | Inline stacked logo (navy on white, 959×629). Same logo as Matt's signature. |
| `../../public/images/brokers/stevenson-paul-profile-512.jpg` | 512×512 square profile photo (white background, 38 KB). For Google Account + FUB profile photo upload. |

The signature HTML pulls images from production Vercel URLs, so every render is byte-identical across mail clients.

## Differences from Matt's signature

| Field | Matt's signature | Paul's signature |
|---|---|---|
| Headshot | `ryan-matt.png` | `stevenson-paul.png` |
| Name | Matt Ryan | Paul Stevenson |
| Title | Owner & Principal Broker · Ryan Realty LLC | Broker · Ryan Realty LLC |
| Phone | 541.703.3095 (FUB-tracked) | 541.977.6841 (direct from Supabase `brokers` row) |
| Email | matt@ryan-realty.com | paul@ryan-realty.com |
| License | Oregon Principal Broker #201206613 | Oregon Broker #201259123 |

Mission statement, brokerage entity (Ryan Realty LLC), Read-our-Google-reviews URL, Oregon Initial Agency Disclosure Pamphlet URL, and Equal Housing Opportunity line are **identical** — they're brokerage-level, not broker-level.

## Install paths (pick one)

### A. Paul installs himself

1. Send Paul the signature.html file (or the rendered preview at `http://localhost:8765/paul-render.html` while the local dev server is running).
2. Paul follows the same per-account steps as Matt's [README](../matt-email-signature/README.md):
   - Gmail (paul@ryan-realty.com) → Settings → General → Signature → paste rich-text from the render → set defaults → Save Changes.
   - FUB → My Settings → Email Signature → source mode → paste `signature.html` contents → Save signature.
   - Google Account profile photo → Personal info → upload `stevenson-paul-profile-512.jpg`.

### B. Matt drives the install via admin

Matt adds paul@ryan-realty.com as an additional account in either Chrome ("mac" or "Browser 3") via avatar → `+ Add account`. Once logged in, Claude can install the Gmail signature the same way it did for matt.lists.homes.

### C. Workspace Admin: photo only

Matt's Workspace admin can update Paul's Google Account profile photo from `admin.google.com/ac/users/<paul-uid>` → click avatar → `CHANGE PHOTO` → upload `stevenson-paul-profile-512.jpg`. This sets the photo across Gmail, Calendar, Meet, etc. for paul@ryan-realty.com without needing Paul's password. **The Gmail signature itself cannot be admin-installed** — Workspace admins manage org-wide signatures via [Apps → Google Workspace → Gmail → User settings → Signature footer](https://support.google.com/a/answer/2364576), but that places a footer below the user's own signature; it does not replace the user's personal signature.

## Brand spec reference

- **Mission statement:** `Building community through authentic relationships and exceptional customer service.` (verbatim, locked)
- **Phone:** `541.977.6841` (Paul's direct — from `brokers.phone` in Supabase project `dwvlophlbvvygjfxcrhm`)
- **Email:** `paul@ryan-realty.com`
- **Web:** `ryan-realty.com`
- **License disclosure:** `Ryan Realty LLC · Oregon Broker #201259123 · Equal Housing Opportunity`
- **Google reviews URL:** `https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR` (brokerage-level, same for all three brokers)
- **OR Initial Agency Disclosure Pamphlet:** `https://www.oregon.gov/rea/licensing/Documents/Initial-Agency-Disclosure-Pamphlet.pdf` (regulatory, same for all)

## Rebecca's kit

Not yet generated. When ready: copy `docs/install-kits/paul-email-signature/` to `docs/install-kits/rebecca-email-signature/`, swap headshot URL to `peterson-rebecca.png`, swap name + title + phone + email + license, generate Rebecca's 512×512 profile photo. Rebecca's broker row in Supabase has her current direct phone, email, and license number.
