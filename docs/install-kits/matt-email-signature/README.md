# Matt Ryan — Email Signature Install Kit

Locked design v6, approved 2026-05-14. Standardized across three accounts:

- `matt@ryan-realty.com` (Google Workspace)
- `matt.list.homes@gmail.com` (consumer Gmail)
- Follow Up Boss user profile

## What's in this kit

| File | Purpose |
|---|---|
| `signature.html` | Paste-ready HTML block. Drop into FUB signature editor's source-mode, or use Gmail's compose-trick install (see below). |
| `../../public/images/brokers/ryan-matt.png` | Inline headshot (transparent PNG, 800×1200). Served from `https://ryanrealty.vercel.app/images/brokers/ryan-matt.png`. |
| `../../public/images/brand/logo-blue.png` | Inline stacked logo (navy on white, 959×629). Served from `https://ryanrealty.vercel.app/images/brand/logo-blue.png`. |
| `../../public/images/brokers/ryan-matt-profile-512.jpg` | 512×512 square profile photo (white background, 64 KB). For Google Account + FUB profile photo upload. |

The signature HTML pulls images from production Vercel URLs, so every render is byte-identical across mail clients and survives the recipient client's image proxy.

---

## Install — Gmail (matt@ryan-realty.com AND matt.list.homes@gmail.com)

Repeat the same steps in **both** Gmail accounts. The signature is per-account.

### A. Set the email signature

1. Open Gmail → click the **gear icon** (top right) → **See all settings**
2. In the **General** tab, scroll down to **Signature**
3. Click **+ Create new** (or edit an existing one). Name it `Matt Ryan v6`.
4. Click into the rich-text editor for the signature.
5. Paste the signature. There are two reliable ways:
   - **Easiest path (recommended):** In a new browser tab, open `docs/install-kits/matt-email-signature/signature.html` directly in Chrome (drag the file in, or `file:///…`). It renders to a clean visual block. Select the entire rendered block, copy with Cmd+C, and paste into Gmail's signature editor. Gmail preserves the table layout and re-hosts the two images on `googleusercontent.com` automatically.
   - **HTML path (advanced):** Open the same `signature.html` in a new compose window — Gmail compose supports HTML paste. Copy the rendered output back into the signature editor.
6. Set **Signature defaults** to your new `Matt Ryan v6` for both `On new emails use:` and `On reply/forward use:`. Check **Insert signature before quoted text…**.
7. Scroll to bottom → **Save Changes**.

### B. Set the Google Account profile photo

The Google profile photo isn't a Gmail setting — it's a Google Account setting, and shows up everywhere across Google (Gmail, Calendar, Meet, etc.).

1. Click your existing avatar (top right in Gmail) → **Manage your Google Account**
2. Left nav → **Personal info** → click the photo (or "Add a profile picture")
3. **Upload** → select `public/images/brokers/ryan-matt-profile-512.jpg`
4. Crop preview (Google forces a circle crop) — accept the default (the photo is pre-centered for circle crop)
5. **Save as profile picture**

Propagation: Google takes 5–60 minutes to push the new photo to Gmail recipients' avatars.

---

## Install — Follow Up Boss

### A. Set the email signature

1. FUB → top-right user avatar → **My Settings** (or **Edit profile**)
2. Scroll to **Email Signature**
3. Click the source-mode toggle on the editor toolbar (usually a `<>` icon — FUB exposes HTML source for signature)
4. Paste the entire contents of `signature.html` into the source pane
5. Toggle back to rich-text view to confirm the layout renders correctly (you should see the headshot, name, contact stack, mission, and the small stacked logo with reviews/pamphlet links and compliance line)
6. **Save**

### B. Set the FUB profile photo

1. FUB → top-right user avatar → **My Settings** → **Profile**
2. Click the **avatar / Change photo** control
3. Upload `public/images/brokers/ryan-matt-profile-512.jpg`
4. **Save**

---

## Verification checklist (run after install on each surface)

- [ ] Send a test email from `matt@ryan-realty.com` to `matt.list.homes@gmail.com`. Open in Gmail web + iOS Gmail app + Apple Mail. Headshot loads, stacked logo loads, mission italic renders, links are clickable, no broken images.
- [ ] Same from `matt.list.homes@gmail.com` → `matt@ryan-realty.com`.
- [ ] FUB → send a test "Personal" email from any lead → confirm same signature renders.
- [ ] Each Google Account → check the round avatar shows the new headshot (Gmail top-right corner)
- [ ] FUB → profile page shows the new avatar

## Brand spec reference

- **Mission statement:** `Building community through authentic relationships and exceptional customer service.` (verbatim, locked — [bio-drafts.md:29](../../design_system/ryan-realty/assets/social/bio-drafts.md:29))
- **Phone:** `541.703.3095` (FUB-tracked — inbound calls route to Follow Up Boss attribution)
- **Email:** `matt@ryan-realty.com` (canonical brand address — display on both Gmail accounts)
- **Web:** `ryan-realty.com` (consumer-facing AgentFire WordPress site; the Vercel app at `ryanrealty.vercel.app` hosts the inline signature images)
- **License disclosure:** `Ryan Realty LLC · Oregon Principal Broker #201206613 · Equal Housing Opportunity` (matches [OregonDisclosure.tsx](../../components/legal/OregonDisclosure.tsx))
- **Google reviews URL:** `https://www.google.com/maps/search/?api=1&query=Ryan+Realty+Bend+OR` (canonical from [lib/testimonials.ts:76](../../lib/testimonials.ts:76))
- **OR Initial Agency Disclosure Pamphlet:** `https://www.oregon.gov/rea/licensing/Documents/Initial-Agency-Disclosure-Pamphlet.pdf` (verified live; OREA refreshed it in 2025 to include fair-housing complaint filing language)

## Updating the signature later

The image URLs hard-code `ryanrealty.vercel.app`. When the custom domain `ryan-realty.com` migrates off AgentFire to serve the Next.js app, swap the two image URLs in `signature.html` from `ryanrealty.vercel.app/images/...` to `ryan-realty.com/images/...` and re-install across all three surfaces.

If the headshot or logo asset itself changes, the URLs stay the same and recipients see the new image after Gmail's proxy cache expires (typically within 24 hours).
