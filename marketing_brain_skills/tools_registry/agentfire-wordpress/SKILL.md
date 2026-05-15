---
name: tools_registry-agentfire-wordpress
description: Use this skill when a task involves "WordPress REST API", "AgentFire blog", "ryan-realty.com blog", "publish blog post", "wp-json", "WordPress Application Password", "AGENTFIRE_WP_USER", "AGENTFIRE_WP_APP_PASSWORD", "featured_media", "blog-post producer", "POST /wp/v2/posts", or any task that creates, updates, or queries blog posts on the Ryan Realty WordPress installation hosted by AgentFire at ryan-realty.com.
---

# AgentFire WordPress Tool Skill

## Canonical references

This is a tool skill used by any producer that publishes to the Ryan Realty blog. Every task that invokes this skill also loads:

- `CLAUDE.md` §0 — Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last
- `social_media_skills/blog-post/SKILL.md` — the blog-post producer that calls this tool
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement before any content is posted

---

## Scope

AgentFire hosts the Ryan Realty website and blog on a managed WordPress backend. This skill covers the WordPress REST API at `https://ryan-realty.com/wp-json/wp/v2/` for blog post publishing only.

**This is NOT the same infrastructure as the Next.js consumer app.**

| Surface | Infrastructure | This skill? |
|---|---|---|
| `ryan-realty.com` blog | AgentFire-managed WordPress | YES |
| `ryanrealty.vercel.app` / Next.js app | Vercel / Next.js (separate repo) | NO — site edits go through the `site-edit` producer via a Next.js PR flow |

**Use this skill for:**

| Use case | Why this tool |
|---|---|
| Publishing a new blog post | `POST /wp-json/wp/v2/posts` |
| Updating or correcting an existing post | `PUT /wp-json/wp/v2/posts/:id` |
| Uploading a featured image before creating a post | `POST /wp-json/wp/v2/media` |
| Looking up category or tag IDs for a post | `GET /wp-json/wp/v2/categories`, `/tags` |
| Reading recent posts to avoid duplicate topics | `GET /wp-json/wp/v2/posts?status=publish&per_page=10&_embed` |

**Do NOT use this skill for:**

| Task | Use instead |
|---|---|
| Editing the homepage, search page, or any non-blog page on ryan-realty.com | `site-edit` producer → Next.js PR flow on ryanrealty.vercel.app |
| Touching AgentFire-managed IDX custom post types (`listings`, `agents`) | Do not touch these via REST — they are synced from MLS data by AgentFire's system |
| Competitor WordPress intelligence | `apify` tool skill |
| Consumer-facing UI changes | Vercel / Next.js PR |

**The blog and the app are separate surfaces.** Never confuse the two.

---

## Authentication

### Env vars

| Variable | Purpose | Where stored |
|---|---|---|
| `AGENTFIRE_WP_USER` | WordPress username (the API service account) | `.env.local`, Vercel env |
| `AGENTFIRE_WP_APP_PASSWORD` | WordPress Application Password for that user | `.env.local`, Vercel env |

### What a WordPress Application Password is

WordPress Application Passwords are NOT the same as the user's login password. They must be generated separately:

1. Log in to the WordPress admin at `https://ryan-realty.com/wp-admin`
2. Go to Users → Profile → Application Passwords
3. Enter a name (e.g., "brain-api") and click "Add New Application Password"
4. Copy the generated string immediately — it is shown only once
5. Store as `AGENTFIRE_WP_APP_PASSWORD` in `.env.local` and in Vercel env

Application passwords use HTTP Basic auth. The Authorization header must be:

```ts
const credentials = Buffer.from(
  `${process.env.AGENTFIRE_WP_USER}:${process.env.AGENTFIRE_WP_APP_PASSWORD}`
).toString('base64')
const headers = {
  Authorization: `Basic ${credentials}`,
  'Content-Type': 'application/json',
}
```

WordPress strips all spaces from application passwords on copy — use the password exactly as generated; do not add or remove characters.

### Least-privilege principle

The API service account should carry the **Editor** or **Author** WordPress role — not Administrator. This limits blast radius if the credential is ever compromised. The role must include the `publish_posts` capability; Author role carries it by default.

---

## CRITICAL GOTCHA — AgentFire custom post types

AgentFire's WordPress installation includes custom post types (`listings`, `agents`) that are synchronized from MLS data by AgentFire's own IDX integration layer.

**NEVER write to or update those custom post types via the REST API.** Doing so can corrupt AgentFire's sync and produce ghost listings on the public site. The standard `posts` type is the only endpoint this skill touches.

If a blog post needs to reference a listing (e.g., a "just listed" post), embed the listing URL in the HTML content as a link (`/listings/123-main-st`) — do not create a custom post type relationship via the API.

---

## Endpoint patterns

Base URL: `https://ryan-realty.com/wp-json/wp/v2`

### `GET /wp-json/wp/v2/posts` — read recent published posts

Use before creating a new post to check for duplicate topics.

```ts
const resp = await fetch(
  'https://ryan-realty.com/wp-json/wp/v2/posts?status=publish&per_page=10&_embed',
  { headers }
)
const posts = await resp.json()
// posts[].title.rendered, posts[].slug, posts[].date, posts[].link
```

`_embed` expands the `_links` object so featured image URLs and author names are available inline without a second request.

---

### `GET /wp-json/wp/v2/categories` and `/tags` — resolve taxonomy IDs

WordPress requires category and tag IDs (integers), not name strings, in the post body. Look them up before posting.

```ts
const cats = await fetch(
  'https://ryan-realty.com/wp-json/wp/v2/categories?per_page=100',
  { headers }
).then(r => r.json())
// cats[].id, cats[].name, cats[].slug
```

Cache category/tag IDs for the session — they are stable within a WordPress install. Do not re-fetch on every post.

---

### `POST /wp-json/wp/v2/media` — upload featured image

Featured images must be uploaded before creating a post. The returned `id` becomes `featured_media` in the post body.

```ts
const imageBuffer = fs.readFileSync('/path/to/image.jpg')
const mediaResp = await fetch('https://ryan-realty.com/wp-json/wp/v2/media', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Disposition': 'attachment; filename="bend-market-may-2026.jpg"',
    'Content-Type': 'image/jpeg',
  },
  body: imageBuffer,
})
const media = await mediaResp.json()
// media.id — pass as featured_media in POST /posts
```

If the media upload fails (500), the post creation must NOT proceed. Do not reference a `featured_media` ID that was never successfully uploaded.

---

### `POST /wp-json/wp/v2/posts` — create a new post

```typescript
interface WordPressPostBody {
  title: string             // Post title — sentence case per brand voice
  content: string           // HTML body; NOT markdown — convert before posting
  excerpt: string           // SEO meta description fallback (155 chars max)
  slug: string              // URL-safe slug; must be unique; provide for SEO control
  status: 'draft' | 'publish' | 'future'
  date?: string             // ISO 8601 (e.g. '2026-05-20T09:00:00') — required when status='future'
  categories: number[]      // Category IDs from GET /categories
  tags: number[]            // Tag IDs from GET /tags
  featured_media: number    // Media ID from POST /media
  meta?: Record<string, unknown>  // SEO plugin custom fields (Yoast or RankMath)
}
```

```ts
const postBody: WordPressPostBody = {
  title: 'Bend Real Estate: April 2026 Market Update',
  content: htmlContent,         // converted from markdown
  excerpt: 'Median price held at $625K ...',
  slug: 'bend-real-estate-april-2026-market-update',
  status: 'draft',              // always draft first; flip to 'publish' after Matt approves
  categories: [12],             // Market Updates category ID
  tags: [34, 41],
  featured_media: 887,
}

const postResp = await fetch('https://ryan-realty.com/wp-json/wp/v2/posts', {
  method: 'POST',
  headers,
  body: JSON.stringify(postBody),
})
const post = await postResp.json()
// post.id, post.link, post.status
```

**Always create posts as `status: 'draft'` first.** Matt reviews; approval triggers the status update to `'publish'` or `'future'`.

---

### `PUT /wp-json/wp/v2/posts/:id` — update existing post (publish after approval)

```ts
await fetch(`https://ryan-realty.com/wp-json/wp/v2/posts/${postId}`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({ status: 'publish' }),  // or 'future' + date
})
```

Use this after Matt explicitly approves a draft. Only include the fields that changed — WordPress merges partial updates.

---

## Markdown-to-HTML conversion

The blog-post producer's briefs and outputs default to markdown. WordPress `content` requires HTML. Convert before posting.

```ts
import { marked } from 'marked'  // or remark-html

const htmlContent = marked.parse(markdownContent)  // string → string
```

Verify the conversion preserves:
- Heading hierarchy (`<h2>`, `<h3>` — never `<h1>` inside content; the title is already `<h1>` in the WordPress theme)
- All links (especially source citations the brand voice requires)
- Any `<blockquote>` pull quotes
- Code blocks if present

After conversion, grep the HTML for any markdown artifacts (e.g., literal `**bold**` that did not render) before posting.

---

## SEO plugin meta fields

If Yoast SEO or RankMath is active (confirm at `GET /wp-json/wp/v2/posts?per_page=1` and check the `meta` object on the response), populate the relevant meta fields in the post body:

**Yoast:**

```ts
meta: {
  _yoast_wpseo_title: 'Bend Real Estate April 2026 | Ryan Realty',
  _yoast_wpseo_metadesc: 'Median price held at $625K in April 2026 ...',
  _yoast_wpseo_focuskw: 'bend real estate market 2026',
}
```

**RankMath:**

```ts
meta: {
  rank_math_title: 'Bend Real Estate April 2026 | Ryan Realty',
  rank_math_description: 'Median price held at $625K in April 2026 ...',
  rank_math_focus_keyword: 'bend real estate market 2026',
}
```

If neither plugin appears in the meta object, omit the `meta` key — sending unknown meta keys is harmless but clutters the DB.

---

## Post lifecycle — aligned to brain approval gate

```
blog-post producer generates content
        │
        ▼
POST /wp-json/wp/v2/posts  { status: 'draft' }
        │ draft created
        ▼
brain row → status: 'ready'
executor_response = { draft_id, draft_link, scorecard }
        │ Matt sees draft at draft_link
        ▼
Matt: "ship it" (explicit)
        │
        ▼
PUT /wp-json/wp/v2/posts/:id  { status: 'publish' | 'future' }
        │
        ▼
brain row → status: 'executed'
        │ 48h post-publish
        ▼
brain row → status: 'measured'  (GA4 sessions + GSC impressions)
```

The WordPress draft URL format is `https://ryan-realty.com/?p={id}&preview=true`. Surface this in `executor_response.draft_link` so Matt can read the post in context before approving.

---

## Cache invalidation

AgentFire caches WordPress output aggressively at the hosting/CDN layer. After a post is published:

- New posts may take **5–15 minutes** to appear at their permalink on the public site
- The REST API response reflects the published state immediately (no cache there)
- Sitemap updates may lag up to 30 minutes (affects GSC indexing timeline)

Do not report "post not live" within the first 15 minutes as a failure. Check the permalink directly after that window.

---

## Cost

AgentFire hosting is a **fixed monthly subscription**. WordPress REST API usage carries no per-call cost at any volume. No rate limits have been documented for own-account REST API calls on a managed host at Ryan Realty's traffic level.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| 401 Unauthorized | `{"code":"rest_forbidden","message":"Sorry, you are not allowed to do this."}` | Application password is wrong, revoked, or the credential in `.env.local` is stale. Regenerate at WP admin → Users → Profile → Application Passwords. |
| 403 Forbidden | Same error code; user role lacks capability | The API service account's WordPress role does not include `publish_posts`. Promote to Editor or ensure custom role includes the capability. |
| 400 Bad Request on `slug` | `{"code":"rest_invalid_param","message":"Invalid parameter(s): slug"}` | Slug already exists on another post. Append a date suffix (e.g., `-may-2026`) and retry. WordPress will also auto-generate a slug if `slug` is omitted, but providing one is preferred for SEO. |
| 500 on `featured_media` | Post creation fails or `featured_media` is `0` | The media upload failed silently. Check that the image buffer is non-empty and the `Content-Disposition` filename matches the `Content-Type`. Upload must succeed before the post body references the ID. |
| Markdown not converted | Post content shows raw `**bold**`, `##`, `- item` in the published HTML | The caller skipped the markdown-to-HTML conversion step. Always run `marked.parse()` before setting `content`. |
| Custom post type conflict | 404 or `invalid_post_type` when trying to list or edit `listings` / `agents` | This skill only touches the `posts` type. Any attempt to write to AgentFire-managed post types is out of scope and should be aborted. |
| Draft visible in preview, not on site | Post exists but permalink returns 404 | Status is still `'draft'`. Only `'publish'` (or `'future'` past its `date`) makes a post public. |
| 5–15 min cache lag | Permalink returns old or empty content right after publish | AgentFire CDN cache — normal. Wait 15 minutes and recheck. |
| Application password not generated | `AGENTFIRE_WP_APP_PASSWORD` not in `.env.local` | Must be generated by a WordPress admin at WP admin → Users → Profile → Application Passwords. Cannot be scripted; requires human access to the WP admin. |

---

## Pre-flight checklist (before any POST to /wp/v2/posts)

```
[ ] AGENTFIRE_WP_USER and AGENTFIRE_WP_APP_PASSWORD confirmed in .env.local
[ ] Content is HTML, not markdown — marked.parse() has been called
[ ] Slug is unique — confirmed via GET /posts?slug={slug} returning empty array
[ ] Category and tag IDs resolved from GET /categories and /tags
[ ] Featured image uploaded via POST /media and media.id stored
[ ] SEO meta fields populated (Yoast or RankMath keys, whichever is active)
[ ] status is 'draft' — never 'publish' before Matt explicitly approves
[ ] Post created with status 'draft'; draft_link surfaced to Matt
[ ] Wait for explicit approval before PUT to flip status to 'publish'
[ ] All statistics in the post body trace to citations.json per Data Accuracy mandate
[ ] No banned vocabulary (CLAUDE.md §"Banned words") in title, excerpt, or content
```

---

## Used by

| Consumer | How |
|---|---|
| `social_media_skills/blog-post/` producer | Primary caller — every `content:blog_post` action dispatched by the brain routes through this tool |
| `marketing-brain:generate-briefs` | Emits `content:blog_post` action rows that the blog-post producer executes via this tool |
| `site-edit` producer | Limited read-only use (GET posts to cross-reference topics) — site edits themselves do NOT use this tool |

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `social_media_skills/blog-post/SKILL.md` | The blog-post producer — step-by-step recipe, topic selection, SEO keyword targeting, voice enforcement |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocabulary, sentence structure, and tone rules that apply to every post before it is created |
| `marketing_brain_skills/tools_registry/gsc/SKILL.md` | Google Search Console — used post-publish to verify indexing and track impressions on blog URLs |
| `marketing_brain_skills/tools_registry/ga4/SKILL.md` | GA4 — used 48h post-publish to measure sessions and time-on-page for the `measured` status transition |
| `marketing_brain_skills/tools_registry/REGISTRY.md` | Full tool registry — publishing tools in Section D |
| `CLAUDE.md` §0 | Data Accuracy mandate — every statistic in a blog post must carry a verification trace |
| https://developer.wordpress.org/rest-api/ | Official WordPress REST API reference |
| https://developer.wordpress.org/rest-api/reference/posts/ | `/wp/v2/posts` endpoint — full field reference, status values, schema |
| https://developer.wordpress.org/rest-api/reference/media/ | `/wp/v2/media` endpoint — upload requirements, MIME type list |
