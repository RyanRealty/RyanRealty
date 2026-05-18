# Reuse query patterns — Phase 7 deliverable

**Status:** Canonical
**Locked:** 2026-05-17
**Audience:** every producer SKILL.md that writes to or reads from the asset library.

This doc is the producer-facing quick reference for "before you render fresh, check the library." Full schema and storage location detail are in `asset-library-map.md`. Data model and JSONB payload shapes are in `phase-4.6-data-model-rationale.md`.

The §1.5 north-star objective is seller leads per month. Producers that re-render content the asset library already has a winner for waste both Anthropic tokens and Matt's review cycles. Always query first.

---

## 1. The "has this been featured?" check

Before any per-listing or per-neighborhood content render, ask the library if a recent variant already exists.

### Producer pattern

```typescript
import { search } from '@/lib/asset-library';

const recentForAddress = await search({
  tags: [`mls:${mls_id}`, `surface:${target_surface}`],
  since: '30 days ago',
  asset_type: 'video',
});

if (recentForAddress.length > 0) {
  const top = recentForAddress.sort((a, b) =>
    (b.performance_score ?? 0) - (a.performance_score ?? 0))[0];
  // Surface to Matt: "We already shipped <top.label> 12 days ago. Repurpose, or render fresh?"
}
```

### SQL equivalent

```sql
select id, uri, label, surface, performance_score, last_used_at, originated_from_action_id
from asset_library
where tags @> array[$1, $2]
  and asset_type = 'video'
  and last_used_at >= now() - interval '30 days'
order by performance_score desc nulls last
limit 5;
```

Parameters: `$1 = mls:<id>`, `$2 = surface:<ig_reel|fb_reel|yt_short|...>`.

---

## 2. The "what worked best on this surface for this content type?" check

Used by `repurpose_engine`, `clip_compilation`, and the brain's `generate-briefs` when deciding to dispatch a new variant or amplify an existing winner.

### Producer pattern

```typescript
import { search } from '@/lib/asset-library';
import { createClient } from '@supabase/supabase-js';

const candidates = await search({
  tags: [`type:${content_type}`, `surface:${target_surface}`],
  since: '90 days ago',
});

const supabase = createClient(/* ... */);
const ids = candidates.map((c) => c.id);
const { data: perfRows } = await supabase
  .from('content_performance')
  .select('asset_library_refs, metrics_7d, north_star_attributed_seller_leads')
  .overlaps('asset_library_refs', ids);

// Rank by 7d save rate, share rate, or attributed seller leads
const ranked = perfRows
  ?.map((row) => ({
    asset_id: row.asset_library_refs?.[0],
    save_rate: row.metrics_7d?.save_rate ?? 0,
    share_rate: row.metrics_7d?.share_rate ?? 0,
    seller_leads: row.north_star_attributed_seller_leads ?? 0,
  }))
  .sort((a, b) => b.seller_leads - a.seller_leads || b.save_rate - a.save_rate);
```

### SQL equivalent

```sql
with asset_pool as (
  select id from asset_library
  where tags @> array[$1, $2]
    and last_used_at >= now() - interval '90 days'
)
select
  ap.id as asset_id,
  cp.metrics_7d ->> 'save_rate' as save_rate,
  cp.metrics_7d ->> 'share_rate' as share_rate,
  cp.north_star_attributed_seller_leads as seller_leads,
  al.surface,
  al.label
from asset_pool ap
join content_performance cp on ap.id = any(cp.asset_library_refs)
join asset_library al on ap.id = al.id
order by seller_leads desc, save_rate desc nulls last
limit 10;
```

Parameters: `$1 = type:<under_contract_announcement|listing_reel|...>`, `$2 = surface:<...>`.

---

## 3. The "is there a reusable asset we can repurpose?" check

Used by `clip_compilation`, `repurpose_engine`, and any producer that supports a "best-of" variant.

### Producer pattern

```typescript
const reusable = await search({
  asset_type: 'video',
  surface: target_surface,
  performance_score_gte: 0.7,           // top-30% of historical performance
  not_used_since: '14 days ago',         // freshness gate to avoid same-feed dupe
  limit: 20,
});

// Composite for a year-in-review or best-of-neighborhood reel
const compilation = reusable.slice(0, 8);
```

### SQL equivalent

```sql
select id, uri, surface, performance_score, last_used_at, tags
from asset_library
where asset_type = 'video'
  and surface = $1
  and performance_score >= 0.7
  and (last_used_at is null or last_used_at < now() - interval '14 days')
order by performance_score desc
limit 20;
```

Parameters: `$1 = surface`.

---

## 4. The "top-performing IG Reel for under-contract posts in NE Bend in the last 90 days" check

The composite query Matt asked the brain to be able to answer at any time. Used by `instagram-carousel`, `under-contract-announcement`, `sold-deal-summary` to bias future drafts toward what works.

### Producer pattern

```typescript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(/* ... */);

const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

const { data: rows } = await supabase
  .from('content_performance')
  .select(`
    action_id,
    asset_library_refs,
    metrics_7d,
    north_star_attributed_seller_leads,
    marketing_brain_actions!inner (
      target,
      payload
    )
  `)
  .eq('platform', 'ig')
  .gte('posted_at', ninetyDaysAgo)
  .filter('marketing_brain_actions.payload->>area', 'eq', 'NE Bend')
  .filter('marketing_brain_actions.action_type', 'eq', 'content:under_contract_announcement')
  .order('north_star_attributed_seller_leads', { ascending: false })
  .limit(10);
```

### SQL equivalent

```sql
select
  cp.action_id,
  cp.asset_library_refs,
  cp.metrics_7d,
  cp.north_star_attributed_seller_leads,
  mba.target,
  mba.payload
from content_performance cp
join marketing_brain_actions mba on cp.action_id = mba.id
where cp.platform = 'ig'
  and cp.posted_at >= now() - interval '90 days'
  and mba.action_type = 'content:under_contract_announcement'
  and mba.payload ->> 'area' = 'NE Bend'
order by cp.north_star_attributed_seller_leads desc, (cp.metrics_7d ->> 'save_rate')::numeric desc nulls last
limit 10;
```

---

## 5. The "fingerprint check" (dedup before register)

When a producer renders a new asset, run the fingerprint check before registering. Two identical files registered under different `source_id` values pollute the library and skew the reuse counter.

### Producer pattern

```typescript
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { search, register } from '@/lib/asset-library';

const buf = await readFile(rendered_path);
const fp = createHash('sha256').update(buf).digest('hex');

const existing = await search({ fingerprint: fp });
if (existing.length > 0) {
  console.log(`Asset already registered: ${existing[0].id} (${existing[0].label}). Reusing.`);
  return existing[0];
}

await register({
  uri: rendered_path,
  fingerprint: fp,
  tags: [...],
  surface: 'ig_reel',
  asset_type: 'video',
  originated_from_action_id: action_id,
});
```

### SQL equivalent

```sql
select id, uri, label, last_used_at, tags
from asset_library
where fingerprint = $1
limit 1;
```

---

## 6. Mark-used after publish (the back-reference closure)

When the publish layer confirms a successful post, write the platform's `post_external_id` back into `content_performance` AND update the asset library's `last_used_at` so the freshness gate in pattern #3 stays accurate.

### Producer pattern

```typescript
import { markUsed } from '@/lib/asset-library';
import { createClient } from '@supabase/supabase-js';

await markUsed(asset_id);

const supabase = createClient(/* ... */);
await supabase.from('content_performance').upsert({
  action_id,
  platform,
  post_external_id,
  posted_at: new Date().toISOString(),
  asset_library_refs: [asset_id],
}, { onConflict: 'action_id,platform,post_external_id' });
```

### SQL equivalent

```sql
update asset_library set last_used_at = now() where id = $1;

insert into content_performance (action_id, platform, post_external_id, posted_at, asset_library_refs)
values ($2, $3, $4, now(), array[$1])
on conflict (action_id, platform, post_external_id)
do update set asset_library_refs = excluded.asset_library_refs, posted_at = excluded.posted_at;
```

This is the wiring that the brain needs to learn which asset drove which post drove which seller lead. Phase 8 Part A audit flagged "no action row write-back" as P1 — the publish route returns `externalPostId` but does not call this closure. Phase 8 Part B's performance-pull cron handlers will do the back-reference via the upsert pattern in their handler spec.

---

## 7. Brain-side query: "what's our content mix this week, by surface?"

Used by `generate-briefs` when applying the priority scoring function (see `brain-decision-logic.md`).

### SQL

```sql
select surface, asset_type, count(*) as n
from asset_library
where last_used_at >= now() - interval '7 days'
group by surface, asset_type
order by n desc;
```

Tells the brain whether IG Reels are over-indexed, whether the LinkedIn document carousel is being neglected, etc. Feeds the `channel_growth` factor in the priority score.

---

## Producer integration contract

Every producer SKILL.md §6 (Asset library wiring) MUST include:

1. The exact `tags` it writes when registering a new asset (e.g. `[mls:220189422, surface:ig_reel, type:listing_reel]`).
2. The reuse query pattern it runs BEFORE rendering fresh (one of patterns 1, 2, or 3 above; or document why none apply).
3. The fingerprint dedup pattern (pattern 5).
4. The mark-used pattern (pattern 6).

The Phase 7.5 validator script checks for these patterns by string match in §6 of every producer SKILL.md. Producers that skip the reuse check fail validation.

---

## Gap surfaced: list-kit and v5_library assets not yet registered

Phase 2.5 (asset-library-map.md) identified that list-kit assets in `public/list-kits/<address>/v3/` and rendered videos in `listing_video_v4/public/v5_library/` are not registered in the asset library. The repurpose engine is therefore blind to both.

Phase 7 follow-up (not part of this build cycle, surface to Matt as a next-cycle task):
1. Run a one-time backfill script that walks both directories, computes fingerprints, and registers each as `source=render-output` with synthetic tags inferred from the directory structure (address from path, surface from filename).
2. Update the Python generators (`scripts/build_list_kit_*.py`) to register every new render at write time.
3. Update Remotion render scripts in `listing_video_v4/` to call `register()` after every successful `out/` render that survives QA.

These three changes close the library-blindness gap and unlock pattern 3 ("is there a reusable asset?") for all listing-tour-video, listing_reveal, and list-kit producers.

---

## Related references

- `marketing_brain_skills/research/asset-library-map.md` — full schema + storage detail
- `marketing_brain_skills/research/phase-4.6-data-model-rationale.md` — content_performance + asset_library schema upgrades
- `video_production_skills/asset-library/SKILL.md` — capability spec
- `lib/asset-library.mjs` — TypeScript helper export surface
- `automation_skills/automation/repurpose_engine/SKILL.md` — the biggest consumer of these patterns
- `automation_skills/automation/performance_loop/SKILL.md` — feeds performance scores back to `performance_score` field
