# Pulse Feed Integration — producer publishing rule

**Locked 2026-05-20.** Every brain producer whose output is meant to
surface in the `/pulse` feed must write its draft path to a column the
feed can query. Without this rule, producers fan out to whatever
storage makes sense for their format (MP4 in `public/v5_library/`,
HTML in `out/`, JSON in `marketing_brain_actions.executor_response`)
and the pulse feed never finds the output. The rule below tells every
producer the exact column to write to so the feed can read it.

## Card type → source column matrix (canonical)

| Card type | Source table | Source column | Producer responsibility |
|---|---|---|---|
| **Listing tile** | `public.listings` | `details.Videos[]` (jsonb path) | `listing_reveal`, `listing-tour-video` write the rendered tour URL or iframe HTML to `details.Videos[]` on the listing row. |
| **Lifestyle / blog tile** | `public.blog_posts` | row with `status='published'` | Blog producers (`generate-briefs`, `seo-blog-post`) write the post with `status='published'`, `hero_image_url` populated, `category` populated. |
| **Market report video** | `marketing_brain_actions` | `executor_response.draft_path` for `action_type='content:market_data_video'` and `status='executed'` | Producer writes the MP4 to `public/v5_library/<slug>.mp4` AND records the public URL in `executor_response.draft_path`. |
| **Market snapshot** | `public.market_pulse_live` | live query, geo_type/geo_slug/property_type | No producer responsibility — the cache writer handles this. Pulse just reads. |
| **Brand utility** | brand-owned config | static spec in `lib/pulse-brand-cards.ts` | Not brain-produced. Brand spec is updated by hand. |
| **News tile** | `marketing_brain_actions` | `executor_response.draft_path` for `action_type='content:news_video'` and `status='executed'` | Same pattern as market report. |
| **Neighborhood guide tile** | `marketing_brain_actions` | `executor_response.draft_path` for `action_type='content:neighborhood_overview'` and `status='executed'` | Same pattern. |
| **Sold-deal summary tile** | `marketing_brain_actions` | `executor_response.draft_path` for `action_type='content:sold_deal_summary'` and `status='executed'` | Producer writes the rendered card to `executor_response.draft_path`. |

## The producer's job — three things

1. **Specify the target column** in Section 6 "Output format" of the
   producer's SKILL.md. Use the matrix above. If publishing to a new
   action_type, add a matrix row to this file FIRST, then update the
   producer.

2. **Write the row when the action transitions to `executed`.** Not
   `ready`, not `approved` — `executed`. The pulse feed reads
   `status IN ('executed', 'measured')`. Producers that write to
   `ready` never show up in the feed.

3. **Respect the safe zones.** Read
   `video_production_skills/pulse-feed-safe-zone/SKILL.md` before
   rendering. Any text overlay on a 1080×1920 frame must sit inside
   the safe rectangle (15% top, 14% bottom, 5.5% sides, 14% right
   column for the producer-grade rect).

## What pulse reads (the consumer side)

`lib/pulse-brain-content.ts` (production) and inline JS in
`/pulse-demo.html` (demo) query these sources every page render:

```
1. activity_events + listings.details.Videos[]
   → listing cards (sorted by event_time desc)

2. marketing_brain_actions WHERE status IN ('executed','measured')
   AND action_type IN ('content:market_data_video',
                       'content:news_video',
                       'content:neighborhood_overview',
                       'content:sold_deal_summary')
   → video/visual cards (sorted by executed_at desc)

3. blog_posts WHERE status='published'
   → lifestyle cards (sorted by published_at desc)

4. market_pulse_live WHERE geo_type='city', geo_slug=<viewer city>
   → market snapshot card (one per page)

5. lib/pulse-brand-cards.ts → brand utility cards (static)
```

The interleave order lives in `app/actions/pulse-feed.ts` (production)
and `buildFeed()` in `/pulse-demo.html` (demo).

## What's forbidden

- Writing to `executor_response.draft_path` without setting
  `status='executed'`. Pulse will never find it.
- Writing to a column not in the matrix above. Add a matrix row first.
- Hard-coding a URL into pulse feed code. Every card resolves from a
  query above.
- Shipping a frame that fails the safe rect. The visual contract is
  binding even when the column routing is right.

## Producer SKILL.md template additions

Every pulse-eligible producer adds these to its SKILL.md:

```
## 2. Action types handled
- Link to this file in the producer's "Required references" list.

## 6. Output format
- Name the table and column.
- Show the exact write the producer performs.

## 7. Approval gate
- Confirm status transitions to 'executed' only after Matt approval.

## 10. Related skills and references
- marketing_brain_skills/pulse-feed-integration/SKILL.md  ← this file
- video_production_skills/pulse-feed-safe-zone/SKILL.md
```

## Verification — how to confirm a producer is wired

1. Run the producer end-to-end on a real action row.
2. Confirm `status='executed'` after Matt approves.
3. Query the source column directly — the draft path must be present
   and resolvable.
4. Load `/pulse-demo.html` (or production `/pulse`) and confirm the
   card appears in the feed within one reload.
5. If not, check the query in `lib/pulse-brain-content.ts` — the
   producer's column may not be in the SELECT.

## Cross-references

- `marketing_brain_skills/producers/REGISTRY.md` — every producer.
- `marketing_brain_skills/producers/TEMPLATE.md` — the producer SKILL
  template that requires this file in Tier 6.
- `video_production_skills/pulse-feed-safe-zone/SKILL.md` — visual
  safe-rect spec every video-producing producer must clear.
- `app/actions/pulse-feed.ts` — server query layer (production).
- `lib/pulse-brain-content.ts` — helper joining
  `marketing_brain_actions` to `blog_posts`.
