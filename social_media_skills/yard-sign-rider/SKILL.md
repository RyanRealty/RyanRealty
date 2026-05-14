---
name: yard-sign-rider
description: >
  Print-ready PDF generator for the Ryan Realty 18×24 in. yard sign plus rider variants
  ("Just Listed", "Open House <date>", "Under Contract", "Sold"). Heritage navy-on-cream
  design anchored by the pre-rendered `logo-blue.png` wordmark, listing agent name plus the
  brokerage phone, and a QR code that links to the property page on ryan-realty.com. The
  yard sign is the primary trust signal for drive-by traffic at the property, so the spec is
  byte-identical across every listing — every Ryan Realty sign reads the same. Use this
  whenever Matt says "yard sign for <address>", "build a yard sign for <MLS#>", "sign rider
  for <listing>", "open house rider for <address>", "sold rider for <MLS#>", or "yard sign
  and rider".
when_to_use: |
  Triggered by phrases:
  - "yard sign for <address>"
  - "build a yard sign for <MLS#>"
  - "sign rider for <listing>"
  - "open house rider for <address>"
  - "sold rider for <MLS#>"
  - "under contract rider for <address>"
  - "just listed rider for <MLS#>"
  - "yard sign and rider"
action_types:
  - content:yard_sign
---

# Yard Sign + Rider — Print PDF Producer

**Scope.** Generate one print-ready 18×24 in. main sign PDF plus one 6×24 in. rider PDF per
call. Sign is the standardized Ryan Realty post sign for the property; rider is the
status-band stripe that clips to the sign post above the main sign. Companion to
`flyer-design` (handout flyers) and `ig-single-post` (digital announcements). Owns nothing
on social — the rider does not get rendered as a digital asset; only the optional digital
proof PNG ships back to Matt for review.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B — Content Producer.

---

## 1. Required references

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy mandate | Address, price, agent name, MLS#, QR target all trace to Supabase. Outranks everything. |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Render proof to `out/`, surface to Matt, wait for explicit approval before sending to vendor. |
| `CLAUDE.md` "Voice + content" | Phone `541.213.6706`, web `ryan-realty.com`, "BEND · OREGON" with middle-dot. No exclamation marks, no emoji. |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy `#102742` on cream `#faf8f4`, Amboqia Boriango display + Geist body + Azo Sans Medium accent. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color and type tokens. |
| `design_system/ryan-realty/MANIFEST.md` §"assets/brand/" | `logo-blue.png` is the heritage wordmark; never re-typeset. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes. |
| `social_media_skills/flyer-design/SKILL.md` | Sibling static-print producer — share bleed, font load, color profile, and asset-audit conventions. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate; applies to every on-canvas word. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer skeleton. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B row pointer. |

This is the single most public-facing item in the kit. Every drive-by, every showing, every
open-house attendee sees it. Discipline is mandatory.

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `content:yard_sign` | `mls_id`, `rider_variant` | If `rider_variant='open_house'`, the `open_house_date_iso`, `open_house_start_local`, `open_house_end_local` fields are also required. |

The main sign renders **once per listing**. Each subsequent call for a different
`rider_variant` on the same `mls_id` re-uses the cached main sign and only re-renders the
rider PDF + proof. This keeps every Ryan Realty yard sign on a given property visually
identical post-to-post regardless of which rider is on top.

### Rider variants

| variant | sign post status | when used |
|---|---|---|
| `just_listed` | Just Listed | First 7–14 days on market |
| `open_house` | Open House <date> | Each scheduled open house |
| `under_contract` | Under Contract | Status changes to Pending |
| `sold` | Sold | Status changes to Closed |

---

## 3. Brief payload schema

```typescript
type YardSignRiderVariant =
  | 'just_listed'
  | 'open_house'
  | 'under_contract'
  | 'sold'

interface YardSignPayload {
  mls_id: string                           // e.g. '220189422' — required, resolves listing row
  rider_variant: YardSignRiderVariant      // required

  // Required only when rider_variant === 'open_house':
  open_house_date_iso?: string             // e.g. '2026-05-17'
  open_house_start_local?: string          // e.g. '11:00 AM'
  open_house_end_local?: string            // e.g. '1:00 PM'
}

interface YardSignActionRow {
  id: string                               // uuid from marketing_brain_actions
  action_type: 'content:yard_sign'
  target: string                           // 'mls:<mls_id>'
  assigned_producer: 'social_media_skills/yard-sign-rider'
  payload: YardSignPayload
  data_evidence: Record<string, unknown>   // e.g. { status_change: 'Active' → 'Pending' }
  generation_reason: string
  status: 'pending'
}
```

Payload validation rules:
- `mls_id` must resolve to a row in `public.listings`.
- `rider_variant` must be one of the four enum values.
- If `rider_variant='open_house'`: all three open-house fields must be present and parseable.
- If `rider_variant='open_house'` and any open-house field missing → stop, surface to caller.

---

## 4. The recipe

**Step 1 — Read the action row.**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately UPDATE
`status='in_production'` and `executed_at=now()`. Do this BEFORE any rendering work — locks
the row.

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<action_id>' AND status='pending';
```

**Step 2 — Load mandatory references** (§1 above). Do not skip — re-confirm brand color
hex, font file paths, and the phone/web format every run. A drift in one of these poisons
every yard sign downstream.

**Step 3 — Pull listing data from Supabase.**

Project: `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`). Per CLAUDE.md "Supabase listings
Schema", every mixed-case column gets double-quoted.

```sql
SELECT
  "MlsId",
  "StreetNumber",
  "StreetName",
  "City",
  "PostalCode",
  "ListPrice",
  "StandardStatus",
  "ListAgentFullName",
  "ListAgentEmail",
  "ListOfficeName",
  "PublicRemarks"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

If 0 rows → stop, surface "MLS ID does not resolve" to caller.

**Step 4 — Resolve the listing agent to a Ryan Realty broker.**

Map `ListAgentEmail` to one of the three brokers per `design_system/ryan-realty/MANIFEST.md`
§"assets/team/":

| email contains | broker slug | display title |
|---|---|---|
| `matt@`, `mryan@` | `matt-ryan` | Owner / Principal Broker |
| `paul@`, `pstevenson@` | `paul-stevenson` | Principal Broker |
| `rebecca@`, `rpeterson@` | `rebecca-peterson` | Principal Broker |

Fallback: if `ListAgentEmail` is empty, match on `ListAgentFullName`. If still unresolved →
stop, surface to caller. The yard sign does not ship with the wrong agent name.

**Step 5 — Verify the property page URL exists.**

The QR code encodes `https://ryan-realty.com/listings/<slug>` where `<slug>` is the
canonical kebab-case street address slug used by the site (e.g. `1234-nw-riverview-drive`).

```bash
# Verify the page resolves (200 OK, not 404 or 5xx):
curl -s -o /dev/null -w "%{http_code}" "https://ryan-realty.com/listings/<slug>"
```

If response is not `200`: do NOT generate the QR code. Stop, surface to Matt with the
expected URL and the actual HTTP status. The yard sign cannot ship with a QR that 404s — a
buyer scanning at the curb gets a dead page.

**Step 6 — Render the main sign PDF (one-time per listing).**

Skip this step if `out/yard-sign/<slug>/main-sign.pdf` already exists. The main sign is
byte-identical across all rider variants on the same listing.

Canvas: 18×24 in. at 300 DPI plus 0.25 in. bleed on all four sides = 5550 × 7350 px PDF
(printable area 5400 × 7200 px, centered).

Layout (px coordinates within the 5400 × 7200 printable area, before the bleed offset):

| element | spec | y-band |
|---|---|---|
| Background | Solid `#faf8f4` cream filling all 5550 × 7350 px (bleed included). | full |
| Wordmark | `design_system/ryan-realty/assets/brand/logo-blue.png`, 3000 px wide, height by aspect, horizontally centered, top edge at `y=300` (1 in. from top of printable area). | 300 – 1300 |
| Sub-line | `BEND · OREGON` in Azo Sans Medium 200 px, UPPERCASE, navy `#102742`, letter-spacing 0.12em, horizontally centered, baseline at `y=1700`. Middle-dot separator with 80 px padding either side. | 1500 – 1700 |
| Spacer | Empty navy hairline at `y=2200`, 4 px tall, 1000 px wide, horizontally centered. | 2200 |
| Listing agent block — name | `<Full Name>` in Amboqia Boriango 200 px, navy, horizontally centered, baseline at `y=3000`. | 2800 – 3000 |
| Listing agent block — title | `<Title>` in Geist 500 100 px, navy 0.85 opacity, horizontally centered, baseline at `y=3200`. | 3100 – 3200 |
| Listing agent block — phone | `541.213.6706` in Geist 700 160 px, navy, tabular-nums, horizontally centered, baseline at `y=3500`. Dotted format always. | 3300 – 3500 |
| QR code | 1200 × 1200 px QR (navy `#102742` modules on cream background, no quiet-zone shrink), horizontally centered, top edge at `y=4400`. Encode the verified property page URL from Step 5. Error-correction level Q (25%) to survive weather and partial occlusion. | 4400 – 5600 |
| Web line | `ryan-realty.com` in Geist 500 120 px, navy, tabular-nums, horizontally centered, baseline at `y=5950`. Lowercase, hyphenated. | 5800 – 5950 |
| Bottom rule | 1 px navy line at `y=6900`, 1000 px wide, horizontally centered. | 6900 |

NEVER re-typeset the wordmark. Always use `logo-blue.png` straight from the brand
directory.

NO gold accents anywhere. NO white-on-dark. NO emoji. NO exclamation marks.

**Step 7 — Render the rider PDF (per variant).**

Canvas: 6 × 24 in. at 300 DPI plus 0.25 in. bleed on all four sides = 7350 × 1950 px PDF
(printable 7200 × 1800 px, centered). Landscape orientation.

The rider is a horizontal banner that clips to the sign post above the main sign. Each
variant has its own background color rule.

| variant | bg | text color | content |
|---|---|---|---|
| `just_listed` | Cream `#faf8f4` | Navy `#102742` | `JUST LISTED` |
| `open_house` | Navy `#102742` | Cream `#faf8f4` | `OPEN HOUSE` + date/time |
| `under_contract` | Cream `#faf8f4` | Navy `#102742` | `UNDER CONTRACT` |
| `sold` | Navy `#102742` | Cream `#faf8f4` | `SOLD` |

Layout per variant (px coordinates within the 7200 × 1800 printable area):

**5.7a — `just_listed` rider:**
- `JUST LISTED` in Amboqia Boriango 480 px, navy, horizontally + vertically centered.

**5.7b — `open_house` rider:**
- `OPEN HOUSE` in Amboqia Boriango 320 px, cream, horizontally centered, baseline at
  `y=700`.
- Date + time line in Geist 700 280 px, cream, tabular-nums, horizontally centered, baseline
  at `y=1300`. Format: `<Day>, <Month> <D>  ·  <start>–<end>`. Example:
  `Saturday, May 17  ·  11:00 AM – 1:00 PM`. Compose using JS `Intl.DateTimeFormat` with
  `en-US` locale on the resolved `open_house_date_iso` plus the start/end fields. Never
  invent a year — omit unless current year differs from event year.

**5.7c — `under_contract` rider:**
- `UNDER CONTRACT` in Amboqia Boriango 480 px, navy, horizontally + vertically centered.

**5.7d — `sold` rider:**
- `SOLD` in Amboqia Boriango 480 px, cream, horizontally + vertically centered.

All four variants share: 0.25 in. bleed, no gold, no logo on the rider itself (the wordmark
sits on the main sign below), no exclamation marks, no other text.

**Step 8 — Emit a digital proof PNG.**

Composite the main sign PNG and rider PNG so Matt sees the full assembled curb view at
review time. Output `proof.png` at 2160 × 3240 px (1/2 print resolution, sRGB).
The proof shows the rider clipped above the main sign, both proportional, on a transparent
background so Matt can see exactly what the post will look like when staked.

Also emit standalone `main-sign.png` and `rider-<variant>.png` at the same 1/2 resolution
for vendor file QC.

**Step 9 — Run the QA gate.** See §8. Write results to `design_scorecard.json`. Any `fail`
= non-ship.

**Step 10 — Write citations.json.**

One entry per figure or attribution shown on the sign. Per CLAUDE.md §0.

```json
{
  "figures": [
    {
      "figure": "1234 NW Riverview Drive",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "StreetNumber || ' ' || StreetName",
      "value": "1234 NW Riverview Drive",
      "fetched_at": "2026-05-14T14:32:00Z"
    },
    {
      "figure": "Matt Ryan",
      "source": "Supabase listings → broker resolution",
      "filter": "ListAgentEmail='matt@ryan-realty.com'",
      "column": "ListAgentFullName",
      "value": "Matt Ryan",
      "fetched_at": "2026-05-14T14:32:00Z"
    },
    {
      "figure": "https://ryan-realty.com/listings/1234-nw-riverview-drive",
      "source": "Live HTTP probe",
      "filter": "GET / 200 OK",
      "column": "—",
      "value": 200,
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ]
}
```

**Step 11 — Write `qr-target.txt`.** Plain-text file containing exactly the URL the QR code
encodes. Matt can re-open the QR target without parsing the PDF.

**Step 12 — UPDATE the action row.**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"out/yard-sign/<slug>/","main_sign_pdf":"out/yard-sign/<slug>/main-sign.pdf","rider_pdf":"out/yard-sign/<slug>/rider-<variant>.pdf","proof_png":"out/yard-sign/<slug>/proof.png","qr_target":"https://ryan-realty.com/listings/<slug>","scorecard":{...}}'::jsonb
WHERE id='<action_id>';
```

**Step 13 — Surface draft to Matt.** Format in §6. Then stop and wait.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | Listing data pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (project `dwvlophlbvvygjfxcrhm`) |
| `curl` | Verify property page URL returns 200 | n/a |
| Sharp / pdf-lib (Node) | PDF render with embedded fonts, CMYK-safe sRGB output | `lib/render-yard-sign.mjs` |
| `qrcode` (npm) | QR code generation with EC level Q | n/a |
| Heritage wordmark PNG | The only wordmark allowed | `design_system/ryan-realty/assets/brand/logo-blue.png` |
| Amboqia Boriango font | Display | `design_system/ryan-realty/fonts/Amboqia_Boriango.otf` |
| Azo Sans Medium font | UPPERCASE sub-label | `design_system/ryan-realty/fonts/AzoSans-Medium.ttf` |
| Geist font | Body, phone, web, agent title | `next/font/geist` (CLI render via `@vercel/geist`) |

---

## 6. Output format

**Draft lands at:** `out/yard-sign/<slug>/`

`<slug>` is the kebab-case street-address slug, lowercased, matching what
ryan-realty.com uses for the listing page URL.

```
out/yard-sign/<slug>/
├── main-sign.pdf           ← 18×24 in. print PDF with 0.25 in. bleed (sRGB)
├── main-sign.png           ← Digital proof, 2700×3600 px
├── rider-<variant>.pdf     ← 6×24 in. rider PDF with 0.25 in. bleed (sRGB)
├── rider-<variant>.png     ← Rider digital proof, 3600×900 px
├── proof.png               ← Assembled curb-view composite, 2160×3240 px
├── qr-target.txt           ← Plain-text URL the QR encodes
├── payload.json            ← The action row's payload field
├── citations.json          ← Every figure traced per CLAUDE.md §0
├── provenance.json         ← Asset source + font versions
├── fonts_used.json         ← Exact font files embedded in the PDFs
└── design_scorecard.json   ← QA gate results
```

**Surface format (present to Matt exactly like this):**

```
Yard sign ready for review — <address> · <rider_variant>

  MAIN SIGN
    Path: out/yard-sign/<slug>/main-sign.pdf
    Proof: out/yard-sign/<slug>/main-sign.png
    Size: 18×24 in. with 0.25 in. bleed ✓
    Re-used from cache: <yes|no — only on first render>

  RIDER (<rider_variant>)
    Path: out/yard-sign/<slug>/rider-<variant>.pdf
    Proof: out/yard-sign/<slug>/rider-<variant>.png
    Size: 6×24 in. with 0.25 in. bleed ✓

  ASSEMBLED CURB VIEW
    Path: out/yard-sign/<slug>/proof.png

  QR CODE TARGET
    URL: https://ryan-realty.com/listings/<slug>
    HTTP probe: 200 OK ✓ (fetched <iso>)

  VERIFICATION TRACE
    - <Listing address> — Supabase listings, MlsId='<mls_id>'
    - <Listing agent> — Supabase ListAgentEmail → broker resolution
    - <QR target> — Live HTTP probe

  CITATIONS
    out/yard-sign/<slug>/citations.json

Reply "ship it" / "approved" / "go" to release the PDFs to the print vendor.
```

Then stop. Do not commit. Do not send to vendor. Wait.

---

## 7. Approval gate

`matt-review-draft` — Matt reviews the assembled curb-view proof, scans the citations, and
explicitly says "ship it" / "approved" / "go" before any PDF leaves `out/` for the print
vendor. Silence is not approval. A clean QA gate is not approval.

Vendor handoff is a separate step that runs only after explicit approval — Matt names the
vendor (SignsOnTheCheap, FastSigns, local print shop). The producer never auto-uploads to a
vendor portal.

---

## 8. QA gate

Run before surfacing the draft. Write results to `design_scorecard.json`. Any `fail` =
non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Main sign dimensions | Exactly 5550 × 7350 px at 300 DPI (18×24 in. + 0.25 in. bleed on all sides) |
| 2 | Rider dimensions | Exactly 7350 × 1950 px at 300 DPI (6×24 in. + 0.25 in. bleed on all sides) |
| 3 | Color profile | sRGB embedded in both PDFs. CMYK not required — most vendors convert. No spot colors |
| 4 | Bleed integrity | Background fill extends to bleed edges on all four sides for both PDFs |
| 5 | Font integrity | Amboqia, Azo Sans Medium, Geist all loaded from disk and embedded in PDFs; no fallback in render |
| 6 | Wordmark integrity | Main sign uses `logo-blue.png` byte-identical to brand asset (SHA-256 match); not re-typeset |
| 7 | Color compliance | Navy `#102742` + cream `#faf8f4` only. No gold (`#D4AF37`, `#C8A864`). No off-brand hex |
| 8 | Tabular numerals | Phone, web, and date/time all rendered with `font-variant-numeric: tabular-nums` |
| 9 | QR code target | `qr-target.txt` URL returns 200 OK on live HTTP probe; QR decodes to that exact URL when scanned |
| 10 | QR error correction | EC level Q (25%) — survives weather and partial occlusion |
| 11 | Listing agent resolution | `ListAgentEmail` mapped to one of matt-ryan / paul-stevenson / rebecca-peterson; name + title correct |
| 12 | Phone format | Exactly `541.213.6706` (dotted, brand phone — NOT the FUB bio phone) |
| 13 | Web format | Exactly `ryan-realty.com` (hyphenated, lowercase) |
| 14 | Banned vocab | Grep all on-canvas text against `voice_guidelines.md` §6 union — zero hits |
| 15 | No exclamation marks | Grep PDFs for `!` — zero hits |
| 16 | No emoji | Grep PDFs for any non-ASCII glyph except em-dash placeholder and middle-dot separator — zero unauthorized hits |
| 17 | Open-house data integrity | If `rider_variant='open_house'`: date, start, end all present, formatted correctly, year omitted if current |
| 18 | File size | Each PDF under 25 MB (well below the 100 MB print-vendor ceiling) |
| 19 | Citations completeness | Every visible field on the sign (address, agent, phone, web, QR target, open-house date) has a row in `citations.json` |
| 20 | Listing status sanity | `rider_variant` matches `StandardStatus` if possible (Active → just_listed, Pending → under_contract, Closed → sold). If mismatch, surface to Matt — don't auto-correct |

---

## 9. Status flow

Per `marketing_brain_skills/producers/TEMPLATE.md` §8:

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ draft PDFs + proof complete, QA passed
        ▼
      ready        ← executor_response populated with draft_path + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ vendor handoff completes (Matt names the vendor, PDFs uploaded)
        ▼
    executed       ← terminal success; vendor order placed
        │ 14 days after estimated install date
        ▼
    measured       ← performance_loop checks if listing moved (Active → Pending)
                     and credits the yard sign in attribution

    killed         ← terminal failure; set if Matt cancels or QA fails twice in a row
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"out/yard-sign/<slug>/","main_sign_pdf":"...","rider_pdf":"...","proof_png":"...","qr_target":"...","scorecard":{}}'::jsonb
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 10. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| MLS ID does not resolve | Supabase query returns 0 rows for `"MlsId"=<mls_id>` | Stop. Surface to caller with the MLS# and the exact query. Set `status='killed'` with `executor_response.error='MLS not found'`. |
| Listing agent not resolved | `ListAgentEmail` and `ListAgentFullName` don't map to any of the three brokers | Stop. Surface to Matt with the raw email and name. Ask whether to add a new broker mapping or whether this is a co-broke listing where the sign shouldn't ship. Do not guess. |
| Property page URL doesn't exist | `curl https://ryan-realty.com/listings/<slug>` returns 4xx or 5xx | Stop. Surface to Matt with the expected slug and the actual HTTP status. Common cause: site hasn't published the listing page yet — pause until it's live. NEVER generate a QR that 404s at the curb. |
| QR code generation fails | qrcode library throws, or generated PNG is unreadable when test-scanned | Re-render with EC level H (30%) and retry. If still failing, surface to Matt with the input URL and the library error. |
| Open-house variant without date payload | `rider_variant='open_house'` but one of the three open-house fields missing | Stop. Surface to caller with the list of missing fields. Do not invent a default date. |
| Open-house date in the past | `open_house_date_iso` is before today's date | Stop. Surface to Matt — almost certainly a payload error (most likely an old draft); ask whether to re-date or kill. |
| Font fallback at render | Amboqia / Geist / Azo Sans Medium not on disk | Stop. Report the missing file path. Do not ship a PDF with system-font fallback. Vendor proof will look broken. |
| Wordmark file altered | `logo-blue.png` SHA-256 doesn't match the brand directory copy | Stop. Surface — someone tampered with the brand asset. Re-pull from git, do not proceed with a tainted source. |
| Banned vocab on canvas | grep hit in any text element (very unusual — the sign content is structural, not editorial, but check anyway) | Stop. Re-write the offending text. Re-validate. |
| Listing status mismatch with rider variant | `StandardStatus='Active'` but `rider_variant='sold'` | Surface to Matt — confirm whether the sign is for a pre-stage or whether the action row was generated stale. Do not auto-correct. |
| Vendor file rejection | Vendor portal rejects PDF for color space, bleed, or font issue | This happens AFTER approval. Re-render with the vendor's specific spec (CMYK if requested, adjusted bleed). Surface to Matt before re-rendering — preferences sometimes vary across vendors. |
| **Open spec questions** | None at lock — vendor format defaults (sRGB + 0.25 in. bleed) match SignsOnTheCheap and FastSigns. If Matt switches vendors, this section needs an update | n/a |

---

## 11. What not to do

1. **Never re-typeset the wordmark.** Always use `design_system/ryan-realty/assets/brand/logo-blue.png` straight from disk. Never composite text-as-wordmark.
2. **Never use gold accents.** v2 palette is navy + cream only. Both `#D4AF37` and `#C8A864` are retired.
3. **Never use emoji or exclamation marks.** Yard signs are professional trust signals, not flyers for a garage sale.
4. **Never ship a yard sign with a 404 QR code.** The HTTP probe in Step 5 is a hard pre-condition.
5. **Never invent the listing agent.** If `ListAgentEmail` doesn't map to a Ryan Realty broker, stop and surface. Co-broke listings don't get Ryan Realty yard signs without explicit confirmation.
6. **Never use the FUB bio phone (`541.703.3095`) on the sign.** The yard sign uses `541.213.6706` — Matt's direct, brand voice. The FUB-tracked phone is for inbound-attribution surfaces (social bios, ads) only.
7. **Never auto-upload to a print vendor.** Approval gate is matt-review-draft. Vendor handoff is a separate, Matt-named step.
8. **Never re-render the main sign when only the rider variant changed.** Cache it. Every Ryan Realty sign on the same property must read identically across status changes — only the rider band differs.
9. **Never include a price on the yard sign or rider.** Prices belong on the flyer (handout) and the website (linked via QR). The sign carries identity + status only. (Pricing on physical curb signs creates issues when the price changes mid-listing — the website is the single source of truth via QR.)
10. **Never put the brokerage address or office line on the sign.** Phone + web + QR is sufficient; the website discloses everything else.
11. **Never use the white logo (`logo-white.png`) on the main sign.** Main sign background is cream, so the wordmark is navy. White wordmark is only for the navy-background rider variants (`open_house`, `sold`) — and even there, no wordmark on the rider itself, only the headline text in cream.

---

## 12. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content" — phone, web, hashtag rules
- `design_system/ryan-realty/SKILL.md` — brand visual system
- `design_system/ryan-realty/colors_and_type.css` — color + type tokens
- `design_system/ryan-realty/MANIFEST.md` — asset paths
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — banned vocab union

**Sibling print producers:**
- `social_media_skills/flyer-design/SKILL.md` — handout flyer producer (shares font load, bleed conventions)

**Companion content producers for the listing kit:**
- `social_media_skills/list-kit/SKILL.md` — orchestrator; may dispatch yard sign + other deliverables in parallel for a new listing
- `social_media_skills/ig-single-post/SKILL.md` — IG Just Listed / Sold / Open House digital announcements
- `social_media_skills/instagram-carousel/SKILL.md` — multi-slide IG carousel

**Producer infrastructure:**
- `marketing_brain_skills/producers/TEMPLATE.md` — producer skeleton
- `marketing_brain_skills/producers/REGISTRY.md` — Section B row
- `automation_skills/content_engine/SKILL.md` — content routing bus
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate

**Vendor reference (operational, not load-bearing):**
- SignsOnTheCheap and FastSigns both accept sRGB PDFs with 0.25 in. bleed at 18×24 in. and 6×24 in.
- Lead time: typically 5–7 business days for sign + rider; rush available at extra cost
- Material: corrugated plastic (Coroplast) for the main sign, vinyl rider band that mechanically clips above
