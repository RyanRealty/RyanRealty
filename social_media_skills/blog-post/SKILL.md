---
name: blog-post
description: Generate and publish SEO-optimized long-form blog posts on the Ryan Realty Next site via Supabase public.blog_posts (rendered at /blog and /blog/[slug]). Full schema markup on the Next page, internal cross-links, image alt text, and the blog_posts upsert path. Use this skill whenever the user requests a blog post, says "write a blog post for [topic]", "publish to the blog", "draft a blog post about [city/neighborhood/listing]", "post this to ryan-realty.com", or asks for written long-form content destined for the website. Do NOT use this skill for social-media captions, email newsletters, or video-script copy. AgentFire WordPress is retired. The live blog is the Next app.
output_type: text
target_platforms: ["email"]
asset_destination: public.blog_posts (status draft then published) + out/proof/<date>/<slug>/
auto_inputs: ["brand voice rules", "market data from Supabase"]
required_inputs: ["topic OR mls_id"]
optional_inputs: ["tone_override", "length_override"]
estimated_runtime_min: 8
cost_usd_estimate: $0.10-$0.50 per piece (Anthropic tokens for drafting + voice check)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.html
example_outputs: []
    label: "past approved drafts"
    surface: "email"
action_types:
  - content:blog_post
  - content:seo_blog
---

# Blog Post Skill.  Ryan Realty (Next site, Supabase blog_posts)

## Required references.  load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)**.  visual brand spec. Colors (navy `#102742`, cream `#faf8f4`), type (Amboqia Boriango display, Geist sans body/UI), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../platform-best-practices/SKILL.md)**.  2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions).

A piece of content that ships without consulting BOTH of these is non-compliant.

---

**Scope:** Generate SEO-optimized long-form blog posts and publish them to `public.blog_posts`. The live Next site renders them at `/blog` and `/blog/[slug]` via `lib/data/blog/*` (`getBlogPostBySlug`, `getPublishedBlogPosts`). Do not publish through WordPress REST. AgentFire WordPress is retired.

**Status:** Canonical 2026-09-05. Publishing path is Supabase `blog_posts` on the Next site.

---

## 1. When to use / when not to use

**Use this skill for:**
- Monthly market report blog post
- Neighborhood guide blog posts
- Listing spotlight blog posts
- Real estate news / market commentary blog posts
- Buyer's guides, seller's guides, evergreen content
- Anything destined for `ryan-realty.com/blog/{slug}` as a published article

**Do NOT use for:**
- Instagram / TikTok / FB Reels captions (use `automation_skills/automation/publish/SKILL.md` after Studio)
- Email newsletters (TypeScript newsletter product)
- Video script (Studio, CLAUDE.md §4 / `lib/studio/`)
- Internal docs, runbooks, or non-customer-facing content
- AgentFire WordPress / WP REST (`/wp-json/wp/v2/posts`). That destination is dead.

---

## 2. The publish destination is Supabase blog_posts on the Next site

**ONE blog destination:** `public.blog_posts` rendered by the Next app at `https://ryan-realty.com/blog/{slug}`.

**NOT** AgentFire WordPress. **NOT** `POST /wp-json/wp/v2/posts`. **NOT** `WP_AGENTFIRE_*` env vars. The WordPress cutover already shipped; leftover WP REST recipes are fossils.

**Read path (DAL, required):**
- `lib/data/blog/getBlogPostBySlug.ts` (public page, `status='published'`)
- `lib/data/blog/getPublishedBlogPosts.ts` (index)
- `lib/data/blog/getRelatedBlogPosts.ts`
- `lib/data/blog/getRecentBlogPosts.ts`

**Write path:** service-role upsert on `public.blog_posts` (same shape as `scripts/seed-blog-posts.ts`). Columns: `title`, `slug`, `content`, `excerpt`, `category`, `tags`, `hero_image_url`, `seo_title`, `seo_description`, `status` (`draft` | `published`), `published_at`, `author_broker_id`.

**Live URL after publish:**
```
https://ryan-realty.com/blog/{slug}
```

Drafts stay `status='draft'` and are not selected by `getBlogPostBySlug`. Do not flip to `published` until Matt's §1 stamp.

If you need a bulk seed pattern, follow `scripts/seed-blog-posts.ts` (upsert on `slug`). Do not invent a WordPress client.

---

## 3. SEO spec.  every blog post must hit all of these

### 3.1 Title tag
- **Length:** ≤60 characters
- **Front-loaded keyword:** start with the primary target keyword (e.g. "Bend Oregon Real Estate")
- **Brand suffix:** end with " | Ryan Realty"
- **Pattern:** `{Primary Keyword} {Period or Modifier} | Ryan Realty`
- **Example:** "Bend Oregon Real Estate Market Report.  April 2026 | Ryan Realty"
- Store in `seo_title` (and `title` if they match)

### 3.2 Meta description
- **Length:** 150-160 characters (truncated above 160)
- **Lede with the headline stat + period:** "Bend's median home price hit $699K in April 2026, down 13.4% from last year. See the full market breakdown..."
- Store in `seo_description`

### 3.3 URL slug (canonical)
- **Pattern:** `/blog/{slug}` only. The Next route is `app/blog/[slug]/page.tsx`.
- **Slug rules:** lowercase, hyphens only, no stop words ("a", "the", "of"), no numbers unless meaningful (year/month OK)
- Do not invent `/market-report/{city}/{YYYY-MM}` WordPress permalinks. A market-report post is still `/blog/{slug}`.

### 3.4 Open Graph + Twitter Card
The Next page builds metadata from `seo_title`, `seo_description`, and `hero_image_url`. Provide those columns. Do not POST to WP media.

### 3.5 Structured data
The Next page emits Article JSON-LD via `generateBlogSchema` in `lib/structured-data.ts`. Do not hand-author WordPress JSON-LD blocks into post HTML. Do not cite `wp-content/uploads` logo paths.

### 3.6 Heading hierarchy
- **One H1 only** (the page title. the Next page wraps `title` in H1; do NOT add another H1 in `content`).
- **H2 = each major section** (e.g. "Median Sale Price", "Months of Supply", "Days on Market", "Top Neighborhoods").
- **H3 = sub-sections within an H2**.
- Don't skip levels (no H4 inside H2 without an H3 between).

### 3.7 Internal links
- Link to **prior posts** on `/blog/{slug}`.
- Link to **place pages** that exist on the Next site (`/cities/...`, `/communities/...`, neighborhood routes).
- Link to **listing search** (`/homes-for-sale/...` or `/search/...` as the live nav uses).
- Aim for 3-5 internal links per 1,000 words. Anchor text is descriptive, not "click here."

### 3.8 External links
- Cite primary data sources: Census Bureau, NAHB, ORMLS, Spark API, FRED, Case-Shiller. Open in new tab (`target="_blank" rel="noopener nofollow"`).
- Do NOT link to competitor brokerages or aggregator portals (Zillow, Realtor.com, Redfin) unless absolutely necessary for context.

### 3.9 Image alt text
- **Every image** in `content` must have descriptive alt text.
- **Pattern for charts:** `"{Stat name} chart for {city} {period}.  {key value}"`
- **Pattern for photos:** `"{Subject}.  {location context}"`
- **Never:** "image1.jpg", "untitled", "photo of [thing]" without context.

### 3.10 Embedded video
If the post embeds a companion video, that video is a Studio draft (`CLAUDE.md` §4 / `lib/studio/`), not a Remotion render and not a `video_production_skills/**` producer. Use a standard iframe or hosted URL in `content`. Do not use WordPress oEmbed.

### 3.11 Word count
- **Market report:** 800-1,500 words
- **Neighborhood guide:** 1,000-2,000 words
- **Listing spotlight:** 400-800 words
- **Evergreen guide:** 1,500-3,000 words
- **Below the floor:** halt and add depth.
- **Above the ceiling:** split into multiple posts.

### 3.12 Tone + voice
- Authoritative but accessible. Matt is a licensed principal broker.
- Numbers carry units always: "$699,000" not "$699,000.00", "46 days" not "46d", "98.5%" not ".985".
- `marketing_brain_skills/brand-voice/VOICE.md` is the only voice source.

---

## 4. Generation flow

1. **Pull verified data.** Cache row + DAL. CLAUDE.md §0. Generate `citations.json` next to the draft. Every figure traces.
2. **Outline first.** H1 title, H2 sections, H3 subsections. The data dictates section order.
3. **Draft body HTML** into `content`. Hero still goes in `hero_image_url`, not a WP featured-image id.
4. **SEO checklist.** title length ≤60, meta description 150-160, internal links 3-5, alt text on every image, slug correct, banned words removed.
5. **Upsert `public.blog_posts` as `status='draft'`.** Do not set `published`.
6. **Surface the draft to Matt** (row id, slug, excerpt, citations.json). There is no WordPress preview URL.
7. **On Matt's "go"** (explicit, this session): set `status='published'`, `published_at=now()`. Live URL is `/blog/{slug}`.
8. Sitemap picks up published rows from `app/sitemap.ts`. Do not ping a Yoast sitemap.

Companion video, if any, is Studio then publisher-sweep. This skill does not render video.

---

## 5. Featured image

Set `hero_image_url` to a public HTTPS URL (asset library or a tracked `public/` still). Do not `POST /wp-json/wp/v2/media`. Do not store a WordPress media id.

Default still source: `data/asset-library/manifest.json` via `lib/asset-library.mjs`, or a Studio still. Not `video_production_skills/media-sourcing`.

---

## 6. Categories + tags

These are columns on `blog_posts`, not WordPress taxonomies.

**Known category strings already in seed content (reuse; do not invent WP slugs):**
- Market Updates
- Market Analysis
- Buying Guides
- First-Time Buyers
- Home Improvement
- Lifestyle & Living

**Tag patterns (text[]):**
- City: `bend`, `redmond`, `sisters`, `la-pine`, `prineville`, `sunriver`
- Year: `2026`, `2025`
- Type: `monthly-report`, `quarterly-report`, `ytd-report`
- Topic: `median-price`, `inventory`, `mortgage-rates`

Each post gets 1 `category` + 3-8 `tags`.

---

## 7. Pre-publish QA checklist

Before flipping draft → published:

- [ ] Title ≤60 chars (`seo_title`)
- [ ] Meta description 150-160 chars (`seo_description`)
- [ ] Slug is `/blog/{slug}` and unique
- [ ] `hero_image_url` set
- [ ] H1 not duplicated in `content`
- [ ] 3-5 internal links present
- [ ] All images have descriptive alt text
- [ ] Word count in target range (§3.11)
- [ ] Banned-word grep returns zero hits
- [ ] All numbers carry units
- [ ] Verification trace covers every figure on the page
- [ ] No WordPress REST call was made

If ANY fail, halt before publishing.

---

## 8. Broker headshots (author bylines)

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.png`.  Matt Ryan (owner / principal broker)
- `paul-stevenson.png`.  Paul Stevenson
- `rebecca-peterson.png`.  Rebecca Peterson

Set `author_broker_id` to the matching `brokers.id`. The Next page joins `display_name`, `slug`, `photo_url`. Do not upload a headshot to a WP Media Library.

For brokerage-brand posts (monthly market reports, neighborhood guides), author may be the brokerage default. For a listing spotlight attributed to a broker, set that broker's id.

---

## 9. See also

- `CLAUDE.md` §4. Studio (`lib/studio/`, `/admin/studio`) for any companion video
- `CLAUDE.md` §5. Inbox files a row, runs no producer
- `automation_skills/automation/publish/SKILL.md`. publisher-sweep → `/api/social/publish`
- `lib/data/blog/getBlogPostBySlug.ts`. public read path
- `scripts/seed-blog-posts.ts`. upsert-on-slug pattern
- `social_media_skills/facebook-lead-gen-ad/SKILL.md`. paired ad sub-skill

Do not load `video_production_skills/**`. Do not load AgentFire handoff docs as the live destination.

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/VOICE.md`

---

## Validator stub sections (canonical 11-section structure)

## 10. Mandatory references

See the Mandatory references block above for the required citations.

## 11. Tool gap suggestions

Tool gap suggestions: none that restore WordPress REST or `video_production_skills/**`.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
