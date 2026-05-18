---
name: site-performance
description: >
  Applies targeted performance and SEO infrastructure fixes to ryan-realty.com:
  lazy-loading images, redirect rules in next.config.ts, and JSON-LD structured
  data on specific pages. Opens a GitHub PR for Matt's review before any change
  reaches production.
action_types:
  - site:perf_fix
  - site:redirect_add
  - site:schema_add
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

# Site Performance Producer

**Scope:** Technical fixes to the Next.js app that improve Core Web Vitals, crawl
efficiency, or structured-data richness.  without changing user-visible copy or
scaffolding new pages. This producer handles three fix types: lazy-loading images on
existing pages, adding 301 redirects to `next.config.ts`, and adding JSON-LD
`<Script>` blocks to existing pages. It does NOT write copy (that is `site-edit`),
does NOT create new pages (that is `site-page-create`), and does NOT run image
conversion tooling.  it applies `loading="lazy"` attributes and `decoding="async"`
in the JSX source.

Every fix lands in a branch + PR.  never directly on `main`.

**Status:** Canonical  
**Locked:** 2026-05-13  
**Exemplar output:** GitHub PR URL in `executor_response.pr_url`

---

## 1. Scope

### In scope
- `site:perf_fix` with `fix_type='lazy_load'`.  add `loading="lazy"` +
  `decoding="async"` to `<Image>` or `<img>` elements below the fold on a specific page
- `site:perf_fix` with `fix_type='image_optimize'`.  convert a referenced PNG in
  `public/` to WebP using `sharp` or `cwebp` CLI; update the import/src reference in
  the page file
- `site:perf_fix` with `fix_type='font_strategy'`.  adjust font display strategy in
  `app/layout.tsx` (e.g. add `display: 'swap'` to a `next/font` call)
- `site:redirect_add`.  append a redirect entry to the `redirects()` array in
  `next.config.ts`
- `site:schema_add`.  inject a `<Script type="application/ld+json">` block into a
  specific page file

### Out of scope
- Changing copy, metadata, or CTAs → `site-edit`
- Creating new page files → `site-page-create`
- Bulk image audit or conversion of all images across the repo.  escalate to Matt;
  this producer handles one targeted fix per action row
- Editing the Next.js image `remotePatterns` configuration (security-sensitive).  escalate
- Adding new npm packages → escalate; `sharp` is already a dependency in this repo

---

## 2. Action types handled

| action_type | payload fields required | notes |
|---|---|---|
| `site:perf_fix` | `fix_type`, `page_path` (for lazy_load/font), `details`, `rationale` | `page_path` omitted for font_strategy if fix is in layout.tsx |
| `site:redirect_add` | `fix_type='redirect'`, `details.source`, `details.destination`, `details.permanent`, `rationale` | Appends to `next.config.ts` redirects array |
| `site:schema_add` | `fix_type='schema'`, `page_path`, `details.schema_type`, `details.schema_data`, `rationale` | Injects JSON-LD Script into page file |

### Payload schema

```typescript
interface SitePerformancePayload {
  page_path?: string           // e.g. "/sell" or "/about-us".  omit for redirect or layout-level fixes
  fix_type: 'lazy_load' | 'image_optimize' | 'font_strategy' | 'redirect' | 'schema'
  details: Record<string, unknown>   // fix-specific data.  see §4 per fix type
  rationale: string            // why this fix improves Core Web Vitals, SEO, or UX
}

// Details per fix_type:
interface LazyLoadDetails {
  image_selectors: string[]    // component names or alt text that identify below-fold images
}

interface ImageOptimizeDetails {
  source_path: string          // path to PNG relative to /public, e.g. "/images/team.png"
  output_path: string          // desired WebP path, e.g. "/images/team.webp"
}

interface FontStrategyDetails {
  font_variable: string        // the next/font variable name in app/layout.tsx
  change: string               // e.g. "add display: 'swap'"
}

interface RedirectDetails {
  source: string               // source pattern, e.g. "/old-path/:slug*"
  destination: string          // destination, e.g. "/new-path/:slug*"
  permanent: boolean           // true = 308, false = 307
}

interface SchemaDetails {
  schema_type: string          // e.g. "RealEstateAgent", "FAQPage", "LocalBusiness"
  schema_data: Record<string, unknown>   // the full JSON-LD object
}
```

---

## 3. Full action row schema

```typescript
interface SitePerformanceActionRow {
  id: string
  action_type: 'site:perf_fix' | 'site:redirect_add' | 'site:schema_add'
  target: string               // e.g. 'page:/sell' or 'config:redirects'
  assigned_producer: string    // 'marketing_brain_skills/producers/site-performance'
  payload: SitePerformancePayload
  data_evidence: {
    audit_source?: string      // e.g. 'audit-website' (PageSpeed data)
    opportunity_area?: string  // e.g. 'LCP 4.2s on /sell; hero image not lazy'
    signal_evidence?: string   // e.g. 'GSC: 404 on /old-blog/:slug.  340 external links'
  }
  generation_reason: string
  status: 'pending'
}
```

---

## 4. The recipe

**Step 1.  Read the action row and claim it**

```sql
UPDATE marketing_brain_actions
SET status = 'in_production', executed_at = now()
WHERE id = '<id>' AND status = 'pending';
```

Confirm `status` was 'pending'. If not, stop and report.

**Step 2.  Load mandatory references**

- `CLAUDE.md` "Draft-First, Commit-Last".  PR is the draft; never push to main
- `CLAUDE.md` "Design System Rules.  MANDATORY".  do not break shadcn/ui compliance
  while applying fixes
- `next.config.ts`.  read the current config before editing redirects

Voice guidelines are NOT required for this producer (no copy changes). Skip the voice
validation step.

**Step 3.  Route to fix-specific procedure**

Dispatch based on `payload.fix_type`:

---

### Fix A: `lazy_load`

**Goal:** Reduce LCP and initial payload by deferring off-screen images.

1. Read `app/<page_path>/page.tsx`.
2. Identify `<Image>` components from `next/image` and `<img>` tags that are:
   - Below the visible fold (not the hero or the first 2 content blocks)
   - NOT already marked `priority` (Next.js `<Image priority>` = above the fold)
3. For each identified image, add `loading="lazy"` and `decoding="async"`.
   - For `<Image>` from `next/image`: the `loading` prop is valid; also confirm
     `priority` is NOT set (priority overrides lazy). Do not remove `priority` from
     hero images.  that would hurt LCP, not help it.
   - For bare `<img>` (uncommon but may exist): add both attributes.
4. Do NOT add `loading="lazy"` to the first image on the page or any image in the
   hero section. Lazy-loading above-fold images increases LCP.
5. Record how many images were modified.

---

### Fix B: `image_optimize`

**Goal:** Reduce image byte size by converting PNG to WebP.

1. Verify `payload.details.source_path` exists in `public/`:
   ```bash
   ls /Users/matthewryan/RyanRealty/public<source_path>
   ```
   If not found: set `status='killed'`; report to Matt.

2. Run conversion using the `sharp` CLI or Node script. `sharp` is a dependency in
   this repo:
   ```bash
   cd /Users/matthewryan/RyanRealty && node -e "
     const sharp = require('sharp');
     sharp('public<source_path>').webp({ quality: 85 }).toFile('public<output_path>').then(() => console.log('Done')).catch(e => { console.error(e); process.exit(1); });
   "
   ```
   
   If `sharp` is unavailable (not installed), fall back to `cwebp` if present:
   ```bash
   cwebp -q 85 public<source_path> -o public<output_path>
   ```
   
   If neither is available: set `status='killed'`; report to Matt.

3. Update the `src` reference in the page file from `source_path` to `output_path`.
   Use exact string replacement.

4. Do NOT delete the original PNG. Leave it in place; Matt or a future cleanup pass
   removes it after confirming the WebP renders correctly.

---

### Fix C: `font_strategy`

**Goal:** Eliminate render-blocking font load by setting `display: 'swap'`.

1. Read `app/layout.tsx`.
2. Locate the `next/font` import that matches `payload.details.font_variable`.
3. Add or update the `display` option per `payload.details.change`.
4. Verify the change does not break the `className` export from the font call.
5. Do NOT change `Geist` font configuration without reading the current call first. 
   Geist is the canonical body font per Design System v2; changing its weight set or
   subsets could break page typography.

---

### Fix D: `redirect` (action_type `site:redirect_add`)

**Goal:** Prevent 404s on known old URLs by adding a 301 (permanent) or 307
(temporary) redirect.

1. Read `next.config.ts` in full.
2. Locate the `redirects()` async function. It returns an array of redirect objects.
3. Append the new redirect object:
   ```typescript
   {
     source: '<details.source>',
     destination: '<details.destination>',
     permanent: <details.permanent>,  // true = 308, false = 307
   }
   ```
4. Rules for safe appending:
   - Add to the END of the array (last match wins in Next.js redirect order; putting
     catch-alls last is correct)
   - Do NOT reorder existing redirects
   - Do NOT use regex patterns (`has`, `missing`, `locale`) unless the action row
     explicitly specifies them
   - Do NOT add a redirect that conflicts with an existing route (`source` must not
     match any path in `app/` that renders a real page)
5. After editing, scan the file to confirm there are no duplicate source patterns.

---

### Fix E: `schema` (action_type `site:schema_add`)

**Goal:** Add JSON-LD structured data for richer search engine understanding.

1. Read `app/<page_path>/page.tsx`.
2. Add the import at the top of the file if not already present:
   ```typescript
   import Script from 'next/script'
   ```
3. Inject the `<Script>` block inside the page's `<main>` or top-level JSX element,
   immediately after the opening tag:
   ```typescript
   <Script
     id="schema-<schema_type_kebab>"
     type="application/ld+json"
     dangerouslySetInnerHTML={{
       __html: JSON.stringify(<details.schema_data>)
     }}
   />
   ```
4. The `<Script>` element uses `strategy="afterInteractive"` only if the schema is
   dynamic. For static JSON-LD (RealEstateAgent, LocalBusiness, FAQPage), do NOT add
   a `strategy` prop.  Next.js renders it in `<head>` by default when no strategy is
   set, which is correct for SEO.

   Correction to that: for `<Script>` components with `dangerouslySetInnerHTML`,
   Next.js always places them inline. Omit `strategy` for JSON-LD.

5. Validate the `schema_data` object has at minimum:
   - `"@context": "https://schema.org"`
   - `"@type": "<schema_type>"`
   - No fields containing unverified market figures unless traced per CLAUDE.md §0

---

**Step 4 (all fix types).  Run TypeScript type check**

```bash
cd /Users/matthewryan/RyanRealty && npx tsc --noEmit 2>&1
```

If TypeScript errors:
- Revert the change to the file
- Attempt to fix once (e.g., missing type import)
- If still failing: set `status='killed'`; surface tsc output to Matt

**Step 5.  Create branch and commit**

Branch: `site-perf/<action_id>` (first 8 chars of UUID)

```bash
git checkout -b site-perf/<action_id>
git add <files_changed>
git commit -m "site-perf(<fix_type>): <one-line summary>

Action row: <id>
Fix type: <fix_type>
Target: <page_path or 'next.config.ts'>
Rationale: <payload.rationale>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
git push origin site-perf/<action_id>
```

Files to stage depend on fix type:
- `lazy_load`: `app/<page_path>/page.tsx`
- `image_optimize`: `public<output_path>`, `app/<page_path>/page.tsx`
- `font_strategy`: `app/layout.tsx`
- `redirect`: `next.config.ts`
- `schema`: `app/<page_path>/page.tsx`

**Step 6.  Open GitHub PR**

```bash
gh pr create \
  --title "site-perf(<fix_type>): <one-line summary>" \
  --body "$(cat <<'EOF'
## Summary
- Fix type: `<fix_type>`
- Target: `<page_path or next.config.ts>`
- Action row: `<id>`

## Changes
<Concise description of what was changed and why>

## Expected impact
<Rationale from payload.rationale.  e.g. "Removes render-blocking hero image fetch on /sell; expect LCP improvement of ~0.8s per PageSpeed audit">

## Files changed
<list of files>

## TypeScript
`npx tsc --noEmit` returned zero errors.

## Approval gate
Matt merges this PR in GitHub. No additional action row approval needed.

🤖 Generated with Claude Code / marketing brain.  site-performance producer
EOF
)"
```

**Step 7.  Update action row to 'ready'**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = '{
      "branch_name": "site-perf/<action_id>",
      "pr_url": "<pr_url>",
      "files_changed": ["<file1>", "<file2>"],
      "fix_type": "<fix_type>",
      "tsc_clean": true
    }'::jsonb
WHERE id = '<id>';
```

**Step 8.  Surface to Matt**

```
Draft ready: site-performance.  <fix_type> on <target>

  PR
    URL: <pr_url>
    Branch: site-perf/<action_id>

  FIX
    Type: <fix_type>
    Target: <page_path or 'next.config.ts'>
    <one sentence on what changed>

  EXPECTED IMPACT
    <payload.rationale>

  VALIDATION
    TypeScript: PASS (zero errors)

Matt merges the PR in GitHub to ship.
```

Then stop. Wait for Matt to merge.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Read (file) | Read target page file, `next.config.ts`, `app/layout.tsx` before editing |.  |
| Edit (file) | Apply targeted string replacement or attribute addition |.  |
| Bash: `ls public/<path>` | Confirm image source path exists |.  |
| Bash: `node -e "require('sharp')..."` | PNG → WebP conversion | `sharp` in node_modules |
| Bash: `npx tsc --noEmit` | TypeScript compile check | runs in `/Users/matthewryan/RyanRealty` |
| Bash: `git checkout -b`, `git add`, `git commit`, `git push` | Branch, stage, commit, push |.  |
| Bash: `gh pr create` | Open GitHub PR | active `gh` session |
| Supabase MCP | Update `marketing_brain_actions` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## 6. Output format

**Draft lands at:** GitHub PR  
**Files produced (vary by fix_type):**
```
# lazy_load:
app/<page_path>/page.tsx             (loading attr added to below-fold images)

# image_optimize:
public<output_path>                  (new WebP file)
app/<page_path>/page.tsx             (src reference updated)

# font_strategy:
app/layout.tsx                       (font display option updated)

# redirect:
next.config.ts                       (redirect entry appended)

# schema:
app/<page_path>/page.tsx             (Script JSON-LD block injected)
```

---

## 7. Approval gate

| approval_type | what it means | who can grant |
|---|---|---|
| `matt-review-PR` | Matt merges the PR in GitHub | Matt only.  via GitHub UI |

Voice validation is not applicable here. No copy changes.

---

## 8. Status flow

```
pending           ← producer reads row here
  │
  ▼
in_production     ← set on pickup; executed_at=now()
  │
  ├── Source file / image not found → killed
  ├── TypeScript fail (after 1 fix attempt) → killed
  ├── Conflicting redirect source → killed
  │
  ▼ (branch + PR created)
ready             ← executor_response = {branch_name, pr_url, files_changed, fix_type}
  │
  ▼ (Matt merges PR)
approved
  │
  ▼ (Vercel build + deploy completes)
executed
  │
  ▼ (48-72h: audit-website or PageSpeed captures CWV delta)
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
    executor_response='{"branch_name":"...","pr_url":"...","files_changed":["..."],"fix_type":"..."}'::jsonb
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
| Image source not found | `ls public/<source_path>` returns no match | Set `status='killed'`; report exact path tried; ask Matt to confirm |
| `sharp` unavailable | Node error: Cannot find module 'sharp' | Try `cwebp` fallback; if both absent, set `status='killed'`; ask Matt to run `npm install sharp` |
| Duplicate redirect source | New source pattern already exists in `next.config.ts` | Set `status='killed'`; surface both entries to Matt and ask which should win |
| Redirect conflicts with live route | `source` matches an existing page in `app/` | Set `status='killed'`; explain the conflict; ask Matt to confirm the redirect is intentional (the page would become unreachable) |
| TypeScript error after lazy_load edit | Invalid `loading` prop type on custom Image wrapper | Revert; surface to Matt; `loading` may need to be passed differently in a custom component |
| JSON-LD schema has unverified figures | `schema_data` contains price or market stats without a Supabase trace | Remove the unverified fields from the schema object; add a note in the PR description explaining what was removed and why |
| `font_strategy` breaks font variable export | The `className` from a `next/font` call changes | Revert; surface to Matt with the before/after font config |

---

## 10. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` "Draft-First, Commit-Last".  PR = draft; never push to main
- `CLAUDE.md` "Design System Rules.  MANDATORY".  verify fixes do not break shadcn compliance
- `next.config.ts`.  always read in full before editing (redirect safe-append rule)

**Codebase patterns to match:**
- `next.config.ts` `redirects()` array.  read before appending; preserve all existing entries
- `app/layout.tsx`.  canonical `next/font` configuration; Geist is the body font
- Next.js `<Image>` component from `next/image`.  `priority` vs `loading="lazy"` are mutually exclusive

**Playbooks and pipeline docs:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section C, row `site-performance`
- `marketing_brain_skills/audit-website/SKILL.md`.  the brain component that surfaces perf issues and generates these action rows

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md`.  Section C, row `site-performance`

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

---

## Validator stub sections (canonical 11-section structure)

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

