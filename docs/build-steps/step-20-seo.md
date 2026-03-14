# Build Step 20: SEO — Sitemaps, Structured Data, OG Images

Scope: SEO strategy, sitemaps, structured data, OG/Twitter previews, meta tags.

## TASK 1: Dynamic Sitemap
Create src/app/sitemap.ts:
- Next.js built-in sitemap generation
- Generate entries for ALL public pages:
  - / (homepage) — priority 1.0, changeFrequency 'daily'
  - /search — priority 0.9, changeFrequency 'daily'
  - /communities — priority 0.8, changeFrequency 'weekly'
  - /communities/[slug] — one entry per community, priority 0.8, changeFrequency 'daily'
  - /cities — priority 0.8, changeFrequency 'weekly'
  - /cities/[slug] — one entry per city, priority 0.8, changeFrequency 'daily'
  - /cities/[slug]/[neighborhood] — one per neighborhood, priority 0.7, changeFrequency 'weekly'
  - /listings/[listingKey] — one per ACTIVE listing, priority 0.7, changeFrequency 'daily'
  - /agents — priority 0.7, changeFrequency 'weekly'
  - /agents/[slug] — one per active broker, priority 0.7, changeFrequency 'weekly'
  - /blog — priority 0.6, changeFrequency 'daily'
  - /blog/[slug] — one per published post, priority 0.6, changeFrequency 'monthly'
  - /reports — priority 0.6, changeFrequency 'weekly'
  - /open-houses — priority 0.7, changeFrequency 'daily'
  - /about — priority 0.5, changeFrequency 'monthly'
  - /contact — priority 0.5, changeFrequency 'monthly'
  - /sell — priority 0.6, changeFrequency 'monthly'
- Fetch all slugs from Supabase at generation time
- lastModified from the record's updated_at field
- For large sites (1000+ listings): split into multiple sitemaps using sitemap index

## TASK 2: Robots.txt
Create src/app/robots.ts:
- Allow all crawlers on all public paths
- Disallow: /admin/, /dashboard/, /api/, /compare (personalized, not for SEO)
- Sitemap: https://ryan-realty.com/sitemap.xml
- Crawl-delay: not needed for reputable bots

## TASK 3: Dynamic OG Image Generation
Create src/app/api/og/route.tsx:
- Uses @vercel/og (Satori) to generate PNG images at the edge
- Accepts query params: type (listing, community, blog, report, broker, default), id or slug
- Generates 1200x630px branded images:

Listing OG:
- Background: property hero photo (fetched, resized)
- Dark gradient overlay
- Price (large, white, accent background pill)
- Address (white)
- Stats: beds/baths/sqft
- Ryan Realty logo bottom-right

Community OG:
- Background: community hero image
- Community name (large, white)
- "X Homes for Sale | Median $XXX,XXX"
- Ryan Realty logo

Blog OG:
- Navy background
- Post title (large, white)
- Author name and avatar
- Category badge
- Ryan Realty logo

Broker OG:
- Clean background
- Broker headshot (circular)
- Name, title
- Star rating, transaction count
- Ryan Realty logo

Default (homepage, about, etc):
- Branded image with "Ryan Realty — Central Oregon Real Estate"
- Mountain/landscape imagery
- Tagline

## TASK 4: Structured Data Audit
Verify JSON-LD is correctly implemented on every page type. Create a shared utility:

Create src/lib/structured-data.ts:
- generateListingSchema(listing) → SingleFamilyResidence / Apartment schema
- generateCommunitySchema(community) → Place schema
- generateCitySchema(city) → City schema
- generateBrokerSchema(broker) → RealEstateAgent schema
- generateBlogSchema(post) → BlogPosting schema
- generateBrokerageSchema() → RealEstateAgent + LocalBusiness schema
- generateBreadcrumbSchema(items) → BreadcrumbList schema
- generateFAQSchema(faqs) → FAQPage schema (for community/city pages)
- generateEventSchema(openHouse) → Event schema

Each function returns a properly formatted JSON-LD object. Render in page <head> via Next.js metadata API or a <script type="application/ld+json"> tag.

## TASK 5: Canonical URLs
Create src/lib/canonical.ts:
- Function: getCanonicalUrl(path: string) that returns the full canonical URL
- Base: NEXT_PUBLIC_SITE_URL (production: https://ryan-realty.com)
- Strip pagination params, sort params, and other non-essential query params
- Every page must have a canonical URL in its metadata

## TASK 6: Meta Tags Audit
Verify every page exports proper Next.js metadata:
- title (using template from layout)
- description (unique per page, 150-160 chars)
- openGraph: title, description, url, images (pointing to /api/og), type
- twitter: card 'summary_large_image', title, description, images
- robots: index/follow for public pages, noindex for dashboard/admin/compare
- alternates: canonical URL

## TASK 7: Sitemap Regeneration (Inngest Function)
Create inngest/functions/regenerateSitemap.ts:
- Inngest function id: "seo/regenerate-sitemap"
- Triggered: after every delta sync (as part of post-sync pipeline)
- Next.js generates sitemaps on request, but this function can trigger an ISR revalidation of the sitemap route to ensure it's fresh
- Also ping Google: fetch('https://www.google.com/ping?sitemap=https://ryan-realty.com/sitemap.xml')

Register in inngest/functions/index.ts.

TypeScript strict. No any types.
