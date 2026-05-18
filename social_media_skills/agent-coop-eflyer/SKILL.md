---
name: agent-coop-eflyer
description: >
  Producer that builds an agent-to-agent email blast (eflyer) for one Ryan Realty listing,
  targeting buyer's agents who are likely holding clients in the listing's price range. Emits
  a responsive HTML email, a print-ready PDF for ZipYourFlyer upload, a plain-text body
  fallback, and a sub-60-character subject line. Voice is peer-to-peer broker.  "your client?"
  angle, no consumer sales hype. Producer prepares the artifacts and surfaces them; Matt
  handles the actual send via ZipYourFlyer ($19-$29 blast to 20,000+ Central Oregon agents)
  or a manual Resend push to a local agent list. Email body is hashtag-stripping surface. 
  no #RyanRealtyBend in the body. Use this whenever Matt says "agent coop eflyer for
  <address>", "agent-to-agent email for <MLS#>", "buyer agent blast", "build the coop flyer",
  "agent email for <listing>", or any phrasing that asks for a flyer aimed at other agents
  rather than at consumers.
when_to_use: |
  Trigger when Matt says any of:
  - "agent coop eflyer for <address>"
  - "agent coop eflyer for <MLS#>"
  - "agent-to-agent email for <MLS#>"
  - "agent-to-agent email for <address>"
  - "buyer agent blast for <address or MLS#>"
  - "build the coop flyer for <address or MLS#>"
  - "agent email for <listing or MLS#>"
  - "ZipYourFlyer blast for <address>"
  - "coop blast for <MLS#>"
  - "/build-agent-coop-eflyer <address or MLS#>"
action_types:
  - content:agent_coop_eflyer
output_type: image
target_platforms: ["ig_feed", "ig_carousel", "fb_feed"]
asset_destination: Supabase asset-library bucket + public/list-kits/<address>/
auto_inputs: ["listing photos from Spark", "brand tokens", "design system v2"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["aspect_ratio_overrides", "color_palette_override"]
estimated_runtime_min: 5
cost_usd_estimate: $0.05-$0.50 per image
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.png
example_outputs: []
    label: "past approved renders"
    surface: "ig_carousel"
---

# Agent Co-op Eflyer.  Buyer-Agent Email Blast Producer

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Build one agent-to-agent email blast for a single Ryan Realty listing. Output is an
HTML email + PDF + plain-text body + subject line.  the artifacts only. Distribution happens
outside this producer: Matt uploads the PDF/HTML to ZipYourFlyer, or sends via Resend from the
`mail.ryan-realty.com` sender to a manually managed local agent list. The producer never
sends.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B.  Content Producer (per `marketing_brain_skills/producers/REGISTRY.md`).

**Exemplar output:** `out/agent-coop/<slug>/`

---

## 1. Scope

### In scope
- One responsive HTML email (max body width 640 px, inlined CSS, light + dark mode tested).
- One print-ready single-page PDF (8.5" × 11" letter, 300 dpi) for ZipYourFlyer upload.
- One plain-text `body.md` for text-only fallback in mixed-MIME sends.
- One `subject-line.txt` with the exact subject line.  strictly under 60 characters.
- One `citations.json` per CLAUDE.md §0 with every figure traced to its source.
- Voice register: agent-to-agent. Peer broker tone. No consumer hype, no exclamation marks, no
  banned vocab.

### Out of scope
- Sending the email. Matt performs the send via ZipYourFlyer or manual Resend upload.
- Building a CMA, BPO, comp grid, or seller net sheet. Different producers own those.
- Consumer-facing flyers (Just Listed / Feature Sheet / Open House).  `social_media_skills/flyer-design/SKILL.md` owns those.
- Single IG post variants. `social_media_skills/ig-single-post/SKILL.md` owns S1-S10.
- Maintaining the recipient agent list. List management is a manual operation by Matt outside the brain.

---

## 2. Required references.  load before doing any work

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy mandate | Every figure (price, beds, baths, sqft, acres, DOM, MLS#) traces to a verified primary source. Outranks every other rule. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render to `out/`, surface, wait for Matt's explicit approval before any send. |
| `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE | Email body is hashtag-stripping; DO NOT inject `#RyanRealtyBend` into the subject line or body. Email is explicitly exempt. |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy/cream palette, Amboqia/Geist type tiers, asset cheat sheet. |
| `design_system/ryan-realty/colors_and_type.css` | Canonical color tokens and type families. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union, voice attributes. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint reference. |
| `automation_skills/content_engine/SKILL.md` | Content routing bus. Every `content:*` action enters through here. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 platform rule layer. Email-specific rules in §"Email". |
| `social_media_skills/flyer-design/SKILL.md` | Print flyer compositor patterns (PDF rendering pipeline). |
| `social_media_skills/ig-single-post/SKILL.md` | Listing-agent headshot resolution and brand footer conventions. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer template. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B row for this producer. |

---

## 3. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:agent_coop_eflyer` | `mls_id` | Builds the full eflyer kit for that listing |

### Payload schema

```typescript
interface AgentCoopEflyerPayload {
  mls_id: string                  // MLS#.  required. Resolves the listing row.
  subject_hook?: string           // Optional. If absent, auto-derived from address fragment + price + acres/sqft.
  showing_link?: string           // Optional. Defaults to https://ryan-realty.com/listings/<mls_id>.
}
```

The brain populates `payload` when it writes the action row. For manual invocations via
`marketing_brain_skills/produce/SKILL.md`, Matt provides these fields in natural language and the
produce skill parses them.

---

## 4. Brief payload schema

```typescript
interface AgentCoopEflyerActionRow {
  id: string
  action_type: 'content:agent_coop_eflyer'
  target: string                  // 'mls:<mls_id>'
  assigned_producer: 'social_media_skills/agent-coop-eflyer'
  payload: AgentCoopEflyerPayload
  data_evidence: {
    audit_source?: string         // e.g. 'new_listing_trigger'
    opportunity_area?: string     // e.g. 'price_range_700k_900k_agent_pool'
    signal_evidence?: string
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 5. The recipe

**Step 1.  Read the action row.**
Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Read `payload.mls_id`. If
`mls_id` missing, set `status='killed'` with an `executor_response` error and surface to the
caller. Otherwise immediately:

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';
```

**Step 2.  Load mandatory references.**
Read every file in §2 before touching any deliverable.

**Step 3.  Pull the listing row from Supabase.**

```sql
SELECT
  "MlsId","StreetNumber","StreetName","City","StateOrProvince","PostalCode",
  "ListPrice","StandardStatus","BedroomsTotal","BathroomsTotal",
  "TotalLivingAreaSqFt","LotSizeAcres","SubdivisionName",
  "PublicRemarks","PhotoURL",
  "ListAgentFullName","ListAgentEmail","ListAgentDirectPhone",
  "ListOfficeName",
  "CumulativeDaysOnMarket",
  year_built, price_per_sqft
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

Verify `StandardStatus = 'Active'` or `'Coming Soon'`. If the listing is pending / closed /
withdrawn, surface to Matt.  an agent coop blast on a non-active listing is a compliance flag.
Do not render until the status is confirmed appropriate.

Per CLAUDE.md §0.  never inherit numbers from the payload. The payload only carries the
`mls_id`. Every price, count, day, and acre comes from this fresh query.

**Step 4.  Resolve the listing agent.**

Map `ListAgentEmail` / `ListAgentFullName` to one of the three Ryan Realty brokers:

| Email or Name match | Slug | Headshot path |
|---|---|---|
| Matt Ryan / mattryanrealtor@gmail.com | `matt-ryan` | `design_system/ryan-realty/assets/team/matt-ryan.png` |
| Paul Stevenson | `paul-stevenson` | `design_system/ryan-realty/assets/team/paul-stevenson.png` |
| Rebecca Peterson | `rebecca-peterson` | `design_system/ryan-realty/assets/team/rebecca-peterson.png` |

If the listing agent is not one of the three Ryan Realty brokers (i.e. someone else's listing
that ended up assigned to this action), set `status='killed'` and surface to Matt with the
discrepancy. This producer only ships agent-coop blasts for in-house listings.

**Step 5.  Pick the hero photo.**

Use `PhotoURL` array index 0 (the primary MLS hero shot). If `PhotoURL` is null or empty,
surface to Matt.  a coop email without a hero photo is non-shippable. Do not fall back to AI
or stock imagery per ANTI_SLOP_MANIFESTO.

Resize hero to 1200×675 (16:9). Cache locally at
`out/agent-coop/<slug>/assets/hero-1200x675.jpg`. Confirm dimensions before continuing.

**Step 6.  Derive the slug and the subject line.**

Slug pattern: `mls-<mls_id>` (e.g. `mls-220189422`). The output directory is
`out/agent-coop/<slug>/`.

Subject line pattern (if `subject_hook` not provided): `<short anchor>, <list_price_short>.  your client?`

- `<short anchor>`: street + city if compact (`Tumalo on 2 acres`) or city + key spec (`NE Bend 4bd/2.5ba`). Under 35 chars pre-price.
- `<list_price_short>`: short currency.  `$895K` not `$895,000`.
- The trailing em-dash + " your client?" is the only em-dash allowed in the entire deliverable. Subject-line connector only.

Hard constraint: subject ≤ 60 chars. Validate `.length`. Truncate the anchor if over.

Examples (all < 60): `Tumalo on 2 acres, $895K.  your client?` (40) · `NW Bend 4bd/2.5ba, $749K.  your client?` (39) · `Sisters river view, $1.295M.  your client?` (43).

No all-caps. No exclamation marks. No banned vocab. Write the validated string to `out/agent-coop/<slug>/subject-line.txt`.

**Step 7.  Resolve the showing link.**

If `payload.showing_link` is provided, use it. Validate it returns HTTP 200 via a HEAD request
before embedding. If `payload.showing_link` is absent, default to:

```
https://ryan-realty.com/listings/<mls_id>
```

HEAD-check that URL too. If it 404s, surface to Matt before continuing.  a coop blast with a
dead showing link is non-shippable.

**Step 8.  Compose the email body.**

Top-to-bottom HTML structure (table-based for Outlook):

1. **Hero banner.** `<img>` 1200×675, `max-width:100%; height:auto; display:block`. Alt text: `<address>.  <list_price_short>`.
2. **Address + price block.** `<table>` cell, `padding:28px 32px 0`, bg `#faf8f4`. Address `<h1>` Amboqia → Georgia fallback, 28 px navy `#102742`, line-height 1.05. Price `<div>` Amboqia 36 px navy, tabular-nums.
3. **Spec row.** Geist 500 (fallback `'Helvetica Neue', Arial`), 16 px navy: `<N> bd  ·  <N> ba  ·  <N> sqft  ·  <N> acres`. Tabular-nums. Middle-dot separators with 6 px padding either side.
4. **Pitch paragraph.** 2-3 sentences, Geist 400 15 px, navy 0.85, line-height 1.55. See §6 for voice rules.
5. **Showing link button.** `<a>` bg `#102742`, text `#faf8f4`, Geist 500 16 px, `padding:14px 28px`, `border-radius:10px`, `display:inline-block; text-decoration:none`. Label: `Schedule a showing →`. Href: resolved `showing_link`.
6. **Listing details block.** Two-column `<table>`. Left: MLS#, full address, subdivision (if present), year built, $/sqft. Right: listing agent headshot (80×80 circle), name (Geist 500 15 px navy), office (Geist 400 13 px navy 0.65), phone (Geist 500 15 px navy tabular-nums dotted `541.213.6706`), email.
7. **Navy footer strip.** Full-width row, bg `#102742`, 64 px tall, centered `logo-white.png` 200 px wide. No tagline, no social handles, no hashtags.
8. **Compliance footer.** Geist 400 11 px navy 0.50, centered, two lines: `Equal Housing Opportunity · Information deemed reliable but not guaranteed. Buyer to verify all data.` / `Listing courtesy of Ryan Realty · Central Oregon MLS #<mls_id>`.

**Step 9.  Inline the CSS + add dark-mode block.**

Must render correctly in Gmail, Outlook, Apple Mail, iOS / Android. Every rule inlined; no external stylesheets; no JavaScript. Single `<style>` block in `<head>` allowed only for dark-mode:

```css
@media (prefers-color-scheme: dark) {
  body, table, td { background:#0a1a2e !important; color:#faf8f4 !important; }
  h1,.price,.specs { color:#faf8f4 !important; }.compliance { color:rgba(250,248,244,0.50) !important; }.button { background:#faf8f4 !important; color:#102742 !important; }
}
```

Font fallback chain: Amboqia → `Georgia, 'Times New Roman', serif` (editorial); Geist → `'Helvetica Neue', Arial, sans-serif` (body/UI). Numerals: `font-variant-numeric:tabular-nums; font-feature-settings:'tnum';` on every numeric element. Outlook ignores `prefers-color-scheme`.  keeps the cream/navy default, which is brand-correct.

**Step 10.  Render the PDF.**

Single-page 8.5" × 11" portrait, 300 dpi. Mirrors the HTML body: hero full-bleed (8.5" × 4.78"), address + price, specs, pitch, listing details (two-column), navy footer strip, compliance footer. Replace the showing-link button with the bare URL in Geist 500 14 pt navy.  PDFs don't click.

Render via `lib/render-agent-coop-eflyer.mjs --mls <mls_id> --out out/agent-coop/<slug>/eflyer.pdf` (Puppeteer headless Chrome → PDF; reuses the print pipeline from `social_media_skills/flyer-design/SKILL.md`). Build the script if absent.

**Step 11.  Emit the plain-text body fallback.**

Write `out/agent-coop/<slug>/body.md` in markdown for text-only readers. Order:

```
<address fragment>, <list_price_short>.  your client?

<full address>
<list_price>
<N> bd · <N> ba · <N> sqft · <N> acres

<pitch paragraph.  same copy as HTML body, plain text only>

Schedule a showing: <showing_link>

MLS# <mls_id>
Year built: <year_built>
$/sqft: <price_per_sqft>

Listing agent: <ListAgentFullName>
Ryan Realty · <ListAgentDirectPhone>
<ListAgentEmail>

Equal Housing Opportunity. Information deemed reliable but not guaranteed.
Listing courtesy of Ryan Realty · Central Oregon MLS #<mls_id>
```

No hashtags. No social handles. No links other than the showing URL.

**Step 12.  Write citations.json.**

One entry per figure shown: price, beds, baths, sqft, acres, year built, $/sqft, MLS#, agent name, agent phone. Schema in §8.

**Step 13.  Run the QA gate.**

See §10. If any check fails, fix and re-render. Max 2 auto-iterations before surfacing the failure.

**Step 14.  UPDATE the action row.**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response=jsonb_build_object(
      'draft_path','out/agent-coop/<slug>/',
      'subject_line','<line>', 'subject_line_length',<int>,
      'html_path','out/agent-coop/<slug>/eflyer.html',
      'pdf_path','out/agent-coop/<slug>/eflyer.pdf',
      'text_path','out/agent-coop/<slug>/body.md',
      'citations_path','out/agent-coop/<slug>/citations.json',
      'showing_link_status','200',
      'scorecard','{...}'::jsonb
    )
WHERE id='<id>';
```

**Step 15.  Surface the draft to Matt.**

See §8 for the exact surface format. Then STOP. Do not commit. Do not push. Do not send. Wait
for Matt's explicit approval.

---

## 6. Voice.  agent-to-agent register

The receiving agent is a fellow professional. Treat them like one. The voice is peer broker,
not consumer-aimed sales copy.

### Pitch paragraph rules

- 2-3 sentences. No more.
- Lead with location anchor or one structural / land specific (e.g. "On two flat acres west of
  Tumalo," / "Custom 2024 build off Skyliners,").
- Middle: one or two specific facts from `PublicRemarks`, paraphrased. Never verbatim. Never
  banned vocab.
- Close: the "your client?" angle. Direct. E.g.:
  - `If your buyer wants room for horses without leaving the school district, this one earns a showing.`
  - `If your client is shopping the $700-800K range west of the river, take a look.`
  - `Your buyer who wanted Awbrey Glen but couldn't find a single-level.  here it is.`

### Banned vocab

Hard-fail if any term from the union in `marketing_brain_skills/brand-voice/voice_guidelines.md`
(real-estate clichés, AI filler, vague qualifiers, banned phrases) appears in subject, body,
headline, pitch, alt text, or compliance line. Run the producer-side grep against that file
at QA.  do not duplicate the list here (it drifts).

### Punctuation rules

- No exclamation marks anywhere. Subject line, body, alt text, compliance line.  none.
- Em-dashes (`. `) are banned in body copy. Allowed only as a connector in the subject line
  (per the locked subject-line pattern) and as a "no data" placeholder if a field is missing.
- No semicolons.
- Dotted phone format: `541.213.6706`. Always.

### Subject of address

- "You / your" addresses the receiving agent. "Your buyer / your client" addresses their book.
- "We / our team" speaks for Ryan Realty.
- Never "I". This is a brokerage-to-broker piece, not Matt's personal pitch.

---

## 7. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (project `dwvlophlbvvygjfxcrhm`) |
| Puppeteer (headless Chrome) | HTML → PDF | `lib/render-agent-coop-eflyer.mjs` |
| `sips` / `ffmpeg` | Hero resize to 1200×675 | local CLI |
| `fetch` HEAD | Showing link validation | n/a |
| Resend (send-side, NOT called by producer) | Sender `mail.ryan-realty.com` for manual Matt-driven blast | `RESEND_API_KEY` |
| ZipYourFlyer (send-side, NOT called by producer) | $19-$29 blast to 20,000+ Central Oregon agents | Manual upload by Matt |

The producer never calls Resend or ZipYourFlyer. It outputs the artifacts and stops.

---

## 8. Output format

**Draft lands at:** `out/agent-coop/<slug>/` where `<slug>` is `mls-<mls_id>`.

**Files produced:**

```
out/agent-coop/<slug>/
├── eflyer.html              ← responsive email HTML, inlined CSS, dark-mode tested
├── eflyer.pdf               ← single-page 8.5" × 11" PDF for ZipYourFlyer upload
├── subject-line.txt         ← exact subject line, ≤ 60 chars, single line, no trailing newline
├── body.md                  ← plain-text fallback body
├── citations.json           ← one entry per figure
├── provenance.json          ← hero photo source + license
├── design_scorecard.json    ← QA gate results
└── assets/
    └── hero-1200x675.jpg    ← cached hero photo at email dimensions
```

### Surface format (present to Matt exactly like this)

```
Agent co-op eflyer ready.  MLS #<mls_id> · <short address>

  SUBJECT LINE
    "<exact subject line>"   (<N>/60 chars)

  DELIVERABLES
    HTML:  out/agent-coop/<slug>/eflyer.html
    PDF:   out/agent-coop/<slug>/eflyer.pdf  (<size> KB)
    Text:  out/agent-coop/<slug>/body.md

  LISTING SNAPSHOT
    <full address> · $<list_price> · <N> bd · <N> ba · <N> sqft · <N> acres
    Year <year_built> · $/sqft $<price_per_sqft>
    Agent: <ListAgentFullName> (<broker_slug>)
    Showing: <showing_link>  (HEAD: <status>)

  VERIFICATION TRACE
    - $<list_price>.  Supabase listings, MlsId='<mls_id>', column ListPrice, fetched <iso>
    - <N> bd.  Supabase listings, column BedroomsTotal, fetched <iso>
    [...one line per figure...]

  citations.json: out/agent-coop/<slug>/citations.json

  DISTRIBUTION (manual.  producer does NOT send)
    (a) ZipYourFlyer upload.  eflyer.pdf.  $19-$29 blast
    (b) Manual Resend.  sender mail.ryan-realty.com → local agent list
        (verify domain status before sending)

Reply "ship it" / "approved" / "go" to commit the artifacts to main.
```

Then STOP. Do not commit. Do not push. Do not send. Wait.

### citations.json shape

```json
{
  "figures": [
    {
      "figure": "$895,000",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ListPrice",
      "value": 895000,
      "fetched_at": "2026-05-14T14:00:00Z"
    }
  ]
}
```

One entry per figure shown.  repeat the shape for every price, count, day, year, sqft, acre, $/sqft, MLS#, agent phone.

---

## 9. Approval gate

`matt-review-draft`.  Matt sees the rendered HTML preview (or local browser open), the
subject-line.txt content, and the QA scorecard. He says "ship it" / "approved" / "go" before
any commit lands on `main` and before any send happens.

Send is always manual. The producer surfaces the artifacts and the two distribution paths
(ZipYourFlyer upload OR manual Resend); Matt executes whichever path makes sense for the
listing.

---

## 10. QA gate

Run before surfacing. Write results to `out/agent-coop/<slug>/design_scorecard.json`. Any `fail` = non-ship. Auto-fix and re-render up to 2 times; if still failing, surface the failing check to Matt.

| # | Check | Pass condition |
|---|---|---|
| 1 | Subject line | `length <= 60`, no all-caps run > 4 chars (except NE/NW/SE/SW/MLS), no `!`, em-dash only once as connector |
| 2 | Banned vocab | Grep subject, pitch, alt text, compliance line against `voice_guidelines.md` union. Zero hits |
| 3 | Hero photo | Exactly 1200×675 JPEG, < 250 KB, MLS source in `provenance.json`, no AI, no watermark |
| 4 | Showing link | HEAD returns HTTP 200 |
| 5 | HTML structure | `max-width:640px` outer table, table-based layout, all CSS inlined except dark-mode `<style>` block |
| 6 | Dark mode | `@media (prefers-color-scheme: dark)` block present with required inversions |
| 7 | Tabular numerals | Every price/count/day/year/phone element has `font-variant-numeric: tabular-nums` |
| 8 | Data verified | Every figure in HTML/PDF/body.md appears in `citations.json` with `source`, `filter`, `column`, `value`, `fetched_at` |
| 9 | Listing agent | Resolves to matt-ryan / paul-stevenson / rebecca-peterson; headshot on disk; phone dotted format |
| 10 | Color compliance | Navy `#102742` + cream `#faf8f4` only. Zero gold (`#D4AF37`, `#C8A864`). `#0a1a2e` only inside dark-mode override |
| 11 | Logo asset | `logo-white.png` rendered, not re-typeset text |
| 12 | PDF format | Single page 8.5"×11" portrait, 300 dpi, < 4 MB |
| 13 | Hashtag absence | Zero hashtags anywhere.  email is hashtag-stripping per CLAUDE.md "Voice + content" |
| 14 | Punctuation | Zero `!` characters anywhere; zero em-dashes in body (subject connector excepted); zero semicolons |
| 15 | Status sanity | `StandardStatus` ∈ {`Active`, `Coming Soon`} |

---

## 11. Status flow

```
pending → in_production → ready → approved → executed → measured
                                                killed
```

The producer transitions:
- `pending → in_production` on pickup (Step 1 SQL; sets `executed_at=now()`).
- `in_production → ready` after the QA gate passes (Step 14 SQL; populates `executor_response`).
- The orchestrator / produce skill handles `ready → approved → executed → measured`.

`executed` here means the artifacts are committed to `main` and ready for Matt to upload to ZipYourFlyer or send via Resend. The actual delivery to inboxes is a manual step outside the producer. Full status semantics in `marketing_brain_skills/producers/TEMPLATE.md` §8.

---

## 12. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Showing link 404 | HEAD returns 4xx/5xx | Surface URL + status. Offer to swap to default `ryan-realty.com/listings/<mls_id>` if not already in use. Don't render until resolved |
| Resend sender domain unverified | `mail.ryan-realty.com` not verified | Surface dashboard link + DNS records. Still emit artifacts.  ZipYourFlyer path remains viable; flag Resend status in surface block |
| Subject line over 60 chars | length check fails after auto-derive | Drop prefix/city tokens, re-derive, re-check. Max 2 attempts before surfacing for Matt to pick a hook |
| Banned vocab hit | grep returns ≥ 1 | Rewrite offending sentence. Re-validate. Max 2 auto-iterations |
| Hero photo missing / watermarked | `PhotoURL[0]` null, 404, or visibly watermarked | Stop. Surface to Matt. Never fall back to AI / stock per ANTI_SLOP_MANIFESTO |
| Listing agent not in three-broker set | resolution fails | Set `status='killed'`. Coop blasts are in-house only |
| Listing status not Active / Coming Soon | pending / closed / withdrawn / expired | Surface to Matt. Compliance flag.  don't render |
| Outlook rendering broken | manual preview shows broken layout | Replace any flex/grid with `<table>`, inline more CSS, re-render. Outlook is the floor |
| ZipYourFlyer PDF rejected | Matt reports upload failed | Verify dimensions (8.5"×11"), DPI (≥ 300), single page, < 10 MB. Re-render |

### Open spec questions

- ZipYourFlyer preferred upload format (PDF vs HTML vs MJML): producer ships both PDF and HTML; Matt picks per upload.
- Resend domain verification status: producer flags status at surface step, not at render.
- Auto-open HTML preview in browser at surface step: default no; Matt opens via `open out/.../eflyer.html`.

---

## 13. What not to do

1. Never send the email. Producer prepares artifacts only; Matt sends.
2. Never include hashtags anywhere.  email is hashtag-stripping per CLAUDE.md "Voice + content."
3. Never use AI-generated property photos per ANTI_SLOP_MANIFESTO. MLS hero only.
4. Never re-typeset the wordmark. Always `logo-white.png`.
5. Never use exclamation marks, em-dashes in body, or semicolons. Subject connector em-dash is the single allowed exception.
6. Never use gold (`#D4AF37`, `#C8A864`). Navy + cream only.
7. Never ship a stat without a `citations.json` entry.  $/sqft, DOM, year built, every figure traces.
8. Never own the recipient list. ZipYourFlyer's database or Matt's Resend audience hold the list.
9. Never render an Outlook-broken layout. Outlook is the floor.

---

## 14. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0.  Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content".  hashtag-strip rule for email
- `design_system/ryan-realty/SKILL.md`.  brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice enforcement + banned vocab union
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint

**Format skills delegated to:**
- `social_media_skills/flyer-design/SKILL.md`.  print PDF pipeline (Puppeteer headless Chrome)
- `social_media_skills/ig-single-post/SKILL.md`.  listing-agent headshot resolution + brand footer conventions

**Playbooks and pipeline docs:**
- `automation_skills/content_engine/SKILL.md`.  content routing bus
- `social_media_skills/platform-best-practices/SKILL.md`.  email-specific platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned content gate

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section B (Content Producer), row `agent-coop-eflyer`

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
