---
name: site-matterport-embed
description: >
  Embeds an existing Matterport 3D virtual tour iframe into a property landing
  page on ryan-realty.com. Verifies the Matterport URL is live and matches the
  canonical pattern before generating the edit, then opens a GitHub PR that
  modifies the `MatterportEmbed` component, updates page meta + JSON-LD, and
  threads in a fallback "Schedule a virtual showing" CTA. Matterport tours
  increase showing rates 49% and time-on-page 3x (Virtuance 2025), so this is
  mandatory at $750K+ list price and standard at $500K+ per the list-kit
  content matrix. Does NOT generate the Matterport tour.  that is a separate
  vendor service (Matt or a contracted photographer creates the model). This
  producer only embeds an already-generated tour. Use whenever Matt says
  "embed the matterport for <address>", "add 3d tour to <MLS#> page", "embed
  matterport tour", or "wire up matterport for <listing>".
when_to_use: |
  Triggered by phrases:
  - "embed the matterport for <address>"
  - "add 3d tour to <MLS#> page"
  - "embed matterport tour"
  - "wire up matterport for <listing>"
  - "matterport iframe for <address>"
  - "add the 3d walkthrough to <MLS#>"
action_types:
  - site:matterport_embed
output_type: web-page
target_platforms: ["agentfire_blog"]
asset_destination: app/ (Next.js) via GitHub PR; opens PR to main for matt-review-PR approval
auto_inputs: ["design system v2 tokens", "shadcn/ui components", "site routing"]
required_inputs: ["page_slug OR neighborhood_slug"]
optional_inputs: ["hero_image_override", "schema_overrides"]
estimated_runtime_min: 20
cost_usd_estimate: $0.50-$2 per page (Anthropic for copy + JSON-LD scaffold)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.html
example_outputs: []
    label: "live neighborhood pages"
    surface: "agentfire_blog"
---

# Site Matterport Embed Producer

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Wire an existing Matterport 3D virtual tour iframe into the
property landing page at `app/listings/<slug>/page.tsx` (or the dedicated
`MatterportEmbed` client component referenced by that page). Verifies the
Matterport URL is live, matches the canonical
`https://my.matterport.com/show/?m=<modelId>` pattern, then opens a GitHub PR
that updates the component, the page meta description, and the
`RealEstateListing` JSON-LD with a `tourBookingPage` reference. Companion to
`site-edit` (text-only edits) and `site-page-create` (whole-page scaffolds).
Does NOT generate the Matterport model itself.

**Status.** Canonical.
**Locked.** 2026-05-14.
**Producer category.** Section C.  Site Producer (PR-based).
**Exemplar output.** GitHub PR URL in `executor_response.pr_url`.

---

## 1. Scope

### In scope
- `site:matterport_embed`.  insert or update a Matterport iframe on a single
  property landing page that already exists in `app/listings/<slug>/`
- HEAD-validate the Matterport URL is live (HTTP 200, not 404, not 403, not
  paywalled)
- Pattern-validate the URL matches `https://my.matterport.com/show/?m=<modelId>`
  exactly (the canonical Matterport public-tour pattern; private "space"
  variants are rejected)
- Extract the `modelId` from the URL and attach it as `data-matterport-id`
  on the iframe for downstream analytics
- Update the page meta description to append "Includes 3D virtual tour."
- Extend the `RealEstateListing` JSON-LD with `tourBookingPage` pointing at
  the Matterport URL
- Insert a `Card`-wrapped iframe block using shadcn/ui primitives, plus a
  `CardFooter` fallback CTA linking to the showing-request anchor (`#schedule`)
- Open a GitHub PR for Matt to review and merge

### Out of scope
- Generating the Matterport 3D tour itself (vendor service, not a producer)
- Creating a new property landing page → `site-page-create` (must run first if
  the page does not yet exist)
- Editing the rest of the page body, hero, gallery, or pricing block →
  `site-edit`
- Performance/lazy-loading infrastructure beyond `loading="lazy"` on this one
  iframe → `site-performance`
- Embedding a Zillow 3D Home tour, Asteroom, CubiCasa, or any other vendor. 
  Matterport only. For other vendors a new producer is needed
- Touching `app/layout.tsx` or any shared component (`components/ui/`,
  `components/listings/<shared>`).  escalate to Matt; layout-wide changes
  exceed this producer's surface

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `site:matterport_embed` | `mls_id`, `matterport_url` | Validates URL, extracts modelId, opens PR |

### Payload schema

```typescript
interface SiteMatterportEmbedPayload {
  mls_id: string          // e.g. "220189422".  resolves to app/listings/<slug>/
  matterport_url: string  // full URL: "https://my.matterport.com/show/?m=abc123XYZ"
}
```

Both fields are required. The brain populates both when generating the action
row; the produce skill (`marketing_brain_skills/produce/SKILL.md`) parses them
from Matt's natural-language request.

---

## 3. Brief payload schema

```typescript
interface SiteMatterportEmbedActionRow {
  id: string                  // uuid from marketing_brain_actions
  action_type: 'site:matterport_embed'
  target: string              // 'mls:220189422'
  assigned_producer: 'marketing_brain_skills/producers/site-matterport-embed'
  payload: SiteMatterportEmbedPayload
  data_evidence: {
    audit_source?: string     // e.g. 'list-kit content matrix'
    opportunity_area?: string // e.g. '$895K listing, no 3D tour wired'
    signal_evidence?: string  // e.g. 'Listing active 14 days, showing rate below target'
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1.  Read the action row and claim it.**

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately
set `status='in_production'` and `executed_at=now()`.

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';
```

If the row is not pending, stop and report the current status to Matt.

**Step 2.  Load mandatory references.**

Before touching any file:
- `CLAUDE.md` §0.  Data Accuracy mandate (any number embedded in copy traces)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (PR is the draft; never push to main)
- `CLAUDE.md` "Design System Rules.  MANDATORY".  shadcn/ui only; no raw HTML;
  no hex; tokens only
- `CLAUDE.md` "Design System v2.  Heritage + Web Registers".  Geist body,
  navy `#102742` primary, cream `#faf8f4` background
- `design_system/ryan-realty/SKILL.md`.  brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned vocab gate
- `marketing_brain_skills/producers/REGISTRY.md`.  Section C row

**Step 3.  Validate the Matterport URL pattern.**

The URL must match this exact regex (case-sensitive):

```
^https://my\.matterport\.com/show/\?m=[A-Za-z0-9]+(&[A-Za-z0-9_\-=&]+)?$
```

If the URL does not match:
- Set `status='killed'`
- `executor_response = {error: "Matterport URL pattern invalid", url: "<url>"}`
- Surface to Matt: "Matterport URL does not match the canonical public-tour
  pattern. Expected `https://my.matterport.com/show/?m=<modelId>`."
- Stop. Do not proceed.

Variants that are rejected: `matterport.com/spaces/<id>` (private space, not
public tour), `matterport.com/embed/...` (non-canonical embed URL),
`matterportvr.cn/*` (China mirror.  domain mismatch), shortlinks
(`bit.ly/...`, `mport.io/...`.  must be the resolved canonical URL).

**Step 4.  HEAD-validate the URL is live.**

```bash
curl -sI -A 'Mozilla/5.0 (RyanRealtyBrain) AppleWebKit/537.36' \
  --max-time 10 "<matterport_url>" \
  | head -1
```

Pass condition: HTTP 200, 301, or 302. Any 4xx or 5xx is a hard fail.

If the URL returns 404, 403, 410, or 5xx:
- Set `status='killed'`
- `executor_response = {error: "Matterport URL not reachable", http_status: <code>}`
- Surface to Matt with the exact HTTP code returned.
- If 403, note that Matterport may have set the tour to private.  Matt likely
  needs to mark it public in the Matterport dashboard before re-running.
- If 404, note that the model may have been deleted.
- Stop.

**Step 5.  Extract the `modelId`.**

Parse the `m` query parameter out of the URL. This is the unique Matterport
model identifier (typically 8-12 alphanumeric characters). Store it as
`matterport_model_id`. It will be embedded as `data-matterport-id` on the
iframe for analytics.

Example: `https://my.matterport.com/show/?m=abc123XYZ` → `modelId = "abc123XYZ"`.

**Step 6.  Resolve the property page slug.**

Map `payload.mls_id` to the property landing page directory:

```
app/listings/<mls_id>/page.tsx
```

The slug convention is the MLS ID directly. Confirm the path exists. If the
property page does not exist:
- Set `status='killed'`
- `executor_response = {error: "Property landing page not found", expected_path: "app/listings/<mls_id>/page.tsx", remediation: "Run site-page-create first"}`
- Surface to Matt: "No landing page exists at `app/listings/<mls_id>/`. Run
  the `site-page-create` producer to scaffold the page first, then re-queue
  this embed action."
- Stop.

Read the resolved `page.tsx` file in full before making any edit.

**Step 7.  Resolve the embed-component path.**

The Matterport embed lives in a sibling client component at:

```
app/listings/<mls_id>/_components/MatterportEmbed.tsx
```

If the component does not yet exist, create it from scratch using the
structure in §5 below. If it does exist (re-running this producer for an
updated tour), overwrite the `MATTERPORT_URL` and `MODEL_ID` constants and
re-validate.

The page (`page.tsx`) imports and renders `<MatterportEmbed />` inside the
listing detail layout.  confirm the import exists. If the import is missing,
add it (this is part of the edit).

**Step 8.  Construct the component.**

Build `MatterportEmbed.tsx` to the spec in §5 below. shadcn/ui only. 
`Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardFooter`, `Button`
from `@/components/ui/*`. The iframe uses Tailwind `aspect-video` to enforce
16:9, `loading="lazy"`, `allowfullscreen`, `referrerpolicy="strict-origin"`,
and `data-matterport-id={MODEL_ID}`.

Headline text in the card: `3D virtual tour` (sentence case, Geist).
Fallback CTA text in the footer: `Schedule a virtual showing` (sentence case).
Fallback CTA links to `#schedule` (the in-page showing-request anchor every
listing page exposes). Do NOT introduce a phone number, email, or external
URL in the card.  the CTA is anchor-only.

**Step 9.  Update the page meta description.**

In `app/listings/<mls_id>/page.tsx`, locate the `export const metadata`
object (or the `generateMetadata` function output). Append "Includes 3D
virtual tour." to the `description` field. If the description does not yet
end in a period, add the period first. Do not duplicate the sentence if it
already exists (idempotency).

```typescript
// before:
description: '4 bd, 3 ba in NW Bend, listed at $895,000.'
// after:
description: '4 bd, 3 ba in NW Bend, listed at $895,000. Includes 3D virtual tour.'
```

**Step 10.  Extend the JSON-LD.**

Locate the `RealEstateListing` JSON-LD block in `page.tsx` (typically a
`<Script type="application/ld+json">` element rendering a stringified JSON
object). Add a `tourBookingPage` field pointing at the Matterport URL.

```json
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "name": "...",
  "tourBookingPage": "https://my.matterport.com/show/?m=<modelId>",...
}
```

If `tourBookingPage` already exists with the same URL, leave it. If it exists
with a different URL, overwrite it (the new URL wins.  this is the canonical
embed action for this listing).

**Step 11.  Validate brand voice on all introduced copy.**

The only on-page copy this producer introduces:
- Card title: `3D virtual tour`
- Footer CTA: `Schedule a virtual showing`
- Meta description append: `Includes 3D virtual tour.`

Run these strings through the banned vocab union in
`marketing_brain_skills/brand-voice/voice_guidelines.md`. The canonical strings
above pass. If Matt has overridden via payload (none of the fields above are
configurable, but if future payload fields are introduced), validate each.

Banned in any introduced string: stunning, breathtaking, must-see, premier,
luxury, boutique, white-glove, immersive (overused), seamless, captivating,
delve, leverage, robust, comprehensive, elevate, unlock, passionate, dedicated,
em-dashes as punctuation, semicolons, exclamation marks, emoji.

**Step 12.  Design token compliance scan.**

After the edits, scan all touched files for:
- Any hex color (`#[0-9a-fA-F]{3,6}`) outside a comment.  fail
- Any raw `<button>`, `<input>`, `<select>`, `<a className="btn-..."`. 
  fail; shadcn/ui components only
- Any `className` containing `bg-[#...]` or `text-[#...]` literal hex
  overrides.  fail
- Inline `style={...}` with color values.  fail

If violations found, revert and halt with `status='killed'` and the violation
listed in `executor_response`.

**Step 13.  Run TypeScript type check.**

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1 | head -40
```

Pass condition: zero errors. If errors exist:
- Revert all file edits
- Set `status='killed'`
- `executor_response = {error: "TypeScript compile failed", tsc_output: "<first 20 lines>"}`
- Do not open a PR.

**Step 14.  Create a git branch and commit.**

Branch name: `site-matterport-embed/<action_id_first_8>` (e.g.
`site-matterport-embed/a1b2c3d4`).

```bash
git checkout -b site-matterport-embed/<action_id_8>
git add app/listings/<mls_id>/page.tsx \
        app/listings/<mls_id>/_components/MatterportEmbed.tsx
git commit -m "site(<mls_id>): embed Matterport 3D tour

Action row: <id>
Model ID: <modelId>
URL: <matterport_url>
Validation: HTTP <code>, pattern match, tsc clean
Files: 2 changed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin site-matterport-embed/<action_id_8>
```

**Step 15.  Open the GitHub PR.**

```bash
gh pr create \
  --title "site(<mls_id>): embed Matterport 3D tour" \
  --body "$(cat <<'EOF'
## Summary
- MLS: `<mls_id>`
- Matterport URL: `<matterport_url>`
- Model ID: `<modelId>`
- Action row: `<id>`

## What changed
- `app/listings/<mls_id>/_components/MatterportEmbed.tsx`.  Card-wrapped iframe with `aspect-video`, lazy loaded, `data-matterport-id` set, fallback CTA in footer linking to `#schedule`
- `app/listings/<mls_id>/page.tsx`.  meta description appended with "Includes 3D virtual tour.", `RealEstateListing` JSON-LD extended with `tourBookingPage`

## Validation
- URL pattern: PASS (`https://my.matterport.com/show/?m=...`)
- URL reachability: PASS (HTTP 200)
- TypeScript: PASS (`tsc --noEmit` zero errors)
- Voice check: PASS (no banned vocab in introduced copy)
- Design tokens: PASS (shadcn/ui only, no hex)

## Approval gate
Matt merges this PR in GitHub. Do NOT approve via the action row in the brain.

Generated with Claude Code / marketing brain.  site-matterport-embed producer
EOF
)"
```

**Step 16.  Update the action row to `ready`.**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{
      "branch_name": "site-matterport-embed/<action_id_8>",
      "pr_url": "<pr_url>",
      "files_changed": [
        "app/listings/<mls_id>/_components/MatterportEmbed.tsx",
        "app/listings/<mls_id>/page.tsx"
      ],
      "matterport_model_id": "<modelId>",
      "matterport_url": "<matterport_url>",
      "url_validation": {"pattern": "pass", "http_status": 200},
      "tsc_clean": true,
      "voice_validated": true
    }'::jsonb
WHERE id='<id>';
```

**Step 17.  Surface to Matt.**

See §6 for the exact surface format. Then stop. Wait for the PR merge.

---

## 5. Component structure (shadcn/ui only)

```tsx
// app/listings/<mls_id>/_components/MatterportEmbed.tsx
'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const MATTERPORT_URL = 'https://my.matterport.com/show/?m=<modelId>'
const MODEL_ID = '<modelId>'

export function MatterportEmbed() {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>3D virtual tour</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="aspect-video w-full bg-muted">
          <iframe
            src={MATTERPORT_URL}
            title="3D virtual tour"
            loading="lazy"
            allow="xr-spatial-tracking; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin"
            data-matterport-id={MODEL_ID}
            className="h-full w-full border-0"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild variant="secondary" className="w-full sm:w-auto">
          <a href="#schedule">Schedule a virtual showing</a>
        </Button>
      </CardFooter>
    </Card>
  )
}
```

Constants `MATTERPORT_URL` and `MODEL_ID` are substituted at edit time. The
component is a client component (`'use client'`) because the iframe needs to
hydrate the user's session for tour analytics. Tailwind classes use shadcn
tokens only (`bg-muted`, `border-0`). The `aspect-video` class enforces 16:9
so the iframe never reflows the page on load.

The fallback CTA (`Button` with `variant="secondary"`, anchor `href="#schedule"`)
is the legal fallback if the iframe is blocked by CSP, ad-block, or a private
Matterport tour. The button is a `<Button asChild>` wrapping an `<a>`.  never
a raw `<button>` or styled `<a className="btn-...">`.

---

## 6. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Bash: `curl -sI` | HEAD-validate the Matterport URL |.  |
| Read (file) | Read `page.tsx` before edit |.  |
| Edit (file) | Apply meta + JSON-LD edits |.  |
| Write (file) | Create `MatterportEmbed.tsx` if absent |.  |
| Bash: `npx tsc --noEmit` | TypeScript compile check | runs in `/Users/matthewryan/RyanRealty` |
| Bash: `git checkout -b`, `git add`, `git commit`, `git push` | Branch + push |.  |
| Bash: `gh pr create` | Open the PR | `GH_TOKEN` or active gh session |
| Supabase MCP | Read + update `marketing_brain_actions` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 7. Output format

**Draft lands at:** a GitHub PR (not a local file path; the PR is the deliverable).

**Files modified on the branch:**

```
app/listings/<mls_id>/
├── _components/
│   └── MatterportEmbed.tsx       (created or overwritten)
└── page.tsx                       (meta description + JSON-LD extended;
                                    MatterportEmbed import added if absent)
```

**Surface format (present to Matt exactly like this):**

```
Draft ready: site-matterport-embed.  <mls_id>

  PR
    URL: <pr_url>
    Branch: site-matterport-embed/<action_id_8>
    Files: 2 changed

  EMBED
    Matterport URL: <matterport_url>
    Model ID: <modelId>
    Validation: HTTP 200 ✓ · pattern match ✓ · tsc clean ✓

  COMPONENT
    Path: app/listings/<mls_id>/_components/MatterportEmbed.tsx
    Card title: "3D virtual tour"
    Fallback CTA: "Schedule a virtual showing" → #schedule
    iframe: aspect-video, loading="lazy", data-matterport-id="<modelId>"

  PAGE META
    Description appended: "Includes 3D virtual tour."
    JSON-LD: tourBookingPage = <matterport_url>

Matt merges the PR in GitHub to ship. No additional approval step in the brain.
```

Then stop. Wait for the merge.

---

## 8. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the PR in GitHub | Matt only.  via GitHub UI |

This producer does NOT use `matt-review-draft`. The PR is the draft. Matt
evaluates the diff in GitHub and merges to ship. The action row advances from
`ready` to `approved` when the PR is merged (tracked via the GitHub webhook
that updates the brain, or via manual status update if the webhook is offline).

---

## 9. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │
        ├── URL pattern fail   → killed
        ├── URL not reachable  → killed
        ├── page does not exist→ killed (run site-page-create first)
        ├── tsc fail           → killed (edits reverted)
        ├── voice fail         → killed (canonical strings are checked; only fails if payload overrides)
        │
        ▼ (PR opened)
      ready        ← executor_response populated with pr_url, branch, files
        │ Matt merges PR in GitHub
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ Vercel build completes
        ▼
    executed       ← terminal success
        │ 48h post-publish (showing-rate, time-on-page delta captured)
        ▼
    measured       ← performance_loop writes metrics to content_performance

    killed         ← terminal failure
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On PR open (ready):
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"branch_name":"...","pr_url":"...","files_changed":["..."],"matterport_model_id":"...","matterport_url":"...","url_validation":{"pattern":"pass","http_status":200},"tsc_clean":true,"voice_validated":true}'::jsonb
WHERE id='<id>';

-- On Matt merge (approved):
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 10. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Matterport URL returns 404 | `curl -sI` returns `HTTP/2 404` | Set `status='killed'`; surface to Matt with the URL and HTTP status. Likely cause: the Matterport model was deleted or the URL was mistyped. Confirm the canonical URL in the Matterport dashboard, then re-queue. |
| Matterport URL returns 403 | `curl -sI` returns `HTTP/2 403` | Set `status='killed'`; surface to Matt. Likely cause: the Matterport model is set to private. Matt marks the tour public in the Matterport dashboard, then re-queues the action. |
| URL pattern invalid | Regex match fails (e.g. `matterport.com/spaces/<id>`, shortlink, China mirror) | Set `status='killed'`; surface with the expected pattern. The user resolves the canonical URL (`https://my.matterport.com/show/?m=<modelId>`) and re-queues. |
| Property landing page does not exist | `app/listings/<mls_id>/page.tsx` not found | Set `status='killed'`; surface: "Run `site-page-create` for MLS `<mls_id>` first, then re-queue this embed action." This producer never creates the property page itself. |
| iframe blocked by CSP | After deploy, the iframe fails to load in browsers due to `frame-src` restriction | Diagnose by inspecting the page's CSP header (`next.config.js` or middleware). If `frame-src` excludes `my.matterport.com`, open a follow-up `site-edit` action to whitelist the domain. The fallback CTA in the footer keeps the page functional until the CSP fix lands. |
| Matterport model is private (no public access) | iframe renders but content shows Matterport login wall | The fallback CTA catches the user. Matt is alerted in the next dashboard digest. Producer doesn't auto-detect this (HEAD returns 200 even for login-walled tours).  content auditor flags it post-deploy. |
| TypeScript compile error after edit | `npx tsc --noEmit` returns non-zero | Revert all edits; set `status='killed'`; surface the first 20 lines of tsc output. Likely cause: a Card or Button import is missing from `@/components/ui/*`.  re-verify shadcn is installed. |
| Banned vocab introduced via payload override | Future payload field overrides title/CTA with banned word | Reject and halt; set `status='killed'`; surface the violation. The canonical strings ("3D virtual tour" / "Schedule a virtual showing") never fail this check. |
| Voice fail on meta description (existing copy has banned word) | The existing `description` already contains banned vocab unrelated to this action | This producer appends "Includes 3D virtual tour." and does NOT rewrite existing description copy. Flag the pre-existing violation in the PR body but do not block. Open a separate `site-edit` action for the cleanup. |
| Git branch already exists on remote | `git push` rejected because branch exists | Delete and recreate: `git push origin --delete site-matterport-embed/<action_id_8>` then re-push. This typically happens only on producer retries. |
| `gh` CLI not authenticated | `gh pr create` fails with auth error | Surface to Matt: "gh CLI needs authentication. Run `gh auth login` in terminal." Do not auto-create the PR via REST as a fallback.  that bypasses Matt's review tooling. |

**Open spec questions (resolved in favor of the simplest correct behavior):**
- Should the producer support multiple Matterport URLs per listing (e.g. one
  per unit in a multifamily)? Answer: no.  one URL per listing. If a future
  multi-unit case appears, spawn a new producer.
- Should the producer auto-detect the analytics integration (Plausible /
  GA4) and emit a custom event on iframe load? Answer: no.  the
  `data-matterport-id` attribute is exposed for the analytics layer to read,
  but emitting events is a separate concern (a `site-analytics` producer if
  ever needed).

---

## 11. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0.  Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last (PR is the draft; never push to main)
- `CLAUDE.md` "Design System Rules.  MANDATORY".  shadcn/ui only; no raw HTML; no hex
- `CLAUDE.md` "Design System v2.  Heritage + Web Registers".  navy + cream; Geist body
- `design_system/ryan-realty/SKILL.md`.  brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice enforcement
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md`.  Matt's writing fingerprint

**Sibling site producers:**
- `marketing_brain_skills/producers/site-edit/SKILL.md`.  text-only edits to existing pages
- `marketing_brain_skills/producers/site-page-create/SKILL.md`.  scaffolds new property pages (must run before this producer if the listing page does not yet exist)
- `marketing_brain_skills/producers/site-performance/SKILL.md`.  performance / redirect / JSON-LD-only edits

**Playbooks and pipeline docs:**
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer structural template
- `marketing_brain_skills/producers/REGISTRY.md`.  Section C row `site-matterport-embed`
- `automation_skills/content_engine/SKILL.md`.  content routing reference
- `social_media_skills/list-kit/SKILL.md`.  content matrix that flags listings missing a 3D tour at $750K+ / $500K+

**External references:**
- Matterport public tour URL spec: `https://my.matterport.com/show/?m=<modelId>` (canonical pattern)
- Schema.org `RealEstateListing.tourBookingPage`.  https://schema.org/RealEstateListing
- Virtuance 2025 study: Matterport tours +49% showing rate, +3x time-on-page

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section C, row `site-matterport-embed`

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
