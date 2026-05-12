---
name: blog-post
description: Generate and publish SEO-optimized long-form blog posts on Ryan Realty's AgentFire WordPress site at ryan-realty.com — full schema markup, embedded YouTube video, internal cross-links, image alt text, and the WP REST API publish path. Use this skill whenever the user requests a blog post, says "write a blog post for [topic]", "publish to the blog", "draft a blog post about [city/neighborhood/listing]", "post this to ryan-realty.com", or asks for written long-form content destined for the website. Use this skill ALWAYS when the monthly-market-report-orchestrator routes deliverable #3. Do NOT use this skill for social-media captions, email newsletters, or video-script copy — those have their own skills. The blog at ryan-realty.com is AgentFire-hosted WordPress (NOT Vercel) — this is the only blog destination.
---

# Blog Post Skill — Ryan Realty (AgentFire WordPress)

**Scope:** Generate SEO-optimized long-form blog posts and publish them to Ryan Realty's WordPress site at `ryan-realty.com` (AgentFire-hosted). The skill covers: research → outline → draft → SEO optimization → schema markup → image alt text → WordPress REST API publish.

**Status:** Locked 2026-05-07. AgentFire WordPress is the production blog destination per Matt directive — see `video_production_skills/AGENT_HANDOFF.md`.

---

## 1. When to use / when not to use

**Use this skill for:**
- Monthly market report blog post (deliverable #3 from `monthly-market-report-orchestrator`)
- Neighborhood guide blog posts
- Listing spotlight blog posts
- Real estate news / market commentary blog posts
- Buyer's guides, seller's guides, evergreen content
- Anything destined for `ryan-realty.com` as a published article

**Do NOT use for:**
- Instagram / TikTok / FB Reels captions (use `publisher/SKILL.md` platform-specific copy)
- Email newsletters (route to `marketing:email-sequence` or equivalent)
- Video script (lives in the corresponding video-production skill, e.g. `market-data-video/SKILL.md`)
- Internal docs, runbooks, or non-customer-facing content

---

## 2. The publish destination is AgentFire WordPress

**ONE blog destination:** `https://ryan-realty.com` (AgentFire-hosted WordPress).

**NOT** the Vercel app at `ryanrealty.vercel.app` — that hosts the MLS dashboard, not the blog. The Vercel app and the AgentFire WP coexist on the same domain at the production cutover (`ryan-realty.com` for blog/marketing content; `ryanrealty.vercel.app` and future app subdomain for the dashboard).

**AgentFire WordPress REST API endpoint:**
```
https://ryan-realty.com/wp-json/wp/v2/posts
```

**Authentication:** WordPress Application Passwords. Required env vars in `.env.local`:
```
WP_AGENTFIRE_USER=<wordpress-user>
WP_AGENTFIRE_APP_PASSWORD=<application-password>
WP_AGENTFIRE_SITE_URL=https://ryan-realty.com
```

**Auth header:**
```
Authorization: Basic <base64(WP_AGENTFIRE_USER:WP_AGENTFIRE_APP_PASSWORD)>
Content-Type: application/json
```

If env vars are missing, halt with: "AgentFire WordPress credentials not configured. Add `WP_AGENTFIRE_USER` and `WP_AGENTFIRE_APP_PASSWORD` to `.env.local`. Generate the application password at WP Admin → Users → Profile → Application Passwords."

---

## 3. SEO spec — every blog post must hit all of these

### 3.1 Title tag
- **Length:** ≤60 characters
- **Front-loaded keyword:** start with the primary target keyword (e.g. "Bend Oregon Real Estate")
- **Brand suffix:** end with " | Ryan Realty"
- **Pattern:** `{Primary Keyword} {Period or Modifier} | Ryan Realty`
- **Example:** "Bend Oregon Real Estate Market Report — April 2026 | Ryan Realty"

### 3.2 Meta description
- **Length:** 150–160 characters (truncated above 160)
- **Lede with the headline stat + period:** "Bend's median home price hit $699K in April 2026, down 13.4% from last year. See the full market breakdown..."
- **CTA hook at the end:** "Read the full report →"

### 3.3 URL slug (canonical)
- **Pattern by content type:**
  - Market report: `/market-report/{city-slug}/{YYYY-MM}` (e.g. `/market-report/bend/2026-04`)
  - Neighborhood guide: `/neighborhoods/{city-slug}/{neighborhood-slug}`
  - Listing spotlight: `/listings/{listingkey}`
  - Evergreen: `/blog/{slug}`
- **Slug rules:** lowercase, hyphens only, no stop words ("a", "the", "of"), no numbers unless meaningful (year/month OK)

### 3.4 Open Graph + Twitter Card
- `og:title` — same as title tag, brand suffix optional (Twitter card truncates more aggressively)
- `og:description` — same as meta description
- `og:image` — 1200×630 hero image (chart screenshot, location photo, or generated cover card)
- `og:type` — `article` for posts, `video.other` for video-led posts
- `og:url` — canonical URL
- `twitter:card` — `summary_large_image`

### 3.5 Structured data (JSON-LD blocks in `<head>`)

**Always include `Article`:**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "description": "{meta description}",
  "image": "{og:image URL}",
  "datePublished": "{ISO 8601}",
  "dateModified": "{ISO 8601}",
  "author": {
    "@type": "Person",
    "name": "Matt Ryan",
    "url": "https://ryan-realty.com/about/matt-ryan"
  },
  "publisher": {
    "@type": "RealEstateAgent",
    "name": "Ryan Realty",
    "logo": {
      "@type": "ImageObject",
      "url": "https://ryan-realty.com/wp-content/uploads/.../logo.png"
    }
  }
}
```

**For market reports / neighborhood guides — add `Place`:**
```json
{
  "@type": "Place",
  "name": "{City}, OR",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "{City}",
    "addressRegion": "OR",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "{lat}",
    "longitude": "{lng}"
  }
}
```

**For posts with embedded video — add `VideoObject`:**
```json
{
  "@type": "VideoObject",
  "name": "{video title}",
  "description": "{video description}",
  "thumbnailUrl": "{thumb URL}",
  "uploadDate": "{ISO}",
  "duration": "PT{minutes}M{seconds}S",
  "contentUrl": "{video file URL or YouTube watch URL}",
  "embedUrl": "{YouTube embed URL}"
}
```

Validate every JSON-LD block against [Google's Rich Results Test](https://search.google.com/test/rich-results) before publish. Halt if any required field fails.

### 3.6 Heading hierarchy
- **One H1 only** (the page title — WordPress wraps the post title in H1 automatically; do NOT add another H1 in the post body).
- **H2 = each major section** (e.g. "Median Sale Price", "Months of Supply", "Days on Market", "Top Neighborhoods").
- **H3 = sub-sections within an H2** (e.g. "How Bend compares to last year").
- Don't skip levels (no H4 inside H2 without an H3 between).

### 3.7 Internal links
- Link to the **previous month's report** (e.g. April 2026 post links to March 2026 post): "Last month's [Bend market report](/market-report/bend/2026-03)..."
- Link to **the city's neighborhood guides** when neighborhoods are mentioned: "Petrosa led closed sales — see our [Petrosa neighborhood guide](/neighborhoods/bend/petrosa)..."
- Link to **the relevant listing search**: "Currently 1,149 active SFR listings in Bend — [see them all](/search/bend-sfr)..."
- Aim for 3–5 internal links per 1,000 words. Anchor text is descriptive, not "click here."

### 3.8 External links
- Cite primary data sources: Census Bureau, NAHB, ORMLS, Spark API, FRED, Case-Shiller. Open in new tab (`target="_blank" rel="noopener nofollow"`).
- Do NOT link to competitor brokerages or aggregator portals (Zillow, Realtor.com, Redfin) unless absolutely necessary for context.

### 3.9 Image alt text
- **Every image** must have descriptive alt text — no decorative images without alt.
- **Pattern for charts:** `"{Stat name} chart for {city} {period} — {key value}"` (e.g. "Median sale price line chart for Bend April 2026 — $699K, +52% since 2019")
- **Pattern for photos:** `"{Subject} — {location context}"` (e.g. "Smith Rock State Park near Bend, Oregon")
- **Never:** "image1.jpg", "untitled", "photo of [thing]" without context.

### 3.10 Embedded YouTube video
- Use **WordPress oEmbed** (paste the YouTube URL on its own line) OR an iframe with `loading="lazy"` and `title="..."`.
- Place the video **above the fold** (right after the lede paragraph) for video-led posts.
- Add the `VideoObject` JSON-LD (per §3.5).
- Always include a **transcript or chapter timestamps** below the video (helps SEO + accessibility + AI search).

### 3.11 Word count
- **Market report:** 800–1,500 words
- **Neighborhood guide:** 1,000–2,000 words
- **Listing spotlight:** 400–800 words (shorter is fine — the listing page does the heavy lifting)
- **Evergreen guide:** 1,500–3,000 words
- **Below the floor:** halt and add depth (FAQ, deeper analysis, comparison context).
- **Above the ceiling:** split into multiple posts or move depth to a downloadable PDF.

### 3.12 Tone + voice
- **Authoritative but accessible** — Matt is a licensed principal broker; the post should sound like a knowledgeable local expert, not a generic content mill.
- **Banned words** (per `ANTI_SLOP_MANIFESTO.md` §1): stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout. No em-dashes. No semicolons. No "approximately/roughly/about" as a substitute for the actual number.
- **Numbers carry units** always: "$699,000" not "$699,000.00", "46 days" not "46d", "98.5%" not ".985".

---

## 4. Generation flow

1. **Receive data + media from orchestrator** — the `monthly-market-report-orchestrator` (or direct caller) provides:
   - Verified data (cache row + `*_sfr` columns + history + extras)
   - YouTube long-form video URL (already uploaded)
   - Hero image (chart screenshot or generated cover)
   - Featured image gallery (optional — chart screenshots, hero photos)

2. **Outline first** — H1 title, H2 sections, H3 subsections. Confirm the outline matches the data story before drafting. The data dictates the section order, not the template.

3. **Draft body** — write each section. Embed the YouTube video right after the lede. Embed chart images at the section that discusses them.

4. **Add JSON-LD blocks** — Article + Place + VideoObject (if video). Validate each.

5. **SEO checklist** — title length ≤60, meta description 150–160, internal links 3–5, alt text on every image, slug correct, OG image set, all banned words removed.

6. **Publish via WP REST API** as DRAFT first (`status: 'draft'`).

7. **Surface preview URL to Matt:**
   ```
   https://ryan-realty.com/?p={draft-id}&preview=true
   ```

8. **On Matt's "go"** — toggle status to 'publish' via PATCH to the same post:
   ```
   PATCH /wp-json/wp/v2/posts/{id}
   { "status": "publish" }
   ```
   Then ping the sitemap (`https://ryan-realty.com/sitemap_index.xml`) — most SEO plugins auto-update; if not, trigger Yoast/Rank Math sitemap rebuild.

---

## 5. Featured-image upload

Upload featured image to WP Media Library FIRST (gets media ID), then attach to the post.

```
POST /wp-json/wp/v2/media
Content-Type: image/jpeg
Content-Disposition: attachment; filename="bend-april-2026-cover.jpg"
{binary}

→ returns { id: 12345, source_url: "https://ryan-realty.com/wp-content/uploads/..." }
```

Then in the post payload, set `featured_media: 12345`.

---

## 6. Categories + tags

Standard WordPress taxonomies — pull existing IDs from `/wp-json/wp/v2/categories` and `/wp-json/wp/v2/tags`, or create on the fly.

**Standard categories:**
- Market Reports (slug: `market-reports`)
- Neighborhood Guides (slug: `neighborhood-guides`)
- Listing Spotlights (slug: `listings`)
- Buyer Resources (slug: `buyers`)
- Seller Resources (slug: `sellers`)
- News (slug: `news`)

**Tag patterns:**
- City: `bend`, `redmond`, `sisters`, `la-pine`, `prineville`, `sunriver`
- Year: `2026`, `2025`
- Type: `monthly-report`, `quarterly-report`, `ytd-report`
- Topic: `median-price`, `inventory`, `mortgage-rates`

Each post gets 1 category + 3–8 tags.

---

## 7. Pre-publish QA checklist

Before flipping draft → publish:

- [ ] Title ≤60 chars
- [ ] Meta description 150–160 chars
- [ ] Slug matches §3.3 pattern
- [ ] OG image uploaded + set
- [ ] All JSON-LD blocks validate (Rich Results Test passes)
- [ ] H1 present (auto from title), H2 hierarchy correct
- [ ] 3–5 internal links present
- [ ] All images have descriptive alt text
- [ ] Video embedded above fold (if video-led post)
- [ ] Word count in target range (§3.11)
- [ ] Banned-word grep returns zero hits
- [ ] All numbers carry units
- [ ] Verification trace covers every figure on the page

If ANY fail, halt before publishing.

---

## 8. Broker headshots (author bylines)

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.jpg` — Matt Ryan (owner / principal broker)
- `paul-stevenson.jpg` — Paul Stevenson
- `rebecca-peterson.jpg` — Rebecca Peterson

All 800×1200 px, pure white bg, identical head height, natural color. Specs in `design_system/ryan-realty/MANIFEST.md` §"assets/team/".

**Author byline rule:** Every blog post that features a specific agent (listing spotlight, agent commentary, market insight attributed to a broker) must include that broker's headshot in the author byline block. Upload the headshot to the WP Media Library if not already there, then reference the media ID in the `author_image` custom field or theme avatar override. For brokerage-brand posts (monthly market reports, neighborhood guides), no individual headshot is required — use the Ryan Realty logo from `design_system/ryan-realty/assets/brand/logo-blue.png`.

---

## 9. See also

- `video_production_skills/monthly-market-report-orchestrator/SKILL.md` — the orchestrator that calls this skill
- `video_production_skills/youtube-long-form-market-report/SKILL.md` — the long-form video this post embeds
- `video_production_skills/market-data-video/SKILL.md` — short-form companion + canonical data dictionary (every figure in this blog post traces back to a column documented there)
- `video_production_skills/media-sourcing/SKILL.md` — choose hero image source (asset library, Unsplash, Shutterstock, Imagen, Nano Banana, Grok Imagine, etc.). Locked default for blog hero: chart screenshot from the YouTube long-form OR a generated cover card from Imagen 4 / Nano Banana 2.
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content rules (canonical)
- `video_production_skills/AGENT_HANDOFF.md` — confirms AgentFire WP is the production blog destination
- `social_media_skills/facebook-lead-gen-ad/SKILL.md` — paired ad sub-skill
- WordPress REST API: https://developer.wordpress.org/rest-api/reference/posts/
- AgentFire docs: https://help.agentfire.com/ (account-specific)
