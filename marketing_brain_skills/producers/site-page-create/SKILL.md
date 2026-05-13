---
name: site-page-create
description: >
  Scaffolds a new Next.js page or campaign landing page on ryan-realty.com.
  Given a route, template type, and content spec, creates the page.tsx file,
  wires lead forms when needed, adds the route to the sitemap, and opens a
  GitHub PR for Matt's review before the page is live.
action_types:
  - site:page_create
  - site:landing_page_create
---

# Site Page Create Producer

**Scope:** Creates brand-new Next.js route files that do not yet exist in the
`app/` directory. Outputs a fully typed `page.tsx` file following the existing
codebase patterns (shadcn/ui components, server components where possible, design
tokens from `app/globals.css`, Geist body font, Amboqia Boriango for hero H1 only).
Also adds the new route to `app/sitemap.ts` and, for landing pages, wires the
lead-capture form to `app/actions/lead-capture.ts`. Every new page lands in a
branch + PR — never directly on `main`.

This producer does NOT edit existing pages (that is `site-edit`) and does NOT
handle performance fixes (that is `site-performance`).

**Status:** Canonical  
**Locked:** 2026-05-13  
**Exemplar output:** GitHub PR URL in `executor_response.pr_url`

---

## 1. Scope

### In scope
- `site:page_create` — new informational, neighborhood, or FAQ page at a new route
- `site:landing_page_create` — new campaign landing page with optional lead-capture
  form, wired to `app/actions/lead-capture.ts` and the CAPI fan-out
- Adding the new route to `app/sitemap.ts`
- Setting `export const metadata` (title, description, OG, Twitter) in the new file
- Writing all copy in brand voice per `marketing_brain_skills/brand-voice/voice_guidelines.md`
- TypeScript compile verification before PR opens

### Out of scope
- Editing existing page files → `site-edit`
- Performance, redirects, schema markup on existing pages → `site-performance`
- Creating shared components (anything under `components/`) — escalate to Matt
- Creating API routes (`app/api/`) — escalate to Matt
- Pages that require database writes other than the existing `lead-capture` action — escalate

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:page_create` | `page_path`, `page_type`, `template`, `title`, `meta_description`, `hero`, `sections[]` | No lead form required |
| `site:landing_page_create` | All of above + `lead_form` | Lead form wired to `lead-capture.ts` |

### Payload schema

```typescript
interface SitePageCreatePayload {
  page_path: string            // new route — must NOT already exist, e.g. "/sell/duplex-bend"
  page_type: 'landing' | 'content' | 'neighborhood' | 'faq'
  template: 'hero+features+cta' | 'long_form_seo' | 'lead_gen'
  title: string                // used as H1 and metadata.title
  meta_description: string     // 150–160 chars; used in metadata.description
  hero: {
    headline: string           // Amboqia Boriango H1 — direct, specific, no clichés
    subhead: string            // Geist body — one sentence, value-first
    image_path?: string        // optional: path relative to /public, e.g. "/images/bend-river.webp"
    cta_text: string           // Button label — action verb, specific
    cta_url: string            // Destination — absolute path or /route
  }
  sections: Array<{
    heading: string            // Section H2 — Geist 600 or Amboqia for display moments
    body: string               // Paragraph or bullet list copy
    image_path?: string        // optional section image
  }>
  lead_form?: {
    fields: string[]           // e.g. ["name", "email", "phone", "message"]
    submit_action: string      // maps to a server action; use "lead-capture" for standard form
    success_message: string    // shown after successful submission; no clichés
  }
}
```

---

## 3. Full action row schema

```typescript
interface SitePageCreateActionRow {
  id: string
  action_type: 'site:page_create' | 'site:landing_page_create'
  target: string               // e.g. 'page:/sell/duplex-bend'
  assigned_producer: string    // 'marketing_brain_skills/producers/site-page-create'
  payload: SitePageCreatePayload
  data_evidence: {
    audit_source?: string      // e.g. 'audit-website', 'competitor-recon'
    opportunity_area?: string  // e.g. 'no duplex buyer page; competitor has one ranking #3'
    signal_evidence?: string   // e.g. 'GSC: 240 impressions/mo for "duplex bend oregon", position 18'
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1 — Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

Confirm `status` was 'pending'. If not, stop and report.

**Step 2 — Load mandatory references**

Before writing a single line of code:
- `CLAUDE.md` §0 — Data Accuracy (any market figures cited in page body must be verified)
- `CLAUDE.md` "Draft-First, Commit-Last" — PR is the draft; Matt merges to ship
- `CLAUDE.md` "Design System Rules — MANDATORY" — shadcn/ui only; no raw HTML elements
- `CLAUDE.md` "Design System v2 — Heritage + Web Registers" — Web register for UI pages
- `design_system/ryan-realty/SKILL.md` — brand register; fonts; color tokens; radii
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice; banned words
- `app/actions/lead-capture.ts` — if `lead_form` is present, read the existing action signature

**Step 3 — Confirm the route does not already exist**

Check that `app/<page_path>/page.tsx` does NOT exist. If it does:
- Set `status='killed'`
- `executor_response = {error: "Route already exists: app/<page_path>/page.tsx. Use site-edit to modify it."}`
- Stop.

**Step 4 — Validate all copy for brand voice**

Before generating any file, validate every string that will appear in the page against
`marketing_brain_skills/brand-voice/voice_guidelines.md`:

- `payload.hero.headline` — no clichés, no banned words, no exclamation marks
- `payload.hero.subhead` — direct, specific, one clause max
- Every `section.heading` and `section.body`
- `payload.lead_form.success_message` if present
- `payload.title` and `payload.meta_description`

Banned words: stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking,
must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden
gem, truly, spacious, cozy, luxurious, updated throughout.

Banned punctuation: em-dash as punctuation, semicolons in body, exclamation marks in
body, emoji.

Banned filler: delve, leverage, tapestry, navigate, robust, seamless, comprehensive,
elevate, unlock, passionate, dedicated, premier, boutique.

If any payload copy fails:
- Set `status='pending'` with `generation_reason` prefixed `VOICE_FAIL: <rule>`
- `executor_response = {voice_fail: true, violations: [{field, rule_violated, text}]}`
- Stop. Do not create the file.

**Step 5 — Verify any market figures cited in `sections[].body`**

If any section body contains price figures, inventory counts, days on market, median
values, or any other real estate statistics:

- Pull the figure from Supabase (`market_pulse_live`, `market_stats_cache`, or
  `listings`) in this session
- Per CLAUDE.md §0: produce a one-line verification trace per figure
- If the figure cannot be verified: remove it from the section body rather than
  publishing an unverified stat

**Step 6 — Scaffold the page file**

Create `app/<page_path>/page.tsx`. Follow the conventions observed in
`app/sell/page.tsx` and `app/page.tsx`:

**File structure:**
```typescript
import type { Metadata } from 'next'
// shadcn/ui imports only — never raw HTML for UI
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
// ... other shadcn components as needed

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: '<payload.title> | Ryan Realty',
  description: '<payload.meta_description>',
  alternates: { canonical: `${siteUrl}<payload.page_path>` },
  openGraph: {
    title: '<payload.title> | Ryan Realty',
    description: '<payload.meta_description>',
    url: `${siteUrl}<payload.page_path>`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: `${siteUrl}/og-home.png`, width: 1200, height: 630, alt: '<payload.title>' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '<payload.title> | Ryan Realty',
    description: '<payload.meta_description>',
    images: [`${siteUrl}/og-home.png`],
  },
}

export default async function <PageName>Page() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero section */}
      {/* Feature sections */}
      {/* Lead form (if applicable) */}
      {/* CTA */}
    </main>
  )
}
```

**Design system rules for new pages (Web register):**
- Background: `bg-background` (maps to cream `#faf8f4` via CSS var)
- Primary action buttons: `<Button>` with `variant="default"` (`bg-primary text-primary-foreground`)
- Card containers: `<Card>` from `@/components/ui/card` — never raw `<div className="rounded...">`
- H1 / hero headline: Amboqia Boriango — apply via `font-display` class or inline style using the CSS var
  `--font-display` from `design_system/ryan-realty/colors_and_type.css`. Only the hero H1 uses Amboqia.
- All other text: Geist (default font-sans — already loaded via `next/font/geist` in `app/layout.tsx`)
- Navy primary: `text-primary` or `bg-primary` — never `text-[#102742]` or `bg-[#102742]`
- No gold anywhere. Gold is removed from v2 system.
- Radii: use Tailwind radius utilities that map to the token ladder:
  `rounded-lg` (10px), `rounded-xl` (14px), `rounded-2xl` (18px)
- Shadows: `shadow-sm`, `shadow-md` — navy-tinted via CSS var; no custom box-shadow

**Template implementations:**

*`hero+features+cta`:*
- Hero: full-width section with H1, subhead, and primary Button
- Features: 2–3 `<Card>` elements in a responsive grid with heading + body per `sections[]`
- CTA: `<Button>` linking to `payload.hero.cta_url`

*`long_form_seo`:*
- Hero: same as above
- Sections: stacked `<section>` blocks, each with H2 + body + optional image
- CTA at page bottom

*`lead_gen`:*
- Hero + features as above
- Lead form section: use `<Card>` wrapper; fields driven by `payload.lead_form.fields`
  - Use `<Input>` from `@/components/ui/input` for text/email/tel fields
  - Use `<Textarea>` from `@/components/ui/textarea` for message field
  - Use `<Label>` from `@/components/ui/label` for every input
  - Submit: `<Button type="submit">` with `payload.lead_form.cta_text` or "Request info"
  - Wire to `app/actions/lead-capture.ts` server action per existing pattern

**Lead form wiring (landing pages only):**

Inspect `app/actions/lead-capture.ts` for the exact function signature before
implementing the form. Use a server action (`'use server'`) form submission pattern
matching the existing codebase. Do NOT write a custom fetch to an API route if a
server action exists.

**Step 7 — Add route to sitemap**

Read `app/sitemap.ts`. Add an entry for the new route:

```typescript
{
  url: `${siteUrl}<payload.page_path>`,
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.7,   // landing pages: 0.8; content pages: 0.7; neighborhood pages: 0.6
}
```

**Step 8 — Run TypeScript type check**

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

If TypeScript errors:
- Do NOT push the branch
- Fix the errors (type imports, missing return types, invalid props)
- If unfixable within 2 iterations: set `status='killed'`, surface the tsc output to Matt

**Step 9 — Create branch and commit**

Branch: `site-page-create/<action_id>` (first 8 chars of id UUID)

```bash
git checkout -b site-page-create/<action_id>
git add app/<page_path>/page.tsx app/sitemap.ts
git commit -m "site-page-create(<page_path>): scaffold <page_type> page

Action row: <id>
Template: <template>
Route: <page_path>
Rationale: <generation_reason>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin site-page-create/<action_id>
```

**Step 10 — Open GitHub PR**

```bash
gh pr create \
  --title "site-page-create(<page_path>): <payload.title>" \
  --body "$(cat <<'EOF'
## Summary
- New route: `<page_path>`
- Page type: `<page_type>`
- Template: `<template>`
- Action row: `<id>`

## Pages created
- `app/<page_path>/page.tsx`
- Updated: `app/sitemap.ts`

## Content
- H1: <payload.hero.headline>
- Meta: <payload.meta_description>
- Sections: <N>
- Lead form: <yes/no>

## Voice validation
All copy passed brand voice check. No banned words, no exclamation marks, no AI filler.

## Data accuracy
<If market figures: list each figure + Supabase source + fetched_at>
<If no market figures: "No market statistics on this page.">

## TypeScript
`npx tsc --noEmit` returned zero errors.

## Design tokens
shadcn/ui only. No raw HTML UI elements. No hex overrides.

## Approval gate
Matt merges this PR in GitHub to make the page live.

🤖 Generated with Claude Code / marketing brain — site-page-create producer
EOF
)"
```

**Step 11 — Update action row to 'ready'**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "branch_name": "site-page-create/<action_id>",
      "pr_url": "<pr_url>",
      "files_changed": ["app/<page_path>/page.tsx", "app/sitemap.ts"],
      "page_path": "<page_path>",
      "template": "<template>",
      "voice_validated": true,
      "tsc_clean": true
    }'::jsonb
WHERE id = '<id>';
```

**Step 12 — Surface to Matt**

```
Draft ready: site-page-create — <page_path>

  PR
    URL: <pr_url>
    Branch: site-page-create/<action_id>

  PAGE
    Route: <page_path>
    Type: <page_type>
    Template: <template>
    H1: <payload.hero.headline>
    CTA: <payload.hero.cta_text> → <payload.hero.cta_url>
    Sections: <N>
    Lead form: <yes — wired to lead-capture.ts / no>

  VERIFICATION TRACE
    <one line per market stat, or "No market statistics on this page.">

  SITEMAP
    app/sitemap.ts updated with <page_path>

  VALIDATION
    Voice: PASS
    TypeScript: PASS (zero errors)
    Design tokens: PASS — shadcn/ui only

Matt merges the PR in GitHub to ship. The page goes live on Vercel deploy.
```

Then stop. Wait for Matt to merge.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Read (file) | Read `app/actions/lead-capture.ts`, `app/sitemap.ts`, existing pages for pattern reference | — |
| Write (file) | Create `app/<page_path>/page.tsx` | — |
| Edit (file) | Append route entry to `app/sitemap.ts` | — |
| Bash: `npx tsc --noEmit` | TypeScript compile check | runs in `/Users/matthewryan/RyanRealty` |
| Bash: `git checkout -b`, `git add`, `git commit`, `git push` | Branch, stage, commit, push | — |
| Bash: `gh pr create` | Open GitHub PR | active `gh` session |
| Supabase MCP | Update `marketing_brain_actions`; query market figures if present in sections | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. Output format

**Draft lands at:** GitHub PR  
**Files produced:**
```
app/<page_path>/page.tsx       (new file, on branch)
app/sitemap.ts                 (updated, on branch)
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the PR in GitHub | Matt only — via GitHub UI |

---

## 8. Status flow

```
pending           ← producer reads row here
  │
  ▼
in_production     ← set on pickup; executed_at=now()
  │
  ├── Route already exists → killed
  ├── Voice fail → pending (VOICE_FAIL: prefix in generation_reason)
  ├── TypeScript fail (after 2 fix attempts) → killed
  │
  ▼ (branch + PR created)
ready             ← executor_response = {branch_name, pr_url, files_changed}
  │
  ▼ (Matt merges PR)
approved
  │
  ▼ (Vercel build + deploy completes)
executed
  │
  ▼ (48h: audit-website captures impressions, clicks, first conversions)
measured
```

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On PR open:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"branch_name":"...","pr_url":"...","files_changed":["...","..."]}'::jsonb
WHERE id='<id>';

-- On merge:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Route already exists | `app/<page_path>/page.tsx` found on disk | Set `status='killed'`; suggest `site-edit` instead |
| Voice validation fail | Banned word or punctuation in payload copy | Set `status='pending'`, `VOICE_FAIL:` prefix; return to generate-briefs |
| Market stat unverifiable | Supabase returns 0 rows for the cited figure | Remove the stat from section body; document in PR description |
| TypeScript error unfixable in 2 iterations | Persistent type error in generated code | Set `status='killed'`; surface tsc output; explain what needs manual resolution |
| Lead form action mismatch | `lead-capture.ts` signature changed since producer was written | Read the current action file; adapt the form component; if the mismatch is a breaking API change, escalate to Matt |
| Sitemap parse error | `app/sitemap.ts` uses an unexpected structure | Read the file; adapt the append logic; do not rewrite the whole file |
| Image path not found | `payload.hero.image_path` does not exist in `/public` | Use a fallback from the existing image inventory (e.g. `/og-home.png`) and note in PR that an image needs to be added |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy (market figures in page body must be verified)
- `CLAUDE.md` "Draft-First, Commit-Last" — PR = draft; never push to main
- `CLAUDE.md` "Design System Rules — MANDATORY" — shadcn/ui only
- `CLAUDE.md` "Design System v2 — Heritage + Web Registers" — Web register for new pages
- `design_system/ryan-realty/SKILL.md` — color tokens, type families, radii, shadow ladder
- `design_system/ryan-realty/colors_and_type.css` — CSS variable definitions
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement
- `app/actions/lead-capture.ts` — read before implementing any lead form

**Codebase patterns to match:**
- `app/sell/page.tsx` — example of a server component page with metadata and shadcn components
- `app/page.tsx` — example of a complex page with Suspense boundaries and server data
- `app/sitemap.ts` — existing sitemap structure to extend

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section C, row `site-page-create`
