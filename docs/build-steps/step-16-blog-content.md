# Build Step 16: Blog & Content Pages

Scope: Blog engine, AI content generation, content engine & social publishing.

Build the blog and content system:

## TASK 1: Blog Index Page
Create src/app/(public)/blog/page.tsx as a SERVER component:
- Fetch published blog posts ordered by published_at desc
- SEO metadata: title "Central Oregon Real Estate Blog | Market Insights & Guides | Ryan Realty"
- JSON-LD: Blog schema
- Featured post at top: large hero image, title, excerpt, author, date (most recent or admin-flagged)
- Category filter tabs: All, Market Reports, Community Guides, Buying Tips, Selling Tips, Lifestyle
- Grid of post cards below (3 columns desktop, 2 tablet, 1 mobile)
- Each card: hero image, category badge, title, excerpt (2 lines), author name + avatar, published date, estimated read time
- Pagination: 12 per page, "Load More" button
- Sidebar (desktop only): popular posts (top 5 by views), category list with counts, email signup CTA

## TASK 2: Blog Post Detail Page
Create src/app/(public)/blog/[slug]/page.tsx as a SERVER component:
- Fetch post by slug with author (broker) data
- If not found or not published, return notFound()
- SEO metadata: title "[Post Title] | Ryan Realty Blog", description from excerpt, canonical URL
- JSON-LD: BlogPosting schema with author, datePublished, image
- OG image: use hero image or generate dynamic OG via /api/og?type=blog&slug=[slug]

Layout:
- Hero image (full width, 50vh max)
- Title (H1, large)
- Meta row: author name + avatar, published date, read time, category badge
- Article content (rendered markdown/HTML with proper typography: larger body text, styled headings, block quotes, code blocks, lists)
- Social share buttons (after content)
- Author card at bottom: headshot, name, bio excerpt, "View [Name]'s Listings" link
- Related posts: 3 posts from same category, horizontal cards
- CTA section: "Get Market Updates" email signup

## TASK 3: Blog Post Static Generation
- Use generateStaticParams to pre-generate all published blog post pages at build time
- ISR revalidation: 3600 seconds (1 hour)
- Generate sitemap entries for all published posts

## TASK 4: AI Blog Generation (Inngest Function)
Create inngest/functions/generateBlogPost.ts:
- Inngest function id: "content/generate-blog-post"
- Triggered manually from admin or from report generation
- Input: { topic, type, context (listing data, market data, community data) }
- Step 1: Build system prompt with brand tone guidelines (direct, conversational, authentic, no hyphens, no generic real estate phrases)
- Step 2: Call X AI (Grok) to generate:
  - Title (compelling, SEO-friendly)
  - Content (800-1500 words, proper heading structure, data-rich)
  - Excerpt (160 chars)
  - Suggested category
  - Suggested tags
  - SEO title and description
- Step 3: Store in blog_posts table with status='draft'
- Step 4: Create ai_content record linking to the blog post
- Step 5: Add to content queue for admin review

## TASK 5: About Page
Create src/app/(public)/about/page.tsx:
- Content from settings table (editable in admin)
- Sections: brokerage story, mission, team overview
- Team grid: broker cards linking to individual agent pages
- Stats: years in business, homes sold, communities served, client reviews
- Awards / certifications
- Office location with Google Map embed
- Contact info matching Google Business Profile exactly (NAP consistency for SEO)
- Equal Housing Opportunity statement
- JSON-LD: RealEstateAgent + LocalBusiness schema
- SEO metadata

## TASK 6: Contact Page
Create src/app/(public)/contact/page.tsx:
- Contact form: name, email, phone, "How can we help?" dropdown (Buying, Selling, Both, General Inquiry, Relocation), message
- On submit: push to FUB as General Inquiry, send Resend notification to admin, track generate_lead event
- Office info: address, phone, email, hours
- Google Map embed showing office location
- Meet the team section: link to /agents
- SEO metadata, JSON-LD ContactPage schema

## TASK 7: Sell Page
Create src/app/(public)/sell/page.tsx:
- "Thinking of Selling?" hero with CTA
- "What's Your Home Worth?" section with address input → triggers CMA generation (requires auth)
- Why sell with Ryan Realty: marketing plan overview, professional photography, data-driven pricing, local expertise
- Market snapshot: current seller's/buyer's market conditions for Bend
- Recent sales by Ryan Realty brokers (social proof)
- Seller resources: links to blog posts about selling
- Contact form: "Get a Free Consultation" — pushes to FUB with tag "seller-lead"
- Track seller_lead_capture event
- SEO metadata

TypeScript strict. No any types. Use design system components. Follow brand colors.
