# The Ultimate Real Estate Platform — Complete Build Specification

**Ryan Realty | Bend, Oregon**
**Version 25.0 | March 2026**

> This document is the single source of truth for building the ultimate real estate platform for Ryan Realty in Bend, Oregon. It is written for direct consumption by an AI coding agent (Claude, Cursor, or equivalent). Every section is self-contained and actionable. When you feed a section to your AI, it should have everything it needs to build that feature without ambiguity. The goal is to get into production ASAP and push daily updates.

### ⚠️ GREENFIELD PROJECT DIRECTIVE (READ FIRST)

**This is a brand-new project built from scratch.** There is no existing codebase. The AI coding agent builds everything fresh per this specification.

1. **This spec is the authority.** Build exactly what's described here. No shortcuts, no bare minimum.
2. **Build in order.** Follow the Build Order (Section 51) which defines the sequence for building features.
3. **Use verified field names.** The database schema (Section 6) and Spark API field mapping (Appendix A) use exact, verified names. Do not guess.
4. **Every page earns its existence.** No stubs, no placeholder pages, no "coming soon." If a page is in this spec, build it completely.
5. **When in doubt, follow the spec.** If the spec says to do something, do it. If the spec doesn't address something, make the best decision and leave a `// TODO: Verify with spec` comment.

---

## Table of Contents

1. [Project Vision & Core Principles](#1-project-vision--core-principles)
2. [Build Methodology & Developer Context](#2-build-methodology--developer-context)
3. [Tech Stack (Confirmed)](#3-tech-stack-confirmed)
4. [Integration Inventory & Environment Variables](#4-integration-inventory--environment-variables)
5. [Architecture Notes (Standalone First, Multi-Tenant Later)](#5-architecture-notes-standalone-first-multi-tenant-later)
6. [Data Architecture & Geographic Hierarchy](#6-data-architecture--geographic-hierarchy)
7. [Data Syncing Engine (Spark API to Supabase)](#7-data-syncing-engine-spark-api-to-supabase)
8. [Listing Data Model & Display](#8-listing-data-model--display)
9. [Enhanced Listing Pages (ARYEO Integration & Zillow Showcase Equivalent)](#9-enhanced-listing-pages-aryeo-integration--zillow-showcase-equivalent)
10. [Property Valuation Engine (Estimated Value)](#10-property-valuation-engine-estimated-value)
11. [AI Features Layer (Search, Chat, Content Generation)](#11-ai-features-layer-search-chat-content-generation)
12. [AI Optimization Agent (Autonomous Improvement)](#12-ai-optimization-agent-autonomous-improvement)
13. [AI Video Pipeline](#13-ai-video-pipeline)
14. [AI Blog Engine](#14-ai-blog-engine)
15. [Content Engine & Social Publishing](#15-content-engine--social-publishing)
16. [Homepage & Site Structure](#16-homepage--site-structure)
17. [Search, Filtering & Map Experience](#17-search-filtering--map-experience)
18. [Community, Resort & Neighborhood Pages (Type Two Microsites)](#18-community-resort--neighborhood-pages-type-two-microsites)
19. [Broker & Brokerage Pages](#19-broker--brokerage-pages)
20. [Broker-Listing Association & License Matching](#20-broker-listing-association--license-matching)
21. [Broker Review Aggregation](#21-broker-review-aggregation)
22. [Google Business Profile Integration](#22-google-business-profile-integration)
23. [User Accounts, Dashboards & Preferences](#23-user-accounts-dashboards--preferences)
24. [Social Engagement, Feed System & Trending Intelligence](#24-social-engagement-feed-system--trending-intelligence)
25. [Video & Media Strategy](#25-video--media-strategy)
26. [Imagery (Unsplash Integration & Media Pipeline)](#26-imagery-unsplash-integration--media-pipeline)
27. [Sharing & Social Distribution](#27-sharing--social-distribution)
28. [Lead Generation, Scoring & CRM (Follow Up Boss)](#28-lead-generation-scoring--crm-follow-up-boss)
29. [Notification Architecture (Resend + FUB Dual Channel)](#29-notification-architecture-resend--fub-dual-channel)
30. [Tracking, Analytics & Cookie Policy (GA4 + GTM + Meta Pixel + CAPI)](#30-tracking-analytics--cookie-policy-ga4--gtm--meta-pixel--capi)
31. [Admin Backend & Content Management (Full CRUD)](#31-admin-backend--content-management-full-crud)
32. [Reporting Engine](#32-reporting-engine)
33. [Market Stats Pre-Computation](#33-market-stats-pre-computation)
34. [Identified Personalization](#34-identified-personalization)
35. [Third Party Data (Schools, Walkability, Scores)](#35-third-party-data-schools-walkability-scores)
36. [Seller Experience & "What's My Home Worth"](#36-seller-experience--whats-my-home-worth)
37. [Home Comparison Tool](#37-home-comparison-tool)
38. [Open Houses](#38-open-houses)
39. [Broker Tools (Presentations, QR Codes, Just Listed/Sold)](#39-broker-tools-presentations-qr-codes-just-listedsold)
40. [Broker Performance Dashboard](#40-broker-performance-dashboard)
41. [Print & PDF Export](#41-print--pdf-export)
42. [Notification Preference Management](#42-notification-preference-management)
43. [Mobile, Responsive & Progressive Web App](#43-mobile-responsive--progressive-web-app)
44. [Performance, Speed & SEO](#44-performance-speed--seo)
45. [Neighborhood Data Sources](#45-neighborhood-data-sources)
46. [Missing Site Pages (About, Contact, Legal, Sitemap, 404)](#46-missing-site-pages)
47. [Accessibility (ADA / WCAG 2.1 AA)](#47-accessibility-ada--wcag-21-aa)
48. [UX Standards (Loading States, Errors, Skeletons)](#48-ux-standards-loading-states-errors-skeletons)
49. [Email Deliverability & Infrastructure](#49-email-deliverability--infrastructure)
50. [Security, Compliance & Privacy](#50-security-compliance--privacy)
51. [Existing Build Priorities (Already Implemented or In Progress)](#51-existing-build-priorities-already-implemented-or-in-progress)
52. [Open Questions & Decisions Needed](#52-open-questions--decisions-needed)

---

## 1. Project Vision & Core Principles

Build the most comprehensive, fastest, and most engaging real estate platform in Central Oregon, designed from day one to scale internationally and be sold as a white-label product to other brokerages.

This is not a standard brokerage website. It is a data-rich, socially engaging, lead-generating machine that combines the data depth of an MLS, the engagement mechanics of Instagram, and the consumer experience of Zillow. Built for Ryan Realty in Bend, Oregon, with the codebase kept clean enough to support multi-tenancy in the future.

### Core Principles

- **Speed above all else.** Data must load faster than any competing site.
- **Every byte of data exposed.** If the database has it, the website shows it. Data density is our competitive moat.
- **Engagement equals leads.** Every interaction is tracked, stored, and routed to the right broker.
- **Built for scale.** Starting with Central Oregon / Cascades East Association of Realtors (FlexMLS). Architecture supports international expansion.
- **Clean architecture.** Keep the codebase modular enough that multi-tenancy can be added later, but do not build it now.
- **No deprecated patterns.** Every decision uses current best practices.
- **Non-technical admin access.** Anyone can manage their site through an intuitive backend.
- **AI-native.** AI is woven into every layer, from search to content generation to autonomous optimization.
- **Sellable as a product.** Always thinking of this as a product other brokerages will pay for.
- **Best practices everywhere.** If a competing site does something well, we do it better. If there is an established best practice for any feature, we use it. We never settle for a mediocre implementation.
- **SEO optimized at every level.** Every page, every URL, every meta tag, every structured data element is built for maximum search visibility.

### Competitive Benchmarks

- Zillow (data depth, Zestimate, search UX, listing detail, Zillow Showcase)
- Realtor.com (MLS accuracy, listing freshness, IDX compliance)
- Redfin (map experience, speed, mobile UX, data presentation)
- Compass (brokerage branding, agent pages, luxury market feel)
- Instagram / TikTok (feed mechanics, video autoplay, engagement loops, social proof)

### UI/UX Design System (Research-Backed — Not Guesswork)

Every design decision in this platform is grounded in UX research and behavioral psychology. The coding agent MUST follow these specifications. These are not suggestions — they are requirements based on proven conversion science.

#### Color System

**Primary palette:**
- **Navy #102742** — Primary brand color. Used for: header background, primary text headings, footer background, serious/authoritative elements. Navy conveys trust, professionalism, and stability — the exact emotional register for real estate.
- **Cream #F0EEEC** — Secondary brand color. Used for: page backgrounds, card backgrounds, light sections. Warm, inviting, not sterile white. Creates a luxury feel without being cold.
- **CTA Accent: Warm Amber/Gold #D4A853** (or similar warm accent derived from the brand palette). Used ONLY for primary CTA buttons (Request Tour, Contact Agent, Download CMA). This must contrast sharply with both Navy and Cream. The isolation effect from UX research states that only ONE element should visually stand out per section — the CTA button. A warm accent against Navy/Cream creates the contrast needed for conversion.
- **Success Green #22C55E** — Price drops, positive trends, seller's market indicators.
- **Alert Amber #F59E0B** — Price increases, balanced market, warning states.
- **Urgency Red #EF4444** — Hot badges, buyer's market indicators, error states. Used sparingly.
- **Neutral Gray scale** — #1F2937 (dark text), #6B7280 (secondary text), #9CA3AF (disabled/muted), #E5E7EB (borders), #F9FAFB (subtle backgrounds).

**Color rules:**
- Maximum 3-4 colors visible on any given screen at once. More than that creates visual overload.
- CTA buttons are the ONLY elements using the accent color. If everything is bold, nothing stands out.
- Text on Navy backgrounds must be white or Cream for WCAG AAA contrast.
- Text on Cream backgrounds must be Navy or dark gray for readability.
- Chart colors use the brand palette: Navy primary, accent secondary, gray tertiary. Never rainbow charts.

#### Typography

- **Heading font:** A clean, modern sans-serif (Inter, Plus Jakarta Sans, or similar). Used for all H1-H6 headings, prices, and prominent numbers. Weight: 600-700 for headings.
- **Body font:** Same family at regular weight (400) for body text. 16px minimum on desktop, 14px minimum on mobile. Line height 1.5-1.6 for readability.
- **Monospace font:** For MLS numbers, listing IDs, data values where alignment matters.
- **Font size scale:** H1: 36-48px. H2: 28-32px. H3: 22-26px. H4: 18-20px. Body: 16px. Small: 14px. Caption: 12px.
- **Price display:** Prices are the most important number on any listing card or page. They should be the largest, boldest text element (after the property address on listing pages). Use tabular/numeric font variant for aligned digits.

#### Spacing System

Use a consistent 4px base grid. All spacing values are multiples of 4:
- **4px** — Micro spacing (between icon and label).
- **8px** — Tight spacing (between related elements within a component).
- **12px** — Compact spacing (between form fields).
- **16px** — Standard spacing (between paragraphs, between cards in a tight grid).
- **24px** — Comfortable spacing (between sections within a component, padding inside cards).
- **32px** — Section spacing (between major sections on a page).
- **48px** — Large section breaks.
- **64px-96px** — Major page section separators (between hero and first content section, between content blocks).

**Whitespace is not wasted space.** Research shows that increased whitespace around content improves comprehension by 20% and perceived trustworthiness. The site should breathe. Dense data is fine in data tables and stats, but content sections need generous margins and padding.

#### Touch Targets & Interactive Elements

- All clickable elements: minimum 44x44px on desktop, 48x48px on mobile (per Apple/Google guidelines and WCAG 2.5.8).
- Minimum 8px spacing between adjacent touch targets to prevent accidental taps.
- Buttons have visible hover states (color shift, slight elevation/shadow) on desktop.
- Buttons have visible active/pressed states (scale down slightly, darken) on mobile.
- Focus states (keyboard navigation) are visible and use the accent color outline. Required for accessibility.

#### Visual Hierarchy (Attention Guidance)

Research confirms users scan in F-pattern (for text-heavy pages) or Z-pattern (for landing pages). Design accordingly:

- **Listing pages:** F-pattern. Hero photo captures attention (top), price and key stats immediately below (second scan line), CTA buttons on the left or prominently centered, then content flows vertically.
- **Homepage:** Z-pattern. Logo top-left, search bar center, hero image/video fills viewport, then content sections guide the eye in alternating left-right blocks.
- **Broker landing pages:** Z-pattern to CTA. Headshot and name (top-left), star rating and credentials (top-right), CTA form (center, above fold).

**The 3-Second Rule:** Every page must communicate its primary purpose within 3 seconds. A user landing on a listing page should see: the property photo, the price, and how to take action. A user landing on a community page should see: the community name, a visual impression, and what's available. If it takes longer than 3 seconds to understand what you're looking at, the design has failed.

#### Cards (Universal Card Design Enforcement)

All cards site-wide follow the same design language:
- **Border radius:** 12px (modern, soft, consistent).
- **Shadow:** Subtle shadow at rest (0 1px 3px rgba(0,0,0,0.1)). Elevated shadow on hover (0 4px 12px rgba(0,0,0,0.15)). The hover elevation creates a tactile "lifting" feel.
- **Padding:** 16px inside the card content area. Photos bleed to card edges (no padding on photo).
- **Photo aspect ratio:** 4:3 for grid cards, 16:9 for wide/featured cards, 4:5 for feed mode.
- **Card click area:** The entire card is clickable (not just the text). Click target is the full card surface.
- **Transition:** Hover state transitions at 200ms ease-out. Smooth, not jarring.

#### Forms & Lead Capture

Forms are the final barrier before conversion. Research shows reducing fields from 11 to 4 increases conversions by 120%.

- **Lead capture forms:** Maximum 4 fields for initial capture: Name, Email, Phone, Message (optional). Anything more can be collected later.
- **Field labels:** Float above the field (not inside as placeholder text that disappears). Users need to see labels at all times.
- **Field validation:** Real-time inline validation with green checkmarks. Do not wait until submission to show errors.
- **Error states:** Red border + error message directly below the field. Never a generic error at the top of the form.
- **Submit buttons:** Full-width on mobile. Use value-focused copy: "Get Your Free Report" not "Submit." "Schedule My Tour" not "Send."
- **Loading states:** Button shows spinner and disables on click. Never let users double-submit.
- **Success states:** Clear confirmation message. "Thank you! A broker will contact you within 1 hour." Then show next steps or related content (never a dead-end thank you page).

#### Page Load & Perceived Performance

Research shows every 0.1-second delay reduces conversions measurably. Every 1-second delay reduces conversions by 7%.

- **Largest Contentful Paint (LCP):** Target under 2.5 seconds.
- **First Input Delay (FID):** Target under 100ms.
- **Cumulative Layout Shift (CLS):** Target under 0.1.
- **Skeleton screens:** Every page shows skeleton loading states (gray placeholder shapes matching the layout) while data loads. Users perceive skeleton screens as 15-20% faster than spinners.
- **Progressive loading:** Above-the-fold content loads first. Below-fold content lazy-loads as the user scrolls.
- **Image optimization:** Next.js Image component with blur placeholder for perceived instant load. WebP/AVIF with JPEG fallback. Responsive srcset.
- **No layout shifts:** Reserve space for images, ads, and dynamic content so the page doesn't jump as elements load.

#### Social Proof & Trust Signals

Research: 57% of users only engage with businesses rated 4+ stars. Social proof increases conversion by 15-30%.

- **Review stars** visible on broker pages, brokerage pages, and anywhere broker attribution appears.
- **"X people viewed this"** on listing pages. Creates urgency and validates interest.
- **"X homes sold"** on broker pages. Demonstrates track record.
- **View/save/share counts** on every listing card. Social validation (others find this interesting).
- **Trending badges** (hot, new, price drop). FOMO and urgency triggers.
- **Trust badges in footer:** Equal Housing logo, MLS attribution, SSL secure badge, Oregon licensed.
- **Testimonials** on broker pages with real names and context (not anonymous).

#### Progressive Disclosure

Do not show everything at once. Research on cognitive load shows users process information better in chunks (Miller's Law: 7±2 items).

- **Listing pages:** Key stats visible immediately. Click "See More" for full description. Click to expand payment calculator. Click to expand tax history. The page reveals depth as the user asks for it.
- **Search filters:** Show top 5-6 most-used filters visible. "More Filters" expands the full filter panel. Prevents overwhelming new users while giving power users access to everything.
- **Community pages:** Overview visible. Market data below. Demographics, schools, amenities progressively disclosed.

#### Responsive Breakpoints

- **Mobile:** 0-639px. Single column. Bottom nav bar. Larger touch targets. Simplified layouts.
- **Tablet:** 640-1023px. Two columns where appropriate. Sidebar collapses.
- **Desktop:** 1024-1279px. Full layout. Sidebar visible. Multi-column grids.
- **Wide desktop:** 1280px+. Max content width of 1280px centered. No full-bleed content that stretches uncomfortably wide.
- **Mobile-first development.** CSS starts with mobile styles and adds complexity via min-width media queries. 65%+ of real estate browsing happens on mobile.

#### Animation & Motion

- **Transitions:** 150-250ms for micro-interactions (hover, focus, toggle). 300-500ms for larger state changes (modal open, panel slide).
- **Easing:** ease-out for entrances (fast start, gentle stop). ease-in for exits. Never linear (feels robotic).
- **Scroll animations:** Subtle fade-in-up on scroll for content sections. 200ms duration. Never bounce, shake, or spin (feels cheap).
- **Like/save animations:** Heart fills with color + subtle scale pulse (1.0 → 1.2 → 1.0 over 300ms). Bookmark fills with slide-up motion.
- **Loading transitions:** Skeleton → content fade-in (200ms). Never an abrupt pop-in.
- **No animation for animation's sake.** Every motion must serve a purpose: draw attention, confirm action, or indicate state change. If it doesn't serve a purpose, remove it.

#### Accessibility (WCAG 2.1 AA Minimum)

- All text has 4.5:1 contrast ratio against its background (AA). Important text (prices, CTAs) should target 7:1 (AAA).
- All images have descriptive alt text. Listing photos: "Exterior front view of 3-bedroom home at 123 Main St, Bend OR." Not "image1.jpg."
- All interactive elements are keyboard-navigable with visible focus indicators.
- All forms have associated labels (not just placeholder text).
- Screen reader compatibility: proper heading hierarchy (H1 → H2 → H3, never skipping), ARIA labels on dynamic content, live regions for real-time updates.
- Color is never the only indicator. Trend arrows use both color AND direction. Error states use both red AND an icon AND text.

### Success Metrics

Success is measured by continuous improvement across all standard website performance metrics. The AI optimization agent (Section 12) monitors these and constantly works to improve them. Core metrics include page load speed, organic search traffic, session duration, pages per session, bounce rate, visitor-to-lead conversion rate, lead-to-contact conversion rate, social engagement rates (likes, saves, shares per listing), and search ranking positions for target keywords.

---

## 2. Build Methodology & Developer Context

This project is built by a solo developer using AI-assisted coding (vibe coding with Claude, Cursor, and similar tools).

- Each section is self-contained. An AI agent can read one section and build that feature.
- Specifications are explicit. If the behavior is not written, it will not be built.
- **CRITICAL: Never build the bare minimum.** When building any page or feature, always research what the best-in-class version looks like across Zillow, Redfin, Realtor.com, Compass, and leading social platforms. Then build to that standard or better. If a section lists bullet points, those are the minimum requirements, not the ceiling. Always add best-practice elements that a top-tier implementation would include even if not explicitly listed. When in doubt, add more rather than less. Every page should feel comprehensive, data-rich, and professionally designed.
- **Every page is a destination.** No page should feel like a stub or afterthought. Community pages, city pages, neighborhood pages, broker pages, and the homepage should all feel as complete and data-rich as the listing detail page. If a page exists, it earns its existence with substantial, unique, valuable content.
- Environment variables and integration details are centralized in Section 4.
- Every feature includes validation criteria.
- Modular architecture with well-defined interfaces.
- Deployment on Vercel. Env vars in `.env.local` locally and Vercel Project Settings for production.
- All background jobs run via Inngest (not Vercel API routes) to avoid timeout limits.
- All database schema changes go through Supabase CLI migration files.

---

## 3. Tech Stack (Confirmed)

| Layer | Technology |
|---|---|
| Framework / Frontend | Next.js 15+ (App Router), TypeScript, Tailwind CSS |
| Database | Supabase Pro plan (PostgreSQL + PostGIS + RLS). Single project. |
| Database Client | Supabase JS client for CRUD. Raw SQL via `supabase.rpc()` for stored procedures. |
| Database Migrations | Supabase CLI (`supabase migration new`, `supabase db push`). Migration files in `supabase/migrations/`. |
| Connection Pooling | Supabase Supavisor (port 6543 for serverless functions, port 5432 for migrations/background jobs only) |
| Authentication | Supabase Auth with Google OAuth, Apple, Facebook, Email/Password |
| Mapping | Google Maps JavaScript API |
| CRM (broker-facing) | Follow Up Boss |
| User Notifications | Resend |
| AI Provider | X AI (Grok) as primary AI provider for all AI features |
| AI Video Generation | Luma Labs API + Runway API (DEFERRED — post-launch) |
| Imagery | Unsplash API + AI image generation for site elements |
| Analytics | GA4 via GTM + Meta Pixel + CAPI |
| Hosting / Deployment | Vercel (auto-deploy from GitHub `main` branch) |
| Background Jobs | **Inngest** (complex job chains, retries, fan-out, up to 2hr execution) |
| Storage | **Supabase Storage** (RLS integration, direct DB linking, one platform) |
| Media Delivery | ARYEO integration for professional listing media |
| Error Monitoring | **Sentry** (@sentry/nextjs, free tier: 5K errors/month) |
| PDF Generation | **@react-pdf/renderer** (React components → PDF, server-side) |
| OG Image Generation | **@vercel/og** (Satori, edge runtime, dynamic OG images per page) |
| Rate Limiting | **Upstash Redis + @upstash/ratelimit** (serverless-native, free tier) |
| Real-time | **Supabase Realtime** (Presence for live viewer counts, Broadcast for activity ticker) |
| Testing | **Vitest** (unit/integration) + **Playwright** (E2E) |
| CI/CD | Vercel auto-deploy + **GitHub Actions** (test/lint on PR) |
| Review Aggregation | Google Business API, Yelp Fusion (Zillow/Realtor.com deferred) |

### Vercel Limitations & Workarounds

Vercel Pro plan has a **60-second function timeout** for API routes and serverless functions. This affects:
- **Data sync:** Cannot run as a Vercel API route. Runs as an **Inngest function** triggered by cron. Inngest functions execute for up to 2 hours.
- **CMA PDF generation:** Can exceed 60s for complex reports. Runs as an Inngest function.
- **Post-sync processing pipeline:** Multiple database operations. Runs as an Inngest function chain.
- **Short-lived API routes** (search, listing fetch, form submissions): Fine within 60s. These stay as standard Next.js API routes.

**Rule:** If a job might take more than 30 seconds, it's an Inngest function. If it's a quick request/response, it's a Next.js API route.

---

## 4. Integration Inventory & Environment Variables

Single source of truth for all integrations. When building any feature, reference this section.

### Current Environment Variables

#### MLS Data Source
- `SPARK_API_BASE_URL` — FlexMLS / Cascades East Spark API base endpoint. Endpoints are known and accessible via virtual back office account.
- `SPARK_API_KEY` — Authentication key for Spark API requests.

#### AI Services
- `XAI_API_KEY` — X AI (Grok) API. Primary AI provider for all features (search, chat, content generation, blog writing, photo classification, optimization agent, valuation analysis). Server-only.
- `OPENAI_API_KEY` — OpenAI API. Available as fallback or for specific tasks if needed. Server-only.

#### AI Video Generation
- `LUMA_API_KEY` — Luma Labs API for AI video generation. Server-only.
- `RUNWAY_API_KEY` — Runway API for AI video generation. Server-only.

#### CRM & Lead Management
- `FOLLOWUPBOSS_API_KEY` — FUB API for lead creation, event tracking, contact lookup, broker routing, all broker-facing communications.
- `NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM` — FUB email tracking click parameter (default `_fuid`). Must be `NEXT_PUBLIC_` for client access. Used for identity bridge.

#### User Notifications
- `RESEND_API_KEY` — Resend API for all user-facing transactional emails.

#### Mapping
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps JavaScript API.

#### Authentication
- `GOOGLE_OAUTH_CLIENT_ID` — Google OAuth 2.0 client ID.
- `GOOGLE_OAUTH_CLIENT_SECRET` — Server-only.

#### Analytics & Tracking
- `NEXT_PUBLIC_GTM_CONTAINER_ID` — Google Tag Manager container ID.
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` — GA4 measurement ID. Also configured inside GTM as a GA4 Configuration tag.
- `GA4_PROPERTY_ID` — GA4 property ID (numeric, e.g., 123456789). Used by the GA4 Data API for pulling analytics data into the admin dashboard. Server-side only.
- `NEXT_PUBLIC_META_PIXEL_ID` — Meta Pixel ID.
- `META_CAPI_ACCESS_TOKEN` — Meta Conversions API access token. Server-only.

#### Imagery
- `UNSPLASH_ACCESS_KEY` — Unsplash API. Server-side only.

#### Infrastructure
- `CRON_SECRET` — Authenticates scheduled cron jobs.
- `SENTRY_DSN` — Sentry error tracking DSN. Captures client+server errors and performance data.
- `SENTRY_AUTH_TOKEN` — Sentry auth token for source map uploads during build.
- `INNGEST_EVENT_KEY` — Inngest event key for sending events to Inngest.
- `INNGEST_SIGNING_KEY` — Inngest signing key for webhook verification.
- `UPSTASH_REDIS_REST_URL` — Upstash Redis for rate limiting.
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis auth token.

#### Content Engine & Social Publishing
- `META_APP_ID` — Facebook/Instagram App ID for social OAuth and Graph API posting.
- `META_APP_SECRET` — Server-only.
- `META_AD_ACCOUNT_ID` — Meta ad account ID for programmatic ad creation from the broker tools. Find in Meta Business Suite > Settings > Ad Account. Ensure the system user token has `ads_management` permission. Server-only.

#### Lead Scoring & Alerts
- `LEAD_ALERT_WEBHOOK_URL` — (Optional) Webhook for lead score alerts. Configurable.

#### Review Aggregation (To Be Added)
- `YELP_API_KEY` — Yelp Fusion API for review sync. **No separate Google Business API key needed** — uses OAuth 2.0 via existing Google Cloud project credentials (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`).
- Zillow and Realtor.com reviews are **DEFERRED** (API terms uncertain — see Section 52).

#### Security / Bot Protection
- `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY` — Cloudflare Turnstile CAPTCHA public key (used on unauthenticated email-this-page form and public-facing lead forms). Safe for frontend.
- `CLOUDFLARE_TURNSTILE_SECRET_KEY` — Turnstile secret key for server-side token validation. Server-only.

#### Web Push Notifications (PWA)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — VAPID public key for Web Push API subscription. Must be `NEXT_PUBLIC_` so the service worker can subscribe. Generate with `npx web-push generate-vapid-keys`.
- `VAPID_PRIVATE_KEY` — VAPID private key for signing push messages. Server-only.

#### Analytics Data API
- `GA4_SERVICE_ACCOUNT_JSON` — Google Cloud service account JSON (stringified) for GA4 Data API (`runReport`, `runRealtimeReport`). Separate from the GA4 measurement ID. Server-only. Create in Google Cloud Console > IAM > Service Accounts, grant Viewer role on the GA4 property.
- `GOOGLE_SEARCH_CONSOLE_SITE_URL` — Full property URL registered in Google Search Console (e.g., `https://ryanrealty.com`). Used by the AI Optimization Agent for `searchanalytics.query` API calls.

#### GitHub Integration (AI Agent)
- `GITHUB_TOKEN` — Personal access token or GitHub App token with read-only `repo` scope. Used by the AI Optimization Agent to read the codebase and create labeled issues. Server-only.

#### External Data APIs
- `CENSUS_API_KEY` — Optional. US Census Bureau API key for higher rate limits on ACS neighborhood data calls. Free to obtain at api.census.gov/data/key_signup.html. If not set, requests are made without a key (50 requests/day limit applies).

### Where Environment Variables Live

- **Local:** `.env.local` in project root. Never commit.
- **Production:** Vercel > Project > Settings > Environment Variables.
- **Server-only vars** (no `NEXT_PUBLIC_`) never exposed to browser.
- **Client-safe vars** (`NEXT_PUBLIC_`) safe for frontend.

### Missing Integrations (Setup Instructions)

- **Walk Score API:** Applied for. Awaiting access. When approved, add `WALKSCORE_API_KEY` to env vars. Cost ~$0.01/request. Budget for active listings only.
- **SchoolDigger API (replaces GreatSchools):** Sign up at developer.schooldigger.com. Free tier includes 2,000 calls/month (more than enough for Central Oregon active listings). Add `SCHOOLDIGGER_API_KEY` and `SCHOOLDIGGER_APP_ID` to env vars.
- **Google Business Profile API:** Go to console.cloud.google.com > select your existing project > API Library > search "Google My Business API" > request access. Requires approval based on legitimate business use. Once approved, enable the API and use your existing Google OAuth credentials. No separate API key needed; uses OAuth 2.0 with your existing Google Cloud project.
- **Yelp Fusion API:** Go to yelp.com/developers > Create New App > get API key immediately. Free tier: 5,000 calls/day. Add `YELP_API_KEY` to env vars.
- **Zillow/Realtor.com reviews:** Matt will investigate syndication terms. May require authorized scraping or manual import if APIs are not available for review access.
- **Meta Marketing API (for creating ads from site):** `META_AD_ACCOUNT_ID` is now in the Content Engine & Social Publishing env var block above. Ensure your system user token has `ads_management` permission. No additional setup needed beyond what is already configured.

---

## 5. Architecture Notes (Standalone First, Multi-Tenant Later)

**CURRENT FOCUS: Standalone site for Ryan Realty.** Multi-tenant / white-label architecture is deferred. We are building a single-brokerage site first, getting it into production as fast as possible, and pushing daily updates. The codebase should be clean enough that multi-tenancy can be added later, but we are NOT building tenant isolation, tenant config, tenant resolution, or any multi-tenant infrastructure now.

### What This Means for Building

- No tenant config records. Branding is hardcoded to Ryan Realty (Navy #102742, Cream #F0EEEC).
- Single Supabase project. One database.
- No domain-based tenant resolution middleware.
- No feature flags per tenant (global feature flags are fine for the single site).
- When we eventually add multi-tenancy, the refactor should be straightforward if the codebase uses environment variables and config objects instead of magic strings.

### Future TODO (Not Now)

- Separate Supabase databases per tenant for full data isolation.
- Central platform database for tenant registry, billing, shared reference data.
- Tenant resolution at domain/subdomain level.
- Per-tenant branding, MLS credentials, FUB/Resend/analytics config.
- Self-service or manual onboarding flow.
- Subscription/billing management.

### Deployment Pipeline

- **Vercel auto-deploys** the `main` branch to production on every push.
- **Every push to any feature branch** creates a Vercel preview deployment (unique URL for testing).
- **GitHub branch protection on `main`:** Require pull request. Require passing build check (Vercel build) and passing tests (GitHub Actions).
- **The Claude Code auditor** reviews code on feature branches, updates docs, and flags issues before merge.
- **Workflow:** Feature branch → push → Vercel preview + GitHub Actions tests → Claude Code audit → PR review → merge to main → auto-deploy to production.

### Testing Strategy

- **Unit tests:** Vitest for utility functions, API route handlers, database query helpers. Files: `*.test.ts` next to source files.
- **Integration tests:** Vitest with Supabase test helpers for database queries and stored procedures.
- **E2E tests:** Playwright for critical user flows — registration, search, save listing, CMA download, contact form submission, broker page lead capture.
- **Coverage target:** 80% on utility functions and API routes. No coverage requirement on React components (test behavior, not markup).
- **CI integration:** GitHub Actions runs `vitest run` and `playwright test` on every PR. PR cannot merge if tests fail.

### Database Migration Strategy

- Use **Supabase CLI** for all schema changes.
- `supabase migration new <name>` creates a timestamped SQL migration file in `supabase/migrations/`.
- `supabase db push` applies pending migrations.
- **NEVER edit the database schema directly in the Supabase dashboard.** All changes go through migration files tracked in git.
- Migration files are the source of truth for the schema. If you need to understand the current schema, read the migration files in order.

### Rate Limiting (Our API Routes)

Protect our own API routes from abuse using Upstash Redis + @upstash/ratelimit:
- **Public API routes** (search, listing fetch): 60 requests/minute per IP.
- **Authenticated routes** (save, like, share, CMA download): 120 requests/minute per user.
- **Admin routes:** 300 requests/minute per user.
- **Contact forms:** 5 requests/minute per IP (prevent spam).
- Rate limit middleware applied via Next.js middleware (`middleware.ts`).

### Caching Strategy

- **Next.js ISR (Incremental Static Regeneration):** Listing pages revalidate every 60 seconds. Community/city pages revalidate every 5 minutes. Blog posts revalidate every 1 hour. This means pages are statically generated and served from edge cache, but regenerate with fresh data at the specified interval.
- **On-demand revalidation for critical status changes:** The 60-second ISR interval can lag behind urgent changes (e.g., Active → Pending). When the delta sync detects a listing status change, it immediately calls Next.js on-demand revalidation: `revalidatePath('/homes/[city]/[community]/[slug]')` via `res.revalidate()` (Next.js App Router: `import { revalidatePath } from 'next/cache'`). This ensures status changes appear within seconds of detection, not up to 60 seconds later. Also revalidate the community page and city page when a listing in that community changes status.
- **Vercel Edge Cache:** Static assets (JS, CSS, images, fonts) cached indefinitely with content hashing.
- **Supabase query caching:** The `reporting_cache` table IS the cache for market stats. For search results, use Next.js `unstable_cache` or React `cache()` with 60-second TTL.
- **Client-side caching:** SWR or React Query for client-side data fetching with stale-while-revalidate pattern.

### Remote Agent Communication

Two methods for communicating with the Claude Code agent remotely:

**Method 1: Claude Code Remote Control (built-in)**
- Run `/rc` inside a Claude Code session or start with `claude remote-control`.
- Gets a URL and QR code. Open on phone, tablet, or any browser.
- Full local environment stays available. Code never leaves your machine.
- Best for: monitoring running sessions, approving actions, giving quick instructions.

**Method 2: Claude-Code-Remote (open source, for async work)**
- GitHub: github.com/JessyTsui/Claude-Code-Remote
- Control Claude Code remotely via email, Discord, or Telegram.
- Start tasks locally, receive notifications when Claude completes them, send new commands by replying to emails.
- Best for: truly async work — send a task before bed, wake up to results.

**Method 3: GitHub Issues workflow**
- Create a GitHub issue labeled `claude-task` with the task description.
- A GitHub Action triggers Claude Code to pick up the issue, work on it, and create a PR.
- You review and merge the PR from your phone.
- Best for: structured task assignment with full audit trail.

### Supabase Realtime Configuration

Several features require Supabase Realtime:
- **"X people viewing this listing"** — Use Supabase Presence on a channel per listing page. Track connected users.
- **Homepage activity ticker** — Use Supabase Broadcast to push anonymized events (new save, new listing, price drop) to all connected homepage viewers.
- **Notification delivery** — Use Postgres Changes on the `notification_queue` table to push real-time notifications to logged-in users.
- **Enable Realtime** on these tables in Supabase dashboard: `user_activities`, `notification_queue`, `listings` (for status changes).

---

## 6. Data Architecture & Geographic Hierarchy

### Geographic Hierarchy

International > Nation > State > City > Neighborhood > Community (Subdivision) > Listing

- **Community** is what the MLS calls a subdivision. We always call them **communities**. Key communities in Central Oregon include Tetherow, Crosswater, Caldera Springs, Pronghorn, Vandevert Ranch.
- **Listing** is the individual property record. Multiple listings at the same address are grouped under a single property record with each listing as a history entry.
- Geo hierarchy, URL architecture, and admin geo/neighborhoods already implemented (Priority 3).

### Database Design

- Supabase Pro plan (PostgreSQL). Single project for Ryan Realty.
- Every entity has unique ID, slug for URL routing, SEO metadata (title, description, OG image).
- Address-based deduplication across listings.
- All Spark API fields stored, even if not immediately displayed.

### URL Structure

Follow SEO best practices. Recommended structure uses clean, geographic, keyword-rich URLs:

- Listings: `/homes/bend-or/tetherow/19496-tumalo-reservoir-rd` (city-state/community/address-slug)
- Communities: `/communities/tetherow`
- Neighborhoods: `/neighborhoods/northwest-bend`
- Cities: `/cities/bend-or`
- Brokers: `/brokers/matt-ryan`
- Blog: `/blog/post-slug`
- Reports: `/reports/report-slug`

All URLs are lowercase, hyphenated, and include geographic context for SEO. No IDs in URLs. Canonical tags on every page.

### Pre-computed Data

All calculated display data (estimated value, days on market, price per sqft, monthly payments, community averages) is pre-computed and stored. Market stats run after each sync (Section 33).

### Database Schema Reference (Key Tables)

The following are the critical tables and their relationships. Every table has `id` (uuid PK), `created_at`, and `updated_at` timestamps.

**Core Data:**
- `properties` — Address-deduplicated. One row per physical property. Columns: address, city, state, zip, county, community_id, neighborhood_id, lat, lng (PostGIS geography point for radius queries), parcel_number. A property may have many listings.
- `listings` — One row per MLS listing event. FK to properties. Columns: `listing_id` (text, the MLS ListingKey from Spark), `property_id` uuid FK, `status` (active/pending/closed/final), `list_price`, `original_list_price`, `sold_price`, `list_date`, `sold_date`, `beds_total` integer, `baths_full` integer, `baths_partial` integer, `living_area` numeric (sq ft), `lot_size_sqft` numeric, `year_built` integer, `stories` integer, `property_type` text, `style` text, `description` text, `broker_id` uuid FK (nullable, set by association engine — see Section 20), `association_type` text DEFAULT 'auto', `raw_data` JSONB (all Spark API fields not mapped to explicit columns). **Field name canonical reference:** use `listing_id` (not `mls_number`), `beds_total` (not `beds`), `living_area` (not `sqft`), `lot_size_sqft` (not `lot_sqft`). See Appendix A.5 for the full verified mapping.
- `status_history` — Tracks every status change per listing with timestamp.
- `price_history` — Tracks every price change per listing with timestamp, old price, new price, % change.
- `listing_photos` — FK to listings. photo_url, cdn_url, sort_order, classification (exterior_front, interior_kitchen, etc from Priority 1 pipeline), is_hero boolean.
- `listing_agents` — FK to listings. agent_name, agent_phone, agent_email, agent_license_number, agent_mls_id, office_name, office_phone. Used for broker-listing association.

**Geographic Hierarchy:**
- `communities` — name, slug, description, hero_image_url, hero_video_url, boundary_geojson (PostGIS), is_resort boolean, resort_content JSONB, seo_title, seo_description, og_image_url.
- `neighborhoods` — name, slug, description, hero_image_url, city_id FK, boundary_geojson.
- `cities` — name, slug, state, description, hero_image_url, boundary_geojson.

**Engagement & Social:**
- `engagement_metrics` — listing_id FK, view_count, like_count, save_count, share_count. Updated near real-time.
- `user_activities` — user_id FK (nullable for anonymous), visitor_cookie_id, activity_type (view/save/like/share/search/click/chat), entity_type (listing/community/city/broker/blog), entity_id, metadata JSONB, created_at. This is the master activity log.
- `trending_scores` — entity_type, entity_id, score float, badges JSONB (hot, trending, new, price_drop, etc), computed_at. Updated every 15-30 minutes by background job.

**Valuation & CMA:**
- `valuations` — property_id FK, estimated_value, value_low, value_high, confidence (high/medium/low), comp_count, methodology_version, computed_at.
- `valuation_comps` — valuation_id FK, comp_listing_id FK, comp_address, comp_sold_price, comp_sold_date, comp_sqft, adjustment_amount, adjustment_reason, distance_miles, similarity_score.

**Reporting:**
- `reporting_cache` — geo_type (city/neighborhood/community), geo_id, geo_name, period_type (monthly/quarterly/annual), period_start, period_end, metrics JSONB containing: median_list_price, median_sold_price, avg_price_per_sqft, active_count, new_count, pending_count, closed_count, avg_dom, median_dom, absorption_rate_months, price_change_count, avg_price_change_pct, list_to_sale_ratio, yoy_price_change_pct, yoy_volume_change_pct, inventory_months, total_sales_volume, avg_sold_price, min_sold_price, max_sold_price. Unique on (geo_type, geo_id, period_type, period_start).
- `broker_stats` — broker_id FK, period_type, period_start, period_end, metrics JSONB: active_count, closed_count, total_volume, avg_sale_price, avg_dom, list_to_sale_ratio, lead_count, lead_conversion_rate, avg_response_time_minutes.

**Users & Auth:**
- `users` — Supabase Auth. Extended profile: role (super_admin/broker_admin/broker/viewer), buyer_preferences JSONB (price_range, beds, baths, communities, down_payment_pct, credit_score, interest_rate), notification_preferences JSONB.
- `saved_listings` — user_id FK, listing_id FK, collection_name, saved_at.
- `saved_searches` — user_id FK, search_name, filters JSONB, notification_frequency (instant/daily/weekly/off), last_notified_at.
- `shared_collections` — id, creator_user_id FK, slug (for public URL), listing_ids JSONB array, personal_message, created_at, view_count.

**CRM & Email:**
- `fub_contacts_cache` — fub_id, broker_id FK (assigned agent), name, email, phone, tags, stage, lead_score, source, last_activity_at, synced_at.
- `email_campaigns` — fub_campaign_id, template_type, subject, sent_count, open_count, click_count, created_at, sent_at.

**AI & Content:**
- `ai_content` — entity_type, entity_id, content_type (description/faq/supplement), content_text, status (draft/approved/published), generated_at, approved_by, approved_at.
- `agent_insights` — insight_type, title, description, priority (high/medium/low), status (pending/approved/dismissed/implemented), data JSONB, created_at.

**Third Party Cache:**
- `listing_schools` — listing_id FK, school data JSONB from SchoolDigger, fetched_at.
- `listing_amenities` — listing_id FK, amenities JSONB from Google Places, fetched_at.
- `census_data` — geo_key (zip or tract), demographics JSONB from Census ACS, fetched_at.
- `reviews` — source (zillow/realtor/yelp/google), broker_id FK (nullable), rating, text, reviewer_name, review_date, synced_at.

**Brokers:**
```sql
CREATE TABLE brokers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  display_name text,
  email text NOT NULL,
  phone text,
  state_license text,
  mls_id text,
  title text,
  designations text[],
  years_experience integer,
  bio text,
  tagline text,
  headshot_url text,
  specialties text[],
  service_area_communities text[],
  social_instagram text,
  social_facebook text,
  social_linkedin text,
  social_x text,
  social_tiktok text,
  social_youtube text,
  social_pinterest text,
  meta_oauth_token text,
  meta_oauth_expires_at timestamptz,
  zillow_agent_id text,
  realtor_profile_id text,
  yelp_business_id text,
  google_business_profile_id text,
  default_hashtags text[],
  fub_contact_id text,
  show_stats boolean DEFAULT true,
  is_active boolean DEFAULT true,
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Open Houses & RSVPs:**
```sql
CREATE TABLE open_house_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  open_house_id uuid NOT NULL REFERENCES open_houses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  reminder_sent_24h boolean DEFAULT false,
  reminder_sent_1h boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Comparison Tray:**
```sql
CREATE TABLE user_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_cookie text,  -- for anonymous users; NULL if authenticated
  listing_ids uuid[] NOT NULL DEFAULT '{}',  -- max 4 elements enforced at app layer
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- Index for fast lookups
CREATE INDEX idx_user_comparisons_user ON user_comparisons(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_user_comparisons_session ON user_comparisons(session_cookie) WHERE session_cookie IS NOT NULL;
```

**Web Push Subscriptions:**
```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

**Site Settings / Feature Flags:**
```sql
CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
-- Seed rows on first-run:
-- ('first_run_complete', 'false')
-- ('current_mortgage_rate', '{"rate": 7.0, "source": "default", "updated_at": null}')
-- ('feature_flags', '{}')
```

**Page Images (Unsplash / Admin Uploads):**
```sql
CREATE TABLE page_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,  -- 'community', 'city', 'neighborhood', 'blog', 'broker'
  entity_id uuid NOT NULL,
  image_url text NOT NULL,
  photographer_name text,
  unsplash_profile_url text,
  source text NOT NULL DEFAULT 'unsplash',  -- 'unsplash', 'upload', 'ai'
  created_at timestamptz DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);
```

**Background Job Runs (referenced by error handling):**
```sql
CREATE TABLE job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'running',  -- 'running', 'completed', 'failed'
  records_processed integer DEFAULT 0,
  errors jsonb DEFAULT '[]',
  CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed'))
);
CREATE INDEX idx_job_runs_name_started ON job_runs(job_name, started_at DESC);
```

**MLS Members & Offices (from Spark API member data):**
```sql
CREATE TABLE mls_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_key text UNIQUE NOT NULL,
  member_mls_id text,
  first_name text,
  last_name text,
  email text,
  phone text,
  office_mls_id text,
  state_license text,
  synced_at timestamptz DEFAULT now()
);

CREATE TABLE mls_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_key text UNIQUE NOT NULL,
  office_mls_id text,
  office_name text,
  phone text,
  address text,
  synced_at timestamptz DEFAULT now()
);
```

**ARYEO Listing Enhancements:**
```sql
CREATE TABLE listing_enhancements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  aryeo_url text NOT NULL,
  aryeo_uuid text,
  photographer_subdomain text,
  import_status text DEFAULT 'pending',  -- 'pending', 'imported', 'failed', 'auth_required'
  imported_at timestamptz,
  media_count integer DEFAULT 0,
  raw_scrape_response jsonb,  -- stored for debugging; contains raw HTML structure
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(listing_id)
);
```

**Social Post Drafts:**
```sql
CREATE TABLE social_post_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text,  -- 'listing', 'community', 'blog', 'open_house', 'market_report'
  entity_id uuid,
  platform text NOT NULL,  -- 'instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'pinterest'
  caption text,
  image_url text,
  hashtags text[],
  status text DEFAULT 'draft',  -- 'draft', 'approved', 'published', 'rejected'
  created_by uuid REFERENCES brokers(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  published_at timestamptz,
  rejection_reason text
);
```

**Report Schedules:**
```sql
CREATE TABLE report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,  -- 'market_stats', 'broker_performance', 'lead_summary'
  geo_scope jsonb,  -- e.g., {"type": "community", "id": "uuid"}
  time_period text,  -- 'monthly', 'quarterly'
  frequency text NOT NULL,  -- 'weekly', 'monthly', 'quarterly'
  delivery_time time DEFAULT '08:00',
  distribution_list jsonb DEFAULT '[]',  -- array of email addresses
  created_by uuid REFERENCES brokers(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**URL Redirects:**
```sql
CREATE TABLE redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_path text UNIQUE NOT NULL,
  new_path text NOT NULL,
  status_code integer DEFAULT 301,
  hit_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**AI Content Queue (for review-before-publish workflow):**
```sql
CREATE TABLE ai_content_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,  -- 'listing', 'community', 'city', 'blog'
  entity_id uuid NOT NULL,
  content_type text NOT NULL,  -- 'description', 'faq', 'blog_post', 'social_caption', 'seo_meta'
  draft_text text NOT NULL,
  status text DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'published'
  generated_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES brokers(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text
);
```

**Cookie Consent Records:**
```sql
CREATE TABLE cookie_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_cookie_id text NOT NULL UNIQUE,
  essential boolean DEFAULT true,
  analytics boolean DEFAULT false,
  marketing boolean DEFAULT false,
  personalization boolean DEFAULT false,
  consented_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**AI Chat Sessions:**
```sql
CREATE TABLE ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_cookie_id text,
  messages jsonb DEFAULT '[]',  -- array of {role, content, timestamp}
  listing_context jsonb,  -- injected listing data when chat opened on a listing page
  community_context jsonb,
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**PostGIS requirement:** The `properties` table uses PostGIS geography type for lat/lng to enable efficient radius queries (`ST_DWithin`). This is essential for CMA comp searches and "nearby" queries. Supabase Pro supports PostGIS.

### Background Jobs & Scheduled Processes

Every background job in the system is listed here. When building any job, reference this inventory to understand dependencies and avoid conflicts.

| Job | Trigger | Frequency | Dependencies | Writes To |
|---|---|---|---|---|
| Spark API Delta Sync | Cron | Every 2-5 min | None (primary data source) | listings, status_history, price_history, listing_photos, listing_agents |
| Market Stats Computation | After sync completes | Every sync run | Delta sync must complete first | reporting_cache |
| Saved Search Matching | After sync completes | Every sync run | Delta sync must complete first | Triggers Resend notifications, FUB events |
| Estimated Value Computation | Cron | Daily + after new closings detected | Requires recent sales data | valuations, valuation_comps |
| Trending Score Computation | Cron | Every 15-30 min | Reads engagement_metrics, user_activities | trending_scores |
| AI Content Generation | Cron + on-demand | Daily scan for thin content | Requires listing and community data | ai_content |
| AI Optimization Agent | Cron | Daily | Reads GA4 (Analytics Data API), Supabase, codebase | agent_insights |
| Review Aggregation Sync | Cron | Daily | Requires API keys for each platform | reviews |
| FUB Contact Sync | Cron + on-demand | Every 15-30 min | Requires FOLLOWUPBOSS_API_KEY | fub_contacts_cache |
| Walk Score Population | After new listing sync | On new active listings | Requires WALKSCORE_API_KEY | listings (walk/transit/bike score columns) |
| SchoolDigger Population | After new listing sync | On new active listings | Requires SCHOOLDIGGER keys | listing_schools |
| Google Places Amenities | After new listing sync | On new active listings | Requires Google Maps API key | listing_amenities |
| Census Data Refresh | Cron | Monthly | Free API, no key required | census_data |
| Sitemap Regeneration | After sync completes | Every sync run | Requires current listing inventory | /public/sitemap*.xml |
| Image Optimization | On upload/sync | Event-driven | New photos from sync or admin upload | Supabase Storage (multiple sizes) |
| Email Event Reporting | Webhook | Near real-time | Resend webhook delivers events | FUB API (POST /v1/emEvents) |
| Broker Stats Computation | After sync + monthly | After sync for current, monthly for historical | Requires listings and FUB data | broker_stats |
| CMA PDF Pre-Generation | After valuation computation | Daily + on new closings | Requires valuations table, listing photos | Supabase Storage (cached PDFs) |
| Lead Score Decay | Cron | Weekly | Reads user lead scores | users.lead_score, FUB custom field |
| FUB Event Batch Flush | Cron | Every 5 min | Reads batched events queue | FUB API (POST /v1/events) |

**Dependency chain:** Delta Sync > (Market Stats + Saved Search Matching + Sitemap Regen) run in parallel after sync > Walk Score/SchoolDigger/Google Places run for any new listings.

**Error handling:** All jobs log to a `job_runs` table (job_name, started_at, completed_at, status, records_processed, errors JSONB). Failed jobs retry with exponential backoff (1 min, 5 min, 30 min). After 3 failures, the job is marked failed and an alert appears in the admin dashboard.

**Job Monitoring Dashboard (Admin):** Added to the admin sidebar under Settings > Background Jobs. Shows all jobs in a table with: job name, status (running/idle/failed), last run time, next scheduled run, duration of last run, records processed, error count. Failed jobs are highlighted red. Manual "Run Now" button for each job.

---

## 7. Data Syncing Engine (Spark API to Supabase)

The sync engine is the foundation of the entire platform. It pulls listing data from the Spark API (RESO Web API implementation by FBS/FlexMLS for Cascades East Association of Realtors) and stores it in Supabase. This is built within the Next.js application as API routes and background jobs, not a separate service.

### 7.1 Spark API Access Configuration

**Two API endpoints exist (use the correct one):**

- **RESO Web API (standard queries):** `https://sparkapi.com/Reso/OData/Property`
- **Replication endpoint (for bulk data download):** `https://replication.sparkapi.com/Reso/OData/Property`

Replication API keys have special privileges and MUST hit the replication endpoint. Standard API keys MUST hit the standard endpoint. Using the wrong endpoint for your key type will fail.

**Authentication:** Bearer token via API key. Include in the `Authorization` header:
```
Authorization: Bearer {SPARK_API_KEY}
```

**Rate limits (HARD — cannot be exceeded or negotiated):**
- **IDX API keys:** 1,500 requests per 5-minute window
- **VOW / Broker Back Office keys:** 4,000 requests per 5-minute window
- Exceeding the limit returns HTTP 429. The sync engine MUST implement rate limit tracking and backoff.

**Key environment variables:**
- `SPARK_API_BASE_URL` — Base URL for the API (either standard or replication endpoint)
- `SPARK_API_KEY` — Your API key with appropriate role/permissions

### 7.2 Initial Historical Sync (Full Replication)

The first sync downloads ALL listings accessible with the API key. This is approximately 500,000+ records.

**Step 1: Kick off the initial download**

```
GET {SPARK_API_BASE_URL}/Property?$top=1000&$count=true
```

- `$top=1000` — Returns 1,000 records per page (maximum allowed). If timeouts occur, reduce to 500.
- `$count=true` — Returns `@odata.count` in the response showing total records matching the query. Use this to calculate progress percentage.

**Step 2: Paginate through all results**

Two pagination methods (use Method A):

**Method A — `@odata.nextLink` (PREFERRED):**
Each response includes an `@odata.nextLink` URL. Use this URL as-is for the next request. This is the safest method — no risk of duplicates or skipped records.

```javascript
let nextUrl = `${baseUrl}/Property?$top=1000&$count=true`;
while (nextUrl) {
  const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await response.json();
  await processListings(data.value);  // Array of listing objects
  nextUrl = data['@odata.nextLink'] || null;  // null when done
  await saveCheckpoint(nextUrl);  // Resume point
}
```

**Method B — `$skip` parameter (FALLBACK ONLY):**
Increment `$skip` by `$top` value each page. CAUTION: If a new listing enters the system between page requests, you may get duplicates. Only use if `@odata.nextLink` is unavailable.

**Step 3: Expand related data in the same request**

To get photos, virtual tours, rooms, and open houses in a single request (reduces total API calls):
```
GET .../Property?$top=1000&$expand=Media,Rooms,Units,OpenHouse
```

Or for the Spark API v1 endpoint:
```
GET .../v1/listings?_limit=1000&_expand=Photos,Videos,VirtualTours,Rooms,Units,OpenHouses
```

**Step 4: Include custom fields**

Custom fields (MLS-specific, non-RESO fields) are NOT included by default. To get them:
```
GET .../Property?$top=1000&_expand=CustomFields
```

WARNING: This significantly increases payload size. Only request if you need local/MLS-specific data.

**Step 5: Use `$select` to limit fields (RECOMMENDED for performance)**

If you don't need every field, specify only the ones you use:
```
GET .../Property?$top=1000&$select=ListingId,ListingKey,ListPrice,StandardStatus,BedsTotal,BathsFull,...
```

This dramatically reduces payload size and speeds up sync. See Appendix A for the complete list of fields we use.

### 7.3 Checkpoint System (Resumable Sync)

The initial sync will take hours. It MUST survive interruptions (server restart, timeout, rate limit, network error).

**`sync_checkpoints` table:**
```sql
CREATE TABLE sync_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL,        -- 'initial' | 'delta' | 'media' | 'member' | 'office'
  status text NOT NULL,           -- 'running' | 'paused' | 'completed' | 'errored'
  total_count integer,            -- From @odata.count
  processed_count integer DEFAULT 0,
  next_url text,                  -- @odata.nextLink for resume
  last_listing_key text,          -- Last successfully processed ListingKey
  last_modification_ts timestamptz, -- For delta sync: last ModificationTimestamp processed
  started_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_log jsonb DEFAULT '[]',   -- Array of { listing_key, error, timestamp }
  speed_records_per_min float,    -- Running average
  metadata jsonb                  -- Any extra state
);
```

**On startup:** Check for an existing checkpoint with status 'running' or 'paused'. If found, resume from `next_url`. If not found, start fresh.

**On each page:** Update `processed_count`, `next_url`, `last_listing_key`, `updated_at`. This is the resume point.

**On error:** Log the error, increment a retry counter. After 3 retries on the same page, skip to the next page and log the skipped records. Continue — do not stop the entire sync for one bad record.

**On completion:** Set status to 'completed', set `completed_at`.

### 7.4 Processing Each Listing Record

For each listing in the API response, the sync engine does:

**Step 1: Upsert the property record**
- Look up `properties` table by address (dedup). If the address doesn't exist, create a new property.
- If `Latitude` and `Longitude` are available (non-IDX), store as PostGIS geography point.
- If lat/long unavailable, queue for geocoding (Google Geocoding API from the existing Google Maps key).

**Step 2: Upsert the listing record**
- Use `ListingKey` as the unique identifier (NOT `ListingId` — ListingId can be reused across MLS systems, ListingKey is globally unique in Spark).
- Map all Spark API fields to Supabase columns per Appendix A naming.
- Store ALL unmapped fields in `raw_data` JSONB column.
- Set `property_id` FK to the deduped property.

**Step 3: Detect and record status changes**
- Compare incoming `StandardStatus` to stored `standard_status`.
- If different: insert row into `status_history` (listing_id, old_status, new_status, changed_at = `StatusChangeTimestamp`).
- If status changed to 'Closed': record `ClosePrice` and `CloseDate`.

**Step 4: Detect and record price changes**
- Compare incoming `ListPrice` to stored `list_price`.
- If different: insert row into `price_history` (listing_id, old_price, new_price, change_pct, changed_at = `PriceChangeTimestamp`).

**Step 5: Process photos**
- Photos come as an expanded array (from `$expand=Media` or `_expand=Photos`).
- Each photo has a URL, order/sequence number, and caption/description.
- Upsert into `listing_photos` table with `listing_id`, `photo_url`, `sort_order`, `caption`.
- Run through the photo classification pipeline (Priority 1 — already implemented) to determine `classification` (exterior_front, interior_kitchen, etc) and select `is_hero`.
- Generate CDN URLs via image optimization pipeline (multiple sizes, WebP/AVIF).

**Step 6: Process virtual tours and videos**
- `VirtualTourURLUnbranded` → store in `listings.virtual_tour_url`.
- Videos from expanded data → store in `listing_videos` table.

**Step 7: Process agent/office data**
- Extract `ListAgentName`, `ListAgentMlsId`, `ListAgentStateLicense` (non-IDX), `ListOfficeName`, `ListOfficeMlsId`.
- Upsert into `listing_agents` table.
- Check for broker-listing association (Section 20): does `ListAgentMlsId` or `ListAgentStateLicense` match any broker in our `brokers` table? If yes, link the listing.

**Step 8: Process school data from listing**
- `ElementarySchool`, `MiddleOrJuniorSchool`, `HighSchool` are IDX-available.
- Store directly on the listing record. These are MLS-assigned schools.

### 7.5 Incremental Delta Sync (Smart & Lightweight)

After the initial sync completes, the delta sync runs on a recurring schedule (every 2-5 minutes via cron or Inngest). This must be FAST and CHEAP — typically 1-3 API calls per run.

**The key insight:** Once a listing is finalized (Closed and reviewed), it NEVER changes. Of 500,000+ listings in the database, only ~2,000-5,000 are Active or Pending at any given time. The delta sync should ONLY check those.

**Smart delta sync query:**
```
GET .../Property?$filter=ModificationTimestamp gt {window_start} 
  and ModificationTimestamp le {window_end} 
  and (StandardStatus eq 'Active' or StandardStatus eq 'Pending' or StandardStatus eq 'ActiveUnderContract')
  &$top=1000
  &$orderby=ModificationTimestamp asc
  &$select=ListingKey,ListingId,ListPrice,StandardStatus,ModificationTimestamp,StatusChangeTimestamp,
    BedsTotal,BathsFull,BathsHalf,LivingArea,PhotosCount,PhotosChangeTimestamp,...
```

**Why this is fast:**
- The filter restricts to only Active/Pending listings (thousands, not hundreds of thousands).
- The `$select` limits the response to only fields we display or compute from.
- Typical result: 0-50 listings changed in the last 5 minutes. Usually fits in a single API call.
- During slow market hours (nights, weekends): often 0 results. One API call, done.

**But we also need to catch newly-Closed listings:**

A listing that was Active and just went to Closed status will match the filter above because its `ModificationTimestamp` updated AND its `StandardStatus` was recently 'Active'. The API returns it with the NEW status 'Closed'. Our processing step detects the status change and handles finalization.

However, if we're worried about missing edge cases, run a secondary query once per hour:
```
GET .../Property?$filter=StandardStatus eq 'Closed' 
  and StatusChangeTimestamp gt {one_hour_ago}
  &$select=ListingKey,ClosePrice,CloseDate,BuyerAgentName,BuyerAgentMlsId,BuyerOfficeName
  &$top=1000
```
This catches any listings that closed in the last hour and ensures we get their final sale data.

**Delta sync workflow:**
1. Read `last_modification_ts` from the most recent completed delta checkpoint.
2. Set `window_start` = `last_modification_ts`.
3. Set `window_end` = current time minus 1 minute (safety margin for API propagation).
4. Run the primary query (Active/Pending modified in window).
5. Process each listing using Steps 1-8 from Section 7.4.
6. If any listing's status changed to 'Closed', queue it for finalization (Section 7.5b).
7. Save `window_end` as the new `last_modification_ts`.
8. Log: records processed, duration, API calls made.

**Typical delta sync stats:**
- API calls: 1-2 per run
- Records processed: 0-50
- Duration: 2-10 seconds
- Runs: every 2-5 minutes
- Daily API call budget for delta: ~300-800 calls (well within the 1,500 per 5-min limit)

### 7.5b Auto-Finalization of Closed Listings

When a listing status changes to 'Closed', it enters an automatic finalization pipeline. The goal: capture all final data, then mark it so we NEVER waste an API call on it again.

**Finalization steps (automatic, no admin review needed):**

1. **Final comprehensive fetch:** Pull the full listing record one last time with ALL fields (no `$select` restriction) plus `$expand=Media` to get final photos. This ensures we have `ClosePrice`, `CloseDate`, `BuyerAgentName`, `BuyerAgentMlsId`, `BuyerOfficeName`, and any last-minute data corrections.

2. **Verify critical fields are populated:**
   - `ClosePrice` must not be null (if null, flag for retry tomorrow — sometimes close data takes 24-48 hours to populate).
   - `CloseDate` must not be null.
   - If either is null after 7 days of retries, mark as Final anyway with a `finalization_notes` flag.

3. **Compute final metrics:**
   - Calculate actual DOM: `CloseDate - ListingContractDate` (or `CloseDate - OnMarketDate`).
   - Calculate list-to-sale ratio: `ClosePrice / ListPrice`.
   - Calculate price per sqft: `ClosePrice / LivingArea`.
   - Store these computed values directly on the listing record.

4. **Update CMA data:** This closed sale is now a comp for nearby properties. Trigger CMA recomputation for active listings in the same community and within a 1-mile radius.

5. **Update market stats:** This sale affects reporting_cache for the listing's city, neighborhood, and community. Trigger recomputation for those geos.

6. **Set status to 'Final':**
   ```sql
   UPDATE listings 
   SET standard_status = 'Final', 
       finalized_at = now(),
       finalization_notes = 'Auto-finalized with complete data'
   WHERE listing_key = '{key}';
   ```

7. **This listing is now permanently excluded from all future API calls.** The delta sync filter (`StandardStatus eq 'Active' or StandardStatus eq 'Pending'`) will never match it. The hourly Closed check will never match it (its status is now 'Final' in our DB, and it won't appear in the API's Closed results after a few weeks). Zero ongoing cost.

**The math on why this matters:**
- 500,000 total listings. ~490,000 are Closed/Final.
- Without finalization: delta sync might scan modification timestamps across 500,000 records.
- With finalization + smart filtering: delta sync only queries Active/Pending (~2,000-5,000 records).
- API calls per day: ~800 vs potentially thousands. Faster, cheaper, and within rate limits easily.

### 7.6 Stale Data Purge

Listings that are no longer in the API (deleted, expired, withdrawn) must be detected and handled.

**Method:** Periodically (daily), query the API for all Active listing keys:
```
GET .../Property?$filter=StandardStatus eq 'Active'&$select=ListingKey&$top=1000
```

Compare against all listings in Supabase with `standard_status = 'Active'`. Any Supabase listing NOT in the API response has been removed/withdrawn. Update its status to 'Withdrawn' or 'Expired' with a note.

### 7.7 Member and Office Replication

In addition to Property data, replicate the Member and Office resources:

```
GET .../Member?$top=1000
GET .../Office?$top=1000
```

Store in `mls_members` and `mls_offices` tables. This provides a complete directory of agents and brokerages in the MLS, which is used for broker-listing association and the broker directory.

Sync frequency: Daily (agents and offices don't change often).

### 7.8 Media Sync (Photos Separately)

If expanding Media in the Property request causes timeouts (it significantly increases payload), sync photos separately:

```
GET .../Media?$filter=ResourceRecordKey eq '{ListingKey}'&$orderby=Order asc
```

Or batch: after syncing a page of listings, loop through the listing keys and fetch their media. The trade-off is more API calls but smaller payloads.

Photo URLs from the Spark API are CDN-hosted. Store the URL in Supabase but DO NOT download and re-host the images unless necessary. The Spark CDN is fast and reliable. If we need our own CDN for image optimization (WebP, resize), use Next.js Image component with the Spark URL as the source — Next.js handles optimization automatically.

### 7.9 Listing Lifecycle State Machine

```
Active → Pending → Active (bounce back)
Active → Pending → Closed → Final
Active → Withdrawn
Active → Expired
Active → Canceled
```

**State transitions and rules:**
- **Active:** Synced on every delta run. All engagement features enabled.
- **Pending (Under Contract):** Still synced. Displayed on site with "Pending" badge. Engagement features still active.
- **Closed (Sold):** Synced once more comprehensively (ensure ClosePrice, CloseDate, BuyerAgent are captured). Then enters finalization queue.
- **Final:** Automatically marked Final by the finalization pipeline after all data is captured (no admin review required — see Section 7.5b). NEVER synced again. Saves API calls. Still displayed on site for history, comparisons, and CMA comps.
- **Withdrawn / Expired / Canceled:** Marked accordingly. Removed from active search results. Retained in database for historical reporting and prospecting reports.
- **Active (bounce back from Pending):** This happens when a deal falls through. The listing goes back to Active. Status history records the full chain: Active → Pending → Active.

### 7.10 Post-Sync Processing Pipeline (The "Constantly Processing" Engine)

After EVERY delta sync run completes, a processing pipeline fires. This is what keeps all computed data current in real-time. The pipeline is event-driven: the sync engine emits a "sync_completed" event with a payload of which listings changed, and each processor subscribes to that event.

**Pipeline input:** `sync_result` object containing:
```json
{
  "sync_id": "uuid",
  "completed_at": "timestamp",
  "listings_created": ["listing_key_1", ...],
  "listings_updated": ["listing_key_2", ...],
  "listings_status_changed": [
    { "listing_key": "...", "old_status": "Active", "new_status": "Pending" }
  ],
  "listings_price_changed": [
    { "listing_key": "...", "old_price": 750000, "new_price": 725000 }
  ],
  "listings_closed": ["listing_key_3", ...],
  "affected_communities": ["Tetherow", "Crosswater"],
  "affected_cities": ["Bend"],
  "affected_neighborhoods": ["Northwest Bend"],
  "total_processed": 23,
  "duration_ms": 4500
}
```

**Processor 1: Market Stats Recomputation**

Runs for each affected geographic area. Uses a Supabase database function (stored procedure) for speed.

```sql
-- Supabase database function: compute_market_stats
CREATE OR REPLACE FUNCTION compute_market_stats(
  p_geo_type text,        -- 'city' | 'community' | 'neighborhood'
  p_geo_name text,        -- e.g., 'Bend', 'Tetherow'
  p_period_type text,     -- 'monthly' | 'quarterly' | 'annual'
  p_period_start date,
  p_period_end date
) RETURNS void AS $$
DECLARE
  v_stats jsonb;
BEGIN
  SELECT jsonb_build_object(
    'median_list_price', percentile_cont(0.5) WITHIN GROUP (ORDER BY list_price),
    'median_sold_price', percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) 
      FILTER (WHERE standard_status = 'Final' AND close_date BETWEEN p_period_start AND p_period_end),
    'avg_price_per_sqft', AVG(close_price / NULLIF(living_area, 0)) 
      FILTER (WHERE standard_status = 'Final' AND close_date BETWEEN p_period_start AND p_period_end),
    'active_count', COUNT(*) FILTER (WHERE standard_status = 'Active'),
    'pending_count', COUNT(*) FILTER (WHERE standard_status = 'Pending'),
    'closed_count', COUNT(*) FILTER (WHERE standard_status IN ('Closed', 'Final') 
      AND close_date BETWEEN p_period_start AND p_period_end),
    'new_count', COUNT(*) FILTER (WHERE listing_contract_date BETWEEN p_period_start AND p_period_end),
    'avg_dom', AVG(days_on_market) FILTER (WHERE standard_status IN ('Closed', 'Final') 
      AND close_date BETWEEN p_period_start AND p_period_end),
    'median_dom', percentile_cont(0.5) WITHIN GROUP (ORDER BY days_on_market) 
      FILTER (WHERE standard_status IN ('Closed', 'Final') AND close_date BETWEEN p_period_start AND p_period_end),
    'total_sales_volume', SUM(close_price) FILTER (WHERE standard_status IN ('Closed', 'Final') 
      AND close_date BETWEEN p_period_start AND p_period_end),
    'avg_sold_price', AVG(close_price) FILTER (WHERE standard_status IN ('Closed', 'Final') 
      AND close_date BETWEEN p_period_start AND p_period_end),
    'list_to_sale_ratio', AVG(close_price::float / NULLIF(list_price, 0)) 
      FILTER (WHERE standard_status IN ('Closed', 'Final') AND close_date BETWEEN p_period_start AND p_period_end)
  ) INTO v_stats
  FROM listings l
  JOIN properties p ON l.property_id = p.id
  WHERE 
    CASE p_geo_type
      WHEN 'city' THEN p.city = p_geo_name
      WHEN 'community' THEN l.subdivision_name = p_geo_name
      WHEN 'neighborhood' THEN p.neighborhood_id = (SELECT id FROM neighborhoods WHERE name = p_geo_name)
    END;

  -- Compute absorption rate: active listings / avg monthly closings over last 12 months
  v_stats := v_stats || jsonb_build_object(
    'absorption_rate_months', 
    (v_stats->>'active_count')::float / NULLIF(
      (SELECT COUNT(*)::float / 12 FROM listings 
       WHERE standard_status IN ('Closed', 'Final') 
       AND close_date > (p_period_end - interval '12 months')
       AND subdivision_name = p_geo_name), 0)
  );

  -- Upsert into reporting_cache
  INSERT INTO reporting_cache (geo_type, geo_name, period_type, period_start, period_end, metrics, computed_at)
  VALUES (p_geo_type, p_geo_name, p_period_type, p_period_start, p_period_end, v_stats, now())
  ON CONFLICT (geo_type, geo_name, period_type, period_start)
  DO UPDATE SET metrics = v_stats, computed_at = now();
END;
$$ LANGUAGE plpgsql;
```

**After sync, the application calls this function for each affected geo and multiple time periods:**
```javascript
// For each affected community from sync_result
for (const community of syncResult.affected_communities) {
  // Current month
  await supabase.rpc('compute_market_stats', {
    p_geo_type: 'community', p_geo_name: community,
    p_period_type: 'monthly', p_period_start: startOfMonth, p_period_end: today
  });
  // Current quarter
  await supabase.rpc('compute_market_stats', {
    p_geo_type: 'community', p_geo_name: community,
    p_period_type: 'quarterly', p_period_start: startOfQuarter, p_period_end: today
  });
  // Current year
  await supabase.rpc('compute_market_stats', {
    p_geo_type: 'community', p_geo_name: community,
    p_period_type: 'annual', p_period_start: startOfYear, p_period_end: today
  });
}
// Same for affected cities and neighborhoods
```

**This runs in under 2 seconds** because it's a database function operating on indexed data, not pulling data over the network.

**Processor 2: Market Condition Classification**

After market stats are refreshed, determine buyer's/seller's/balanced market for each affected geo:

```sql
CREATE OR REPLACE FUNCTION classify_market_condition(p_geo_type text, p_geo_name text)
RETURNS text AS $$
DECLARE
  v_absorption float;
  v_dom float;
  v_list_to_sale float;
BEGIN
  SELECT 
    (metrics->>'absorption_rate_months')::float,
    (metrics->>'avg_dom')::float,
    (metrics->>'list_to_sale_ratio')::float
  INTO v_absorption, v_dom, v_list_to_sale
  FROM reporting_cache
  WHERE geo_type = p_geo_type AND geo_name = p_geo_name 
    AND period_type = 'monthly'
  ORDER BY period_start DESC LIMIT 1;

  IF v_absorption < 4 AND v_list_to_sale > 0.98 THEN
    RETURN 'sellers_market';
  ELSIF v_absorption > 6 AND v_list_to_sale < 0.96 THEN
    RETURN 'buyers_market';
  ELSE
    RETURN 'balanced';
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Processor 3: Saved Search Matching**

For each new or changed listing, check if it matches any user's saved search:

```javascript
// Get all saved searches that could match changed listings
const savedSearches = await supabase
  .from('saved_searches')
  .select('*')
  .eq('notification_frequency', 'instant')  // Only instant alerts
  .not('is_paused', 'eq', true);

for (const search of savedSearches) {
  const filters = search.filters;  // JSON: { min_price, max_price, beds, community, ... }
  
  for (const listing of syncResult.listings_created) {
    if (matchesFilters(listing, filters)) {
      // Queue notification via Resend
      await queueNotification({
        user_id: search.user_id,
        type: 'saved_search_match',
        listing_id: listing.id,
        search_name: search.search_name,
      });
      // Push event to FUB
      await pushFubEvent('Saved Search Match', search.user_id, listing);
    }
  }
}
```

Daily and weekly digest notifications are handled by a separate scheduled job that batches matches.

**Processor 4: Price Drop Notifications**

For each listing with a price change, notify users who saved that listing:

```javascript
for (const change of syncResult.listings_price_changed) {
  if (change.new_price < change.old_price) {
    // Find all users who saved this listing
    const savedBy = await supabase
      .from('saved_listings')
      .select('user_id')
      .eq('listing_id', change.listing_key);
    
    for (const { user_id } of savedBy) {
      await queueNotification({
        user_id,
        type: 'price_drop',
        listing_id: change.listing_key,
        old_price: change.old_price,
        new_price: change.new_price,
        drop_amount: change.old_price - change.new_price,
        drop_percent: ((change.old_price - change.new_price) / change.old_price * 100).toFixed(1)
      });
    }
  }
}
```

**Processor 5: Status Change Notifications**

If a saved listing goes Pending or Closed, notify the user:

```javascript
for (const change of syncResult.listings_status_changed) {
  const savedBy = await supabase
    .from('saved_listings')
    .select('user_id')
    .eq('listing_id', change.listing_key);
  
  for (const { user_id } of savedBy) {
    await queueNotification({
      user_id,
      type: 'status_change',
      listing_id: change.listing_key,
      old_status: change.old_status,
      new_status: change.new_status
    });

    // If their saved listing just went Pending, also suggest similar listings
    if (change.new_status === 'Pending') {
      const similar = await findSimilarListings(change.listing_key, 5);
      await queueNotification({
        user_id,
        type: 'similar_suggestions',
        original_listing_id: change.listing_key,
        suggested_listings: similar
      });
    }
  }
}
```

**Processor 6: CMA Recomputation (on new closings only)**

Only fires when listings_closed is non-empty. New sales data means our estimated values may need updating:

```javascript
if (syncResult.listings_closed.length > 0) {
  for (const closedKey of syncResult.listings_closed) {
    const closedListing = await getListingByKey(closedKey);
    
    // Find active listings in the same community
    const nearbyActive = await supabase
      .from('listings')
      .select('id, listing_key')
      .eq('subdivision_name', closedListing.subdivision_name)
      .eq('standard_status', 'Active');
    
    // Also find active listings within 1 mile (PostGIS)
    const radiusActive = await supabase.rpc('find_listings_within_radius', {
      p_lat: closedListing.latitude,
      p_lng: closedListing.longitude,
      p_radius_miles: 1.0,
      p_status: 'Active'
    });
    
    // Combine and deduplicate
    const toRecompute = [...new Set([...nearbyActive, ...radiusActive].map(l => l.id))];
    
    // Recompute CMA for each (this calls the CMA stored procedure from Section 10)
    for (const listingId of toRecompute) {
      await supabase.rpc('compute_cma', { p_property_id: listingId });
    }
    
    // Also regenerate the cached CMA PDF for these listings
    for (const listingId of toRecompute) {
      await queueJob('generate_cma_pdf', { listing_id: listingId });
    }
  }
}
```

**Processor 7: Trending Score Update**

Recalculate trending badges for affected listings based on fresh engagement data:

```sql
CREATE OR REPLACE FUNCTION update_trending_scores() RETURNS void AS $$
BEGIN
  -- Hot: engagement velocity 2x+ average in last 48 hours
  UPDATE trending_scores ts SET
    score = subq.velocity_score,
    badges = jsonb_build_object(
      'hot', subq.velocity_score > 2.0,
      'trending', subq.velocity_score > 1.5,
      'new', subq.hours_since_listed < 48,
      'price_drop', subq.has_recent_price_drop
    ),
    computed_at = now()
  FROM (
    SELECT 
      l.id as listing_id,
      COALESCE(
        (SELECT COUNT(*) FROM user_activities 
         WHERE entity_id = l.id::text AND entity_type = 'listing' 
         AND created_at > now() - interval '48 hours')::float /
        NULLIF((SELECT AVG(cnt) FROM (
          SELECT COUNT(*) as cnt FROM user_activities 
          WHERE entity_type = 'listing' AND created_at > now() - interval '48 hours'
          GROUP BY entity_id
        ) avg_q), 0),
        0
      ) as velocity_score,
      EXTRACT(EPOCH FROM (now() - l.listing_contract_date)) / 3600 as hours_since_listed,
      EXISTS(SELECT 1 FROM price_history WHERE listing_id = l.id 
        AND new_price < old_price AND changed_at > now() - interval '7 days') as has_recent_price_drop
    FROM listings l
    WHERE l.standard_status IN ('Active', 'Pending')
  ) subq
  WHERE ts.entity_id = subq.listing_id::text AND ts.entity_type = 'listing';
END;
$$ LANGUAGE plpgsql;
```

**Processor 8: Sitemap Regeneration**

Update XML sitemaps with any new/changed listing URLs:

```javascript
// Only regenerate if listings were created or had significant changes
if (syncResult.listings_created.length > 0 || syncResult.listings_status_changed.length > 0) {
  await regenerateListingSitemap();  // Writes to /public/sitemap-listings.xml
  await regenerateCommunitySitemap(); // If new communities appeared
  await pingSearchEngines();  // Notify Google/Bing of sitemap update
}
```

**Pipeline execution order and parallelism:**

```
Sync completes
  ↓
[PARALLEL GROUP 1 - Independent processors]
  ├── Processor 1: Market Stats Recomputation
  ├── Processor 3: Saved Search Matching  
  ├── Processor 4: Price Drop Notifications
  └── Processor 5: Status Change Notifications
  ↓ (wait for Group 1 to complete)
[PARALLEL GROUP 2 - Depends on Group 1]
  ├── Processor 2: Market Condition Classification (needs fresh market stats)
  ├── Processor 6: CMA Recomputation (only if closings)
  └── Processor 7: Trending Score Update
  ↓ (wait for Group 2)
[GROUP 3]
  └── Processor 8: Sitemap Regeneration
```

**Total pipeline time for a typical delta sync:**
- Group 1: ~1-3 seconds (database functions are fast)
- Group 2: ~2-5 seconds (CMA recomputation is the slowest if there are new closings)
- Group 3: ~1 second
- **Total: 4-9 seconds after a typical delta sync**

This means that within 10-15 seconds of a listing changing in the MLS, all of our reporting, notifications, CMAs, trending scores, and sitemaps are updated. That's real-time.

### 7.10b Notification Queue

All notifications generated by processors 3-5 go into a `notification_queue` table:

```sql
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  notification_type text NOT NULL,  -- saved_search_match, price_drop, status_change, similar_suggestions
  payload jsonb NOT NULL,           -- All context needed to render the notification
  channel text NOT NULL,            -- 'email' | 'push' | 'in_app'
  status text DEFAULT 'pending',    -- pending, sent, failed, skipped
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  error text
);
```

A separate background job processes this queue every 30 seconds:
- For 'instant' frequency users: send immediately via Resend.
- For 'daily' frequency: batch all pending notifications, send once per day at the user's preferred time (stored in `users.notification_preferences.digest_time`, default `08:00`). **Daily digest email format:**
  - Subject: `Your Daily Update from Ryan Realty — [Day, Month Date]`
  - Sections grouped by notification type:
    - **Price Drops** (price_drop notifications) — shows up to 5 listings with price drop amount and new price.
    - **New Matches** (saved_search_match notifications) — shows up to 5 listings matching their saved searches.
    - **Status Changes** (status_change notifications) — shows up to 5 listings that changed status.
  - Each listing shown as a compact card: hero photo, price, beds/baths/sqft, address, community, link to listing.
  - If a category has more than 5 items, show "View X more →" link to the relevant filtered page on the site.
  - Sections with zero items are hidden entirely — don't show an empty "Status Changes" section if there are none.
  - Footer: "Manage your notification preferences" link → `/account/notifications`.
- For 'weekly' frequency: batch and send once per week (day of week configurable, default Monday at 8:00 AM). Same format as daily digest.
- Deduplication: if the same listing appears in multiple notifications for the same user, consolidate into one. If a listing had both a price drop and a status change, include it in both sections but de-duplicate within each section.

### 7.10c Database Indexes for Processing Speed

The entire pipeline depends on fast queries. These indexes are critical:

```sql
-- Delta sync: find modified listings quickly
CREATE INDEX idx_listings_modification_ts ON listings(modification_timestamp);
CREATE INDEX idx_listings_standard_status ON listings(standard_status);
CREATE INDEX idx_listings_status_modified ON listings(standard_status, modification_timestamp);

-- Market stats: aggregate by geography
CREATE INDEX idx_listings_subdivision ON listings(subdivision_name);
CREATE INDEX idx_listings_city ON properties(city);
CREATE INDEX idx_listings_close_date ON listings(close_date) WHERE standard_status IN ('Closed', 'Final');

-- CMA: find nearby comps using PostGIS
CREATE INDEX idx_properties_geo ON properties USING GIST(geography);

-- Saved search matching: find active saved searches quickly
CREATE INDEX idx_saved_searches_active ON saved_searches(notification_frequency) WHERE is_paused = false;

-- Notification queue: process pending notifications
CREATE INDEX idx_notifications_pending ON notification_queue(status, created_at) WHERE status = 'pending';

-- Engagement: trending score computation
CREATE INDEX idx_user_activities_recent ON user_activities(entity_type, entity_id, created_at) 
  WHERE created_at > now() - interval '48 hours';

-- Price history: recent drops
CREATE INDEX idx_price_history_recent ON price_history(listing_id, changed_at);
```

### 7.11 Sync Status Dashboard (Admin)

Admin backend shows real-time sync status at Settings > Background Jobs > Data Sync. This is a full-page dashboard, not a small widget.

**Section 1: Current Sync Status**
- **Status indicator:** Running (green pulse animation), Paused (yellow), Errored (red), Idle (gray), Completed (green check)
- **Progress bar:** X of Y records (from `@odata.count`) with percentage. Only visible during initial sync.
- **Speed:** Records/minute (rolling average over last 5 minutes)
- **Timing:** Started at, elapsed time, estimated remaining
- **Controls:** Start Initial Sync, Pause, Resume, Force Full Resync, Run Delta Now buttons

**Section 2: Database Summary (Always Visible)**
- **Total listings in database:** Count with breakdown by status:
  - Active: X listings
  - Pending: X listings
  - Closed: X listings
  - Final (never re-synced): X listings
  - Withdrawn/Expired/Canceled: X listings
- **Total properties (address-deduplicated):** X
- **Total photos stored:** X
- **Total communities/subdivisions:** X
- **Total cities:** X
- **Total agents/offices in MLS data:** X
- **Database size:** X MB (from Supabase dashboard API if available)
- **Last updated:** Timestamp of the most recent delta sync completion

**Section 3: Delta Sync History (Last 50 Runs)**
- Table showing each delta sync run: start time, duration, records processed, new listings, price changes, status changes, errors, API calls used
- Click any row to see details (which listings changed, what changed on each)
- Chart: records processed per sync run over the last 24 hours (should be a small, stable number)

**Section 4: Sync Health Metrics**
- **Average delta sync duration:** X seconds (target: under 15 seconds)
- **Average records per delta sync:** X (typically 0-50)
- **API calls today:** X of Y daily budget
- **Rate limit events today:** X (should be 0)
- **Errors today:** X with link to error log
- **Finalized listings today:** X (newly closed and auto-finalized)

**Section 5: Error Log**
- Expandable list of errors with: listing key, error message, timestamp, retry count, status (retrying/skipped/resolved)
- Filter by: date range, error type, listing key
- Bulk actions: retry all failed, dismiss resolved

**Section 6: Rate Limit Monitor**
- Current request count / limit for the active 5-minute window
- Visual gauge (green/yellow/red based on usage percentage)
- Time until window reset

### 7.12 Rate Limit Management

The sync engine MUST respect the 1,500 or 4,000 requests per 5-minute window.

**Implementation:**
- Track request count in memory (or Redis if available) with a 5-minute sliding window.
- Before each request, check: would this request exceed 90% of the limit? If yes, sleep until the window resets.
- On HTTP 429 response: immediately sleep for 60 seconds, then retry. Log the event.
- Log request counts per window in `sync_checkpoints.metadata` for monitoring.

**Budget calculation:**
- At 1,000 records per request, and 1,500 requests per 5 minutes: maximum throughput = 1,500,000 records per 5 minutes for initial sync.
- For delta sync (typically 0-100 records per run): 1 request suffices. Well within limits.
- The rate limit is NOT a concern for normal operation. It only matters during initial sync and media-heavy operations.

### 7.13 Error Handling & Resilience

| Error | Handling |
|---|---|
| HTTP 429 (Rate Limit) | Sleep 60s, retry, log |
| HTTP 401 (Auth Failed) | Stop sync, alert admin, do not retry (key may be revoked) |
| HTTP 500 (Server Error) | Retry 3x with exponential backoff (5s, 30s, 120s), then skip page and continue |
| Network timeout | Retry 3x with backoff, then skip and continue |
| Invalid listing data (parse error) | Log the raw response, skip the listing, continue |
| Supabase write failure | Retry 2x, then queue for manual review |
| Duplicate ListingKey | Upsert (update existing record) |
| Missing required field (e.g., no ListPrice) | Store with null, flag for review |

**Never stop the entire sync for a single bad record.** Log it, skip it, continue. The admin dashboard shows all errors for manual review.

---

## 8. Listing Data Model & Display

**Baseline reference: Zillow listing detail page.** Every element described below should meet or exceed what Zillow shows. When building this page, always reference Zillow's current listing page as the minimum standard, then improve on it.

### Data Captured Per Listing

Every Spark API field stored. Core display data includes:

**Property:** MLS number, address, city, state, zip, county, community, neighborhood, status with full history, prices (list, original, sold, per sqft), price change history, DOM, beds, baths, sqft, lot, year built, stories, type, style, garage, utilities, tax info (10-15 years of history), HOA info, legal description, zoning.

**Agent/Office:** Listing agent (name, phone, email, photo, bio, **Oregon license number**, **MLS ID**), office, buyer agent/office, co-listing agent. License numbers are critical for broker-listing association (Section 20).

**Media:** All photos via CDN (classified and hero-selected per Priority 1). Virtual tour URL. Video URL (standard URL format). Floor plans (including 3D floor plans). ARYEO enhanced media if available (Section 9).

**Features:** Interior/exterior, appliances, room breakdown, public/private remarks.

**Pre-computed:** Monthly payment, estimated value, price per sqft, DOM, engagement metrics, price per sqft vs community average.

### Listing Page Layout (Top to Bottom)

#### 1. Hero Media Collage

A Zillow-style collage at the top of the page. Not just a photo carousel — a visual grid/collage that includes:
- Main hero photo (largest, classified as best exterior or best interior shot)
- 3-4 supporting photos in smaller tiles
- 3D floor plan thumbnail (if available) with a "View Floor Plan" overlay
- Video thumbnail (if video URL exists) with a play button overlay
- Click any image to open the full-screen gallery with swipe/zoom/slideshow
- Photo count badge (e.g., "1/42")
- Enhanced listing badge if ARYEO media exists

#### 2. Core Property Information

Immediately below the collage:
- **Price** (large, prominent)
- **Estimated monthly payment** displayed next to or below the price. This looks clickable (subtle underline, color, or icon). When clicked, it expands to show the full payment breakdown and allows the user to customize inputs (see Payment Calculator section below).
- **Beds, Baths, Sqft** in a clean stats row
- **Full address** with link to map section
- **Status badge** (Active, Pending, Sold) with days on market

#### 3. Call to Action Section

Directly below the core info:
- **"Request a Tour"** button (primary CTA)
- **"Contact Agent"** button that expands to show four options: Email, Text, Call, Send Message
- Every button click is tracked and pushed to Follow Up Boss with full context (listing ID, MLS number, address, user info if known)
- Social proof bar: views count, likes count, saves count, shares count (Instagram-style)
- Like button (heart), Save button (bookmark), Share button
- **Micro-interaction animations:** Like button shows a heart-fill animation with a subtle pulse (Instagram-style double-tap heart). Save button shows a bookmark-fill animation. These tiny dopamine hits encourage repeated interaction.
- "X people are viewing this right now" indicator (live count from Supabase Realtime presence or session tracking)

#### 3b. Sticky Engagement Bar (Scroll-Triggered)

As the user scrolls past the hero and CTA section, a **compact sticky bar** appears fixed at the top of the viewport:
- Listing photo thumbnail (small, left side)
- Price and address (center)
- CTA buttons: Request Tour, Contact, Save, Share (right side)
- The bar ensures CTAs are always accessible no matter how far the user scrolls. This is a proven conversion optimization pattern.
- The bar animates in smoothly (slide down) and out when the user scrolls back to the top.

#### 4. Property Highlights (Visual Icons Row)

A horizontal row of visual highlight chips with icons:
- Property type (e.g., Single Family Residence icon)
- Lot size / acres
- Price per square foot
- HOA (monthly amount or "No HOA")
- Year built
- Garage spaces
- Any other standout features the data supports

These are the quick-scan visual indicators that let buyers assess the property in seconds. Use clean icons. Match or exceed Zillow's visual treatment.

#### 5. Property Description

Full MLS remarks (public). Plus AI-generated contextual content about the community, neighborhood, and city to ensure no page has thin content. This supplementary content is generated by the AI content engine and stored per listing. Every listing page should have at minimum 500+ words of unique, relevant content combining the MLS remarks and AI-generated context.

**"Did You Know?" callout boxes:** Within the description and supplementary content, the AI inserts 2-3 highlighted callout boxes with interesting facts about the community or area. Example: "Did you know? Homes in Tetherow have appreciated 18% over the last 3 years." or "The Deschutes River Trail is just 0.5 miles from this home." These break up long text, add serendipitous value, and increase time on page.

#### 6. Estimated Market Value Section

- **Our estimated value** (single number, prominently displayed)
- **Estimated sales range** (low to high, e.g., "$725,000 - $785,000")
- **10-year price performance graph:** A chart showing both the specific property's history (listing/sale events, tax assessment values over time) overlaid on the community/area average price trend. Dual-line chart with the property in one color and the community trend in another. This gives instant visual context for whether the property has outperformed or underperformed its area.
- **Price per sqft vs community average** comparison (e.g., "This home: $285/sqft | Community avg: $310/sqft")
- **Avg days on market** for this community (e.g., "Homes in Tetherow typically sell in 45 days")
- Confidence indicator (high/medium/low based on comp quality)

**CMA Download CTA (Lead Capture):** Directly below the estimated value and range, a prominent button: **"Download Full Value Report"** with subtext: "See comparable sales, market trends, and detailed analysis." PDF icon. If user is signed in, one-click instant download of the pre-generated CMA PDF. If not signed in, opens sign-in/sign-up modal, then auto-downloads after auth. Every download triggers `CMA Downloaded` event to FUB. Broker alert fires within 60 seconds. This is one of the highest-intent actions on the entire site. See Section 28.3 for the full workflow and CMA display design.

The full CMA methodology stays behind the scenes on the listing page itself. The public sees the number and the download CTA. The detailed comps, adjustments, and methodology are in the downloaded CMA report.

#### 7. Listing Price History

A table showing the full price history for this listing, most recent at top:
- **Date** | **Event** | **Price** | **% Change** | **Price/Sqft**
- Events include: Listed, Price Change (increase or decrease with % and direction indicator), Listing Removed, Relisted, Pending, Sold
- If the address has multiple listing records (listed and sold multiple times), show all of them under a "Listing History for This Address" header

#### 8. Public Tax History

A table showing up to 10-15 years of tax assessment data:
- **Year** | **Property Taxes** | **Tax Assessment**
- Shows the trajectory of taxes and assessed value over time.

**Data source:** Tax history comes from the Spark API `TaxHistory` expanded resource (if available in the MLS data subscription: `$expand=TaxHistory` on the Property endpoint) or from the `TaxAmount` and `TaxYear` fields on the base listing record. Include all years returned by the API. If only the current year's tax data is available, display that single row and note below the table: *"Historical tax data is not available for this property."* Do **not** fabricate or estimate historical tax figures. If no tax data at all is returned by the API, hide this section entirely.

#### 9. Monthly Payment Calculator

The default monthly payment shown on the page is calculated behind the scenes using:
- **Current interest rate** — fetched from the Freddie Mac Primary Mortgage Market Survey (PMMS). The background job `refresh_mortgage_rate` runs weekly (Mondays at 6:00 AM Pacific) and fetches the current 30-year fixed rate from `https://www.freddiemac.com/pmms/docs/PMMS_history.xls` (parse the most recent row). Rate is cached in the `settings` table with key `current_mortgage_rate` as `{"rate": 6.85, "source": "Freddie Mac PMMS", "updated_at": "2026-03-10"}`. **Fallback:** if the weekly fetch fails, use the last cached rate. If no cached rate exists at all (first run), use `7.0` as hardcoded default. Display the rate source below the calculator: *"Rate: 6.85% (Freddie Mac PMMS, updated Mar 10, 2026)"* in 12px muted text.
- 20% down payment assumed
- Property taxes from the listing data
- Homeowner's insurance estimate (based on property value and location)
- HOA fees from listing data
- Mortgage insurance (if applicable based on down payment %)
- Utilities estimate (if data available)
- Principal and interest

When the user clicks the monthly payment display, it expands into a full interactive calculator:
- **Total monthly payment** broken down visually (donut chart or stacked bar) into: Principal & Interest, Property Taxes, Homeowner's Insurance, HOA, Mortgage Insurance (if applicable), Utilities estimate
- Editable inputs: Home price, Down payment ($ and %), Loan term (15/20/30 year), Interest rate, Property tax (pre-filled, editable), Insurance (pre-filled, editable), HOA (pre-filled)
- As the user changes any input, the monthly payment updates live
- If the user is logged in and has buyer preferences saved (down payment %, credit score, interest rate), those values are pre-filled instead of the defaults
- Include every component that goes into a real monthly payment. If there are standard components not listed above, include them.

#### 10. Neighborhood Section

##### Map
- Google Maps embed showing the property location
- Property pin with a thumbnail of the home photo next to it
- Toggle controls at top-left: Lot Lines, Roads, Satellite
- **Street View** button/toggle to switch to Google Street View
- Community boundary overlay if available (Google Places polygon or KML)

##### Getting Around (Walkability)
- Walk Score, Transit Score, Bike Score (from Walk Score API when available)
- Visual score display with descriptive labels (e.g., "Somewhat Walkable", "Bikeable")

##### Nearby Schools
- List of nearby schools with: Name, Grades, Distance, SchoolDigger Rating (when available)
- Sourced from SchoolDigger API

##### Nearby Amenities (Google Places)
- Categorized list of nearby points of interest: grocery, restaurants, parks, medical, fitness, shopping, transit.
- Each shows name, distance, and rating if available.
- Data cached in Supabase per listing from Google Places API (Section 45).

##### Demographics (US Census)
- Key demographic stats for the area: median household income, median age, population density, education levels, commute times.
- Data from US Census ACS (Section 45), displayed as a compact data grid.

#### 11. Recently Sold Nearby

A horizontal slider showing 5 recently sold homes in the area/community:
- Uses the Universal Card (Section 8.1) format
- Shows sold price, sold date, beds, baths, sqft
- Gives buyers comp context right on the listing page

#### 12. Nearby Homes Slider

A horizontal slider of 5 active listings in the same subdivision or neighborhood:
- Universal Card format with like, save, share buttons
- Same visual treatment as cards everywhere else on the site

#### 13. Similar Homes Slider

A horizontal slider of 5 homes that may not be nearby but match on key attributes:
- Similar beds, baths, year built, price range, sqft
- Universal Card format

#### 14. Homes For You Slider (Personalized)

If the user is logged in:
- 5 recommended homes based on browsing history, saved homes, and buyer preferences
- If not logged in, show trending/popular homes instead
- Universal Card format

#### 14b. People Also Viewed

- "People who viewed this home also viewed" — 5 listings based on co-viewing patterns.
- Algorithmically determined from user browsing sessions (users who viewed listing A also viewed listings B, C, D).
- Universal Card format.
- This is a key engagement driver. It keeps people browsing by showing them relevant listings they might not have found through search.

#### 14c. Trending Badges on This Page

All applicable trending badges from Section 24 display on the listing detail page:
- "Hot" badge near the status badge if engagement velocity is above threshold.
- "X people are viewing this right now" near the social proof bar.
- "New" badge if listed within 48 hours.
- "Price Drop" badge with reduction amount if price was reduced in the last 7 days.
- "Back on Market" badge if listing returned to active.
- These are automatic based on data. No manual tagging required.

#### 15. MLS Attribution & Oregon Data Share Compliance

At the bottom of the listing content, before the footer:
- **MLS ID** displayed
- **Listing broker** name and brokerage
- **Listing brokerage** name
- **Oregon Data Share** compliance language. The exact required text from the Oregon Data Share agreement must be included. This typically includes an "All rights reserved" statement, data accuracy disclaimer, and source attribution.
- **Last updated** timestamp showing when the data was last synced

> **IMPORTANT:** Before finalizing listing pages, pull the exact Oregon Data Share required attribution text from your MLS agreement and insert it verbatim here. The AI agent must implement the exact required copy and placement.

#### 16. Nearby Cities Slider

A horizontal slider showing nearby cities:
- City name, hero image (Unsplash), number of active listings, number of new listings, median price
- Universal Card format (city variant)

#### 17. Footer

Standard site footer with full navigation, contact info, social links, legal disclaimers, MLS attribution.

### 8.1 Universal Card Design System

**Critical requirement:** Every card shown anywhere on the site (listing cards, community cards, city cards, neighborhood cards, broker cards) must use a single, consistent card component library. Cards share the same dimensions, border radius, shadow, hover behavior, and interaction patterns. The only thing that changes is the content inside.

**All cards include:**
- Like button (heart) with heart-fill animation on click
- Save button (bookmark) with bookmark-fill animation on click
- Share button
- Compare button (add to comparison tray, see Section 37)
- Consistent sizing across all pages and contexts
- **Video hover-preview:** Any listing card with an associated video shows a subtle play icon. On hover (desktop) or scroll-into-view (mobile), the card's static photo transitions to a 3-5 second silent video preview loop. This is the Netflix thumbnail preview effect. For listings without professional video, the AI video pipeline can generate a Ken Burns slow-zoom micro-video from the best listing photo. Creates a sense of life and motion across the entire site.
- **"New since last visit" badge:** For returning visitors (recognized via cookie or login), listing cards that were not in the database on their last visit show a subtle "NEW" badge. This creates the same "new content" dopamine hit that social media feeds use.
- **"Viewed" indicator:** For logged-in users, cards for listings they have already viewed show a subtle "Viewed" indicator (e.g., slightly dimmed overlay or small checkmark). Helps users track what they've already seen vs what's new. **Time window:** Only apply the "Viewed" badge for listings viewed within the last **90 days** (query: `user_activities WHERE activity_type = 'view' AND entity_type = 'listing' AND entity_id = $listingId AND user_id = $userId AND created_at > now() - interval '90 days'`). Views older than 90 days do not show the badge — this prevents the entire site from appearing "viewed" for long-time users.

**Card variants:**
- **Listing card:** Photo, price, beds/baths/sqft, address, community, status badge, DOM, engagement counts, plus applicable trending badges (hot, new, price drop, trending, back on market, viewing count). See Section 24 for all badge types.
- **Community card:** Hero image, community name, active listing count, median price, avg price/sqft, market temperature badge (🔥/☀️/❄️), price trend arrow.
- **City card:** Hero image, city name, active listings, new listings, median price, market temperature.
- **Neighborhood card:** Hero image, name, listing count, key stats, market temperature.
- **Broker card:** Headshot, name, brokerage, active listing count, review rating, transaction count.

Every card click, like, save, and share is tracked and pushed to analytics and FUB.

### 8.2 SEO & Thin Content Prevention

**Every listing page must have substantial, unique content so search engine bots never see thin pages.** With 500,000+ pages, thin content is an SEO disaster.

For each listing, the AI content engine generates supplementary paragraphs about:
- The community/subdivision the listing is in
- The neighborhood
- The city
- Local amenities, lifestyle, and market context

This AI-generated content is stored per listing in Supabase and rendered on the page below the MLS remarks. It ensures every listing page has 500+ words of unique, relevant, indexable content.

**Bot crawlability:** The entire site must be fully crawlable. Every listing, community, city, and neighborhood page is indexed. Dynamic sitemap includes all pages. No pages behind JavaScript-only rendering that bots cannot see. SSR/SSG ensures content is in the HTML on first load.

**Listings with no photos are excluded from display entirely.** They do not appear in search results, feeds, cards, or sliders. Site elements needing imagery use Unsplash or AI-generated images.

---

## 9. Enhanced Listing Pages (ARYEO Integration & Zillow Showcase Equivalent)

When a broker has an active listing, they can create a premium enhanced page with professional media that goes beyond MLS content. Think Zillow Showcase. This is branded content that brokers invest in (professional photography, video reels, 3D tours, drone footage) that we display to its full potential.

### ARYEO Integration

ARYEO (aryeo.com) is a real estate media delivery platform used by professional photographers. When a photographer delivers content, the broker receives an email containing:

- Property address (used to match to existing listing in Supabase)
- Download center URL (contains all professional photos, videos, floor plans, media)
- Branded property website URL
- Unbranded property website URL
- Interactive content URLs (3D tours, immersive experiences, often hosted on Zillow)
- ARYEO listing UUID

### ARYEO Intake Flow

1. Broker goes to the admin backend and navigates to their active listing.
2. Broker pastes the **ARYEO download center URL** into a designated field.
3. The backend processes the URL:
   - Server-side fetch (Next.js API route) of the ARYEO download center page HTML.
   - **Authentication error (401/403):** ARYEO download center pages are typically publicly accessible via their unique URL. If the server-side fetch returns a 401 or 403 status, show an admin error: "This ARYEO URL requires authentication. Ask your photographer to share a public download center link." Set `listing_enhancements.import_status = 'auth_required'`. Do **not** store photographer credentials.
   - **No media found:** If the fetch returns 200 but zero media links are parsed from the HTML (empty gallery), show admin error: "No media found at this URL. The download center may be empty or the URL format may have changed." Set `import_status = 'failed'` with `error_message = 'no_media_found'`. Store the raw HTML in `listing_enhancements.raw_scrape_response` JSONB for debugging.
   - **Success:** Parse the HTML to extract all media URLs (hi-res photos, video files, drone footage, floor plans, virtual tour links, reels). Download and store all media assets in Supabase Storage or Vercel Blob. Extract branded/unbranded property website URLs and interactive content URLs (3D tours). Set `import_status = 'imported'`, `imported_at = now()`, `media_count = count`.
   - Matches the property address to the existing listing in Supabase.
4. The listing page automatically upgrades to an enhanced view. The `listing_enhancements` record is created/updated for the listing (see Section 6 schema).

### Enhanced Listing Page Content

When ARYEO media exists for a listing, the page displays:

- **Professional photo gallery** replacing or supplementing MLS photos. Higher quality, more angles, better staging shots.
- **Professional video** embedded prominently (walkthrough, drone footage, cinematic reel).
- **3D tour / interactive content** embedded inline (the Zillow immersive experience URLs).
- **Floor plans** if included in the ARYEO delivery.
- **Branded content** that the broker has created for social media (reels, stories, branded videos) uploaded manually.
- A visual indicator that this is an enhanced/premium listing (subtle badge or elevated design treatment).

### Manual Upload Fallback

If no ARYEO delivery exists, brokers can manually upload through the admin backend:

- Additional photos beyond MLS
- Video files (walkthrough, drone, cinematic)
- Reels and social media content (branded videos created for Instagram/TikTok/etc.)
- Floor plans
- Virtual tour URLs
- Any other media

This allows brokers to showcase content that MLS rules do not allow (branded content, social media reels, etc.) on their own platform.

### Scope

- Enhanced media is only available for **active listings** that belong to brokers within the system.
- When a listing closes, the enhanced content remains visible on the listing history page but is no longer editable.
- Each broker can only enhance listings where they are the listing agent (matched by license number per Section 20).

---

## 10. Property Valuation Engine (Estimated Value)

Every active listing gets an estimated value. The public sees the number. The methodology stays behind the scenes.

### Valuation Logic (CMA Best Practices)

Always start with the most accurate data and expand outward:

1. **Same subdivision first.** Look at the most recent closings within the same subdivision/community. This is always the #1 priority and the most accurate data point.
2. **Proximity to recent closings.** After subdivision, look at how close the subject property is to recent comparable sales. Nearest recent closings carry the most weight.
3. **Year built.** Filter comps by similar age. Homes of similar vintage have similar construction quality, systems age, and market appeal.
4. **Proximity radius.** If insufficient comps in the subdivision, expand to quarter-mile, then half-mile, then further.
5. **Standard CMA best practices.** Filter by similar sqft (within 20%), similar beds/baths, similar lot size, similar property type. Weight recent sales more heavily (90 days > 6 months > 12 months). Adjust for differences using price-per-sqft differentials and feature adjustments.
6. **Estimated value** = weighted average of adjusted comps.

This follows the same methodology that professional brokers use for CMAs, with real MLS data that is more accurate than algorithmic estimates from sites that lack direct MLS access. This accuracy is a key differentiator.

This follows the same CMA methodology that brokers use professionally. The full CMA analysis runs behind the scenes. The public only sees the resulting estimated value number with a confidence indicator (high/medium/low based on comp quality and quantity).

### AI-Enhanced Valuation

The AI agent continuously compares estimates to actual sale prices. The model refines weights and factors with every closed transaction.

### Display

- Estimated value shown on listing pages as a single number with confidence indicator.
- No public access to the full CMA breakdown, comp details, or methodology.
- Pre-computed daily or when new sales data arrives.

### CMA On-Demand Engine

The CMA engine is a **Supabase database function** (stored procedure), not application code. This ensures maximum speed. It accepts an address or property_id and returns a full valuation with comps in under 200ms from cache, under 2 seconds if computing fresh.

**How it works technically:**
1. Accept address (or lat/lng from geocoding).
2. Look up the property in `properties` table. Identify community_id.
3. Query `listings` for recent closed sales in the same community (status = 'closed', sold within 12 months), ordered by recency.
4. If fewer than 3 comps found, use PostGIS `ST_DWithin` to expand search radius (0.25 mi, 0.5 mi, 1.0 mi) against `properties.geography`.
5. Filter comps by similarity: year_built within 10 years, sqft within 20%, same property type.
6. Weight by recency: 90-day sales weighted 3x, 6-month weighted 2x, 12-month weighted 1x.
7. Adjust each comp's price by the sqft differential (comp price/sqft * subject sqft, then adjust for feature differences).
8. Compute weighted average = estimated value. Compute range (± 1 standard deviation of adjusted comp prices).
9. Assess confidence: 5+ comps in subdivision = high, 3-4 comps = medium, fewer or wider radius = low.
10. Write result to `valuations` table with all comps to `valuation_comps`.
11. Return instantly.

**CMA Report Generation:**
A full branded CMA report can be generated for ANY address, not just active listings. This is a primary differentiator.

- Broker or user requests a CMA report (from listing page, "What's My Home Worth" page, or admin backend).
- System runs the CMA engine.
- Generates a branded PDF report containing:
  - Subject property details and photo (if available).
  - Estimated value with range and confidence.
  - 6-10 comparable sales, each with: address, photo, sold price, sold date, sqft, beds/baths, adjustments applied, distance from subject.
  - Map showing subject and all comps pinned.
  - Market trends chart for the community/area (from reporting_cache).
  - Methodology explanation in plain language.
  - Broker info, headshot, contact details, and brokerage branding.
- Report is downloadable as PDF and shareable as a unique URL.
- Shared URL is **gated**: requires email to access the full report (lead capture). Showing the estimated value number is ungated, but the full comp details require contact info.
- Every CMA report generation and share is tracked and pushed to FUB.

**No property claim feature.** Homeowners cannot claim or adjust valuations.

---

## 11. AI Features Layer (Search, Chat, Content Generation)

X AI (Grok) is the primary AI provider for all features. All AI API calls are server-side only — the `XAI_API_KEY` is never exposed to the browser. Use streaming responses where response time > 1s.

### 11.1 AI-Powered Natural Language Search

Users search the way they think: "Homes near golf courses under $800K with mountain views."

**Parse-then-query flow:**
1. User types natural language query into the search bar on any page.
2. Client sends `POST /api/ai/search` with body `{ query: string, existingFilters?: object }`.
3. Server calls Grok with a system prompt instructing it to return ONLY a JSON object in this exact shape:
   ```json
   {
     "min_price": 500000,
     "max_price": 800000,
     "beds_min": 3,
     "baths_min": 2,
     "communities": ["Tetherow", "Pronghorn"],
     "amenities": ["golf"],
     "has_mountain_view": true,
     "summary": "3+ bed homes near golf with mountain views under $800K"
   }
   ```
4. Server applies filters to Supabase listings query (same query builder used by structured search).
5. Server returns: `{ results: Listing[], aiSummary: string, appliedFilters: object }`.
6. Client renders results in the standard search grid with an AI summary banner at the top: "Showing homes matching your search: [aiSummary]."

**Caching:** Identical query strings (lowercased, trimmed) are cached in Upstash Redis with a 5-minute TTL. Cache key: `ai-search:{sha256(query)}`.

**Fallback:** If the Grok call fails (timeout, 5xx, or parse error), fall back to a keyword search against `address`, `community`, `city`, and `description` fields using Supabase full-text search (`to_tsvector`). Display a subtle "AI search unavailable, showing keyword results" message.

**Rate limiting:** 60 AI search requests per hour per IP (via Upstash Redis). Return HTTP 429 with message "Search limit reached. Please try again soon." if exceeded.

### 11.2 AI Chat Assistant

Conversational AI on every page. Brand name: **"Ask Ryan"** (configurable in settings later; use this name at build time).

**UI Specifications:**
- **Trigger:** Floating circular button, bottom-right corner, 56px diameter, navy background (#102742), white chat bubble icon. `z-index: 9999`. Hidden on mobile when keyboard is open.
- **Open state (desktop):** Slide-out panel from right edge, 380px wide, full viewport height. Backdrop overlay: `rgba(0,0,0,0.2)`. Slide animation: 250ms ease-out.
- **Open state (mobile):** Full-screen overlay with sticky header showing "Ask Ryan" and a close (X) button.
- **Panel layout:** Header (brand name + close button), scrollable message list, fixed input bar at bottom.
- **Input bar:** Text input (placeholder: "Ask me anything about Bend real estate…"), Send button, character limit 500.
- **Typing indicator:** Three animated dots shown while AI is streaming its response.

**Session & Persistence:**
- Chat sessions stored in `ai_chat_sessions` table: `session_id`, `user_id` (nullable), `messages` JSONB array `[{role, content, timestamp}]`, `listing_context` JSONB, `community_context` JSONB, `message_count` integer.
- Session is created on first message. Session ID stored in `sessionStorage` (not localStorage — resets per browser tab). If user is authenticated, `user_id` is attached.
- On page reload the chat panel opens empty (fresh session). Message history is available in the user's dashboard under "Chat History" if authenticated.

**Context injection:**
- On a listing detail page: inject the full listing object as system context. The AI can answer questions about the specific property.
- On a community/resort/city page: inject community stats and description as system context.
- On other pages: inject the user's saved search preferences if authenticated.
- System prompt template:
  ```
  You are "Ask Ryan," a knowledgeable real estate assistant for Ryan Realty in Bend, Oregon.
  You have deep knowledge of Bend's neighborhoods, communities, and real estate market.
  Be direct, conversational, and helpful. Do not use hyphens or colons in your responses.
  Never say "I'd be happy to help" or other generic AI phrases.
  Current page context: {contextJson}
  User preferences: {userPrefsJson}
  ```

**Rate limiting:** 20 messages per session, 100 per day per IP. When session limit is reached, show: "You've reached the message limit for this session. Start a new chat or contact a broker directly." When daily limit is reached, show: "Daily chat limit reached. Contact us directly — we'd love to help."

**Broker handoff:** After 3 or more exchanges mentioning a specific listing (detected by listing ID in context or listing address in user messages), show a proactive prompt below the AI's response: "Would you like me to connect you with [Broker Name]?" with a [Connect Now] button that opens a pre-filled contact form with the listing and conversation summary.

**Error state:** If the Grok API call fails: "I'm having trouble connecting right now. Please try again in a moment, or contact us directly."

**Logging:** Every session logged to `user_activities` with `activity_type = 'chat'`, `entity_type = 'ai_session'`. All sessions with 3+ exchanges where a broker handoff was triggered are also sent to FUB as an `AI Chat Interaction` event.

### 11.3 AI Content Generation

**What gets generated:**
- Community descriptions (long-form, 400-600 words, SEO-optimized)
- Resort deep dives (for resort communities: amenities, membership, lifestyle, rental potential)
- Enhanced listing descriptions (supplement the MLS description with neighborhood context, lifestyle angle)
- Market report narratives (generated from `reporting_cache` data)
- SEO meta titles and descriptions (auto-generated for every page that doesn't have one)
- Blog posts (Section 14)
- Social captions (Section 15)

**Content workflow:**
1. AI generates a draft and stores it in `ai_content_queue` with `status = 'pending'`.
2. Admin sees a badge in the sidebar: "X items need review."
3. Admin opens the AI Content queue (Admin > Content > AI Queue), sees a table of pending items with entity name, content type, and "Preview / Edit / Approve / Reject" actions.
4. Admin can approve as-is, edit and approve, or reject with a rejection reason.
5. Approved content is published to the live page and moved to `ai_content` table with `status = 'published'`.
6. Rejected items are removed from the queue with the rejection reason stored.

**Batch generation:** A daily cron job scans for entities that have no published AI content (community pages with no description, listings with no enhanced description) and queues them for generation. Max 50 items per batch to avoid runaway API costs.

**Brand tone for all AI-generated content (Ryan Realty):** Direct, conversational, authentic. No hyphens or colons in copy. No generic real estate phrases ("dream home," "nestled," "boasting," "stunning"). No pandering or filler ("I'm so excited to share"). Empathetic but not salesy. Write the way a knowledgeable local friend would talk about real estate.

---

## 12. AI Optimization Agent (Fully Autonomous)

An AI agent with full codebase access that continuously monitors, analyzes, and improves the platform. Fully autonomous — it implements improvements without requiring approval for standard optimizations.

### What It Monitors

**Performance:** GA4 data, Core Web Vitals, API response times, error rates.
**Engagement:** Top listings by activity, community engagement, search query quality, funnel drop-offs, CTA performance.
**Data quality:** Missing photos, empty descriptions, broken media, valuation accuracy.
**SEO:** Search Console data, ranking changes, keyword opportunities.

### What It Does Autonomously

- Regenerate SEO meta descriptions for underperforming pages.
- Adjust feed ranking weights based on engagement patterns.
- Flag data quality issues in admin dashboard.
- Optimize slow database queries (identify, log, apply index suggestions).
- Generate weekly performance reports.
- Refresh community content when new information found.
- Update valuation algorithm weights based on prediction accuracy.

### What Gets Flagged (Admin Notification)

- Significant architecture changes or code refactoring.
- New feature recommendations based on user behavior patterns.
- A/B test proposals.
- Any action that could affect user-facing behavior in unexpected ways.

### Technical Architecture

**Schedule:** Cron job at 3:00 AM Pacific daily (low-traffic window). Authenticated via `CRON_SECRET` header.

**Codebase access:** Read-only access to the GitHub repository via GitHub API using `GITHUB_TOKEN` (env var, server-only). The agent reads source files, analyzes patterns, and writes observations to `agent_insights`. It does **NOT** push code changes autonomously. Instead, it creates GitHub Issues labeled `claude-task` with a detailed description of the recommended change, so the developer can review and implement.

**GA4 data access:**
- Use Google Analytics Data API (`@google-analytics/data` Node.js client).
- Authenticate using `GA4_SERVICE_ACCOUNT_JSON` (stringified service account JSON, stored in env var).
- Historical reports: call `runReport` with `property: 'properties/{GA4_PROPERTY_ID}'`.
- Real-time: call `runRealtimeReport` for current active users and trending pages.
- Key metrics pulled daily: sessions by page, bounce rate by page, top search queries, funnel conversion rates, top performing listings, CTA click rates.

**Search Console data access:**
- Use Google Search Console API (`googleapis` Node.js client).
- Authenticate with same service account (grant it read access to the Search Console property).
- Call `searchanalytics.query` with `siteUrl` from `GOOGLE_SEARCH_CONSOLE_SITE_URL` env var.
- Pull: top queries by clicks/impressions, pages losing ranking, keyword opportunities (high impression, low CTR).

**Supabase access:** Direct read via service role key. Queries: engagement_metrics, trending_scores, valuations accuracy (compare estimated vs actual close price on new closings), data quality checks (listings missing photos, empty descriptions).

**Insight deduplication:** Before inserting a new insight, check `agent_insights` for an existing row with the same `insight_type` and similar `title` (use `ILIKE '%{title}%'`) with `status = 'pending'`. If found, update the existing row's `data` and `updated_at` instead of inserting a duplicate.

**Output:**
- All findings written to `agent_insights` table (see Section 6 schema).
- Admin notification: badge in admin sidebar showing count of new insights since last viewed.
- Weekly performance digest email sent to all `broker_admin` and `super_admin` users (via Resend) every Monday at 8:00 AM Pacific.

**Autonomous actions (no human review needed):**
- Regenerate SEO meta descriptions for pages with high impressions but low CTR (threshold: >500 impressions, <2% CTR).
- Refresh community content when listing stats have changed significantly (>10% median price change since last content generation).
- Flag data quality issues in the admin dashboard.

**Flagged for human review (creates GitHub Issue + admin notification):**
- Architecture or refactoring recommendations.
- New feature proposals based on user behavior patterns.
- A/B test proposals.
- Any action that could unexpectedly affect user-facing behavior.

---

## 13. AI Video Pipeline (DEFERRED — Post-Launch)

AI-generated videos from listing photos using Luma Labs and Runway APIs. This feature is deferred to post-launch (Phase 9 in Build Order). Professional video from ARYEO and MLS video URLs provide sufficient video content for launch. The env vars (`LUMA_API_KEY`, `RUNWAY_API_KEY`) are reserved but not required until this feature is built.

---

## 14. AI Blog Engine

Admins can generate blog posts from any content on the site using AI, with a predefined brand tone.

### How It Works

1. Admin selects source material. This can be:
   - A market report (from the reporting engine)
   - Community data and stats
   - Listing activity (new listings, price changes, notable sales)
   - Any page content or data available in the system
2. Admin clicks "Generate Blog Post."
3. AI (X AI / Grok) writes a complete blog post using a **predefined brand tone** configured per tenant. For Ryan Realty, this means: direct, conversational, authentic, no hyphens or colons in copy, no generic real estate phrases, no pandering, empathetic but not salesy.
4. The draft appears in the admin content editor.
5. Admin can edit if needed, then **one-click publish**.
6. Published post appears in the blog section with proper SEO (meta title, description, OG image, structured data).
7. Published post is also available for sharing via the content engine (Section 15).

### Blog Content Types

- Weekly/monthly market reports (auto-generated from reporting_cache data)
- Community spotlights and deep dives
- New listing announcements
- Notable sales and market milestones
- Seasonal market commentary
- Neighborhood guides
- Any custom topic the admin specifies

### Blog Section on the Site

#### Blog Index Page Layout
- Accessible from main navigation ("Blog" or "Market Insights").
- **Hero section:** Featured post (admin-selected or most recent) with large hero image, title, excerpt, read time, author with headshot.
- **Category filter bar** below hero: All, Market Updates, Community Guides, Buying Tips, Selling Tips, Lifestyle, Market Reports. Categories are admin-manageable.
- **Post grid:** 3 columns on desktop, 2 on tablet, 1 on mobile. Each card shows: hero image, category tag, title, excerpt (first 120 characters), author headshot and name, date, read time. Cards are shareable (share button on hover).
- **Sidebar (desktop):** Popular posts (by views), recent posts, category list with post counts, "Subscribe to updates" email capture (Resend).
- **Pagination** or infinite scroll with "Load More" button.
- **SEO:** Unique title/description. Blog index sitemap. JSON-LD for CollectionPage.

#### Individual Blog Post Page Layout
1. **Breadcrumbs:** Home > Blog > [Category] > [Post Title]
2. **Hero image** (full-width or contained, based on image aspect ratio).
3. **Post title** (H1).
4. **Author row:** Headshot, name (links to broker page if author is a broker), date published, read time, category tag.
5. **Social share buttons** (fixed/floating on scroll): Facebook, X, LinkedIn, copy link.
6. **Post body:** Rich content rendered from WYSIWYG editor or AI-generated Markdown. Supports headings, paragraphs, images, embedded charts, pull quotes, bulleted lists.
7. **Internal links within content:** The automated entity linking engine (Section 44) applies here. Community names, city names, and broker names in the post text auto-link to their pages.
8. **Post tags** displayed at the bottom (e.g., "Bend Real Estate," "Market Update," "Tetherow").
9. **Author bio section:** Expanded broker card with headshot, bio excerpt, CTA to broker page.
10. **Related posts:** 3-4 posts determined by shared tags, category, and recency. Universal Card format.
11. **CTA section:** "Looking to buy or sell? Contact our team." with lead capture form or broker contact buttons.
12. **Comments:** Optional. If enabled, requires login. Moderated. All comments tracked and pushed to FUB if the commenter is a known lead.
13. **JSON-LD:** Article schema with headline, author, datePublished, dateModified, image, publisher.

#### Category and Tag Pages
- Each category (Market Updates, Buying Tips, etc.) has its own page with filtered posts, unique meta title/description, and sitemap entry.
- Each tag has its own page. This creates additional SEO landing pages.
- Category and tag pages follow the blog index layout (minus the hero featured post).

#### Author Pages
- Each broker who authors posts gets an author page: /blog/author/matt-ryan
- Shows author bio, headshot, links to broker page, and all posts by this author.
- JSON-LD Person schema.

---

## 15. Content Engine & Social Publishing

Automates content creation and social distribution. When something happens on the site (new listing, price change, sale, engagement milestone), the system automatically drafts social-ready content for the broker to review and publish.

### Trigger Map

| Event | Content Generated | Platforms |
|---|---|---|
| New listing synced | "Just Listed" post with hero photo, price, beds/baths, community. Branded image (1:1 for Instagram, 16:9 for Facebook/LinkedIn). | Instagram, Facebook, LinkedIn, X |
| Price reduced | "Price Drop" post with old/new price, savings amount, hero photo. | Instagram, Facebook |
| Listing goes Pending | "Under Contract" post. Social proof: "This [community] home didn't last long!" | Instagram, Facebook |
| Listing closes/sells | "Just Sold" post with sold price (if allowed by MLS rules), DOM, broker attribution. | Instagram, Facebook, LinkedIn |
| Open house scheduled | "Open House" announcement with date/time, address, hero photo, RSVP link. | Instagram, Facebook |
| Market report generated | "Market Update" post with 1-2 key stats and link to full report. | LinkedIn, Facebook, X |
| Blog post published | Post excerpt with link to full article. | LinkedIn, Facebook, X |
| Engagement milestone | "Most Viewed Home This Week in [Community]" or "Trending in Tetherow." | Instagram, Facebook |

### Content Draft Workflow

1. Event fires (from sync, admin action, or background job).
2. AI generates content draft: caption text (per-platform length: Instagram 2200 chars, X 280 chars, LinkedIn 3000 chars), suggested hashtags (from broker's default hashtags + contextual ones), and selects the best photo from the listing.
3. Branded image generated automatically using the brokerage template (logo, colors, property photo, key stats overlay). Three aspect ratios: 1:1 (Instagram feed), 4:5 (Instagram stories/reels), 16:9 (Facebook/LinkedIn).
4. Draft enters the **content review queue** in admin (Content > Social Posts).
5. Admin previews all platforms, edits if needed, and publishes with one click.
6. Published content is tracked: platform, date, engagement (if accessible via API).

### Social Posting

- **Facebook/Instagram:** OAuth via Meta Graph API (META_APP_ID, META_APP_SECRET). Direct posting to connected pages. Requires Meta app review approval.
- **Other platforms (X, LinkedIn, TikTok, Pinterest):** Generate the branded image + copy caption. User posts manually via Web Share API on mobile or copy-to-clipboard on desktop. Direct API posting added later as integrations mature.
- **Per-broker defaults:** Each broker's social accounts (Section 19) include default hashtags, preferred platforms, and whether they want auto-drafts for their listings.

### Brand Standards for Ryan Realty

Colors: Navy #102742, Cream #F0EEEC. Hashtags: #BendOregon #BendRealEstate #CentralOregon #BendHomes #BendLife #RyanRealtyBend #QualityLocalService. Tone: Direct, engaging, no emojis overload, no generic phrases. Every post should feel like a knowledgeable local sharing insider info, not a marketing department pushing content.

---

## 16. Homepage & Site Structure

**The homepage determines whether a visitor stays or leaves within 3 seconds.** It must immediately communicate that this is the most comprehensive, data-rich, trustworthy real estate platform they have ever seen. Reference the best elements of Zillow's homepage, Redfin's homepage, and Compass's homepage, then surpass them all.

### Homepage Layout (Top to Bottom)

#### 1. Hero Section (Above the Fold)
- **Full-viewport slow-motion background video** of Central Oregon (drone footage of mountains, rivers, pine forests, outdoor lifestyle). NOT a static image. Video hero immediately signals "this is a premium, modern site." Falls back to a high-quality Unsplash photo if video is not configured. Admin-configurable.
- Overlay: brokerage logo, tagline.
- **Prominent search bar** centered in the hero. Large, inviting, with placeholder text like "Search by address, community, or describe what you're looking for..." Supports both traditional auto-complete and AI natural language queries.
- Below the search bar: quick filter chips (Luxury, Golf Communities, New Listings, Recently Sold, Open Houses This Weekend, Price Reduced).

#### 1b. Live Activity Ticker
- A subtle horizontally scrolling ticker bar below the hero (think stock ticker). Shows anonymized real-time site events:
  - "Someone just saved a home in Tetherow"
  - "New listing in Crosswater — $895,000"
  - "Price drop on a home in Broken Top"
  - "3 people are viewing homes in Pronghorn right now"
- Updates from the `user_activities` table in near real-time. No personal info shown.
- Creates a sense of live activity and urgency. Signals that the market is active and this site is the hub.
- Can be paused or dismissed by the user. Admin can toggle on/off.

#### 2. Trending / Hottest Communities Leaderboard
- Immediately below the ticker. This is the social-media-style engagement hook.
- Horizontal slider of communities ranked by the trending intelligence system (Section 24).
- Each community card shows: **3-5 second looping background video clip** (from any listing video in that community) OR hero image if no video, name, market temperature badge (🔥/☀️/❄️), active listing count, median price, 30-day price trend arrow, "X homes sold this month."
- Title: "Hottest Communities Right Now" or "Where the Market Is Moving."
- This section creates immediate engagement and signals that this site has real-time intelligence.

#### 3. Featured Listings Carousel
- Admin-curated or algorithmically selected (highest engagement, newest, featured by broker).
- Full-width horizontal carousel with large listing cards.
- Each card shows: hero photo, price, monthly payment, beds/baths/sqft, community, trending badges (hot, new, price drop).
- **On hover (desktop) or scroll-into-view (mobile), the card thumbnail transitions to a 3-5 second silent video preview** if the listing has video. This is the Netflix thumbnail preview effect. Creates motion and life.
- Like, save, share, compare buttons on each card.

#### 4. Market Snapshot
- A visually striking section with KPI cards showing real-time market data for the primary service area:
  - Median listing price (with trend arrow)
  - Total active listings (with change from last month)
  - Average days on market
  - New listings this week
  - Homes sold this month
  - Inventory months
- Below the KPIs: a small interactive chart showing 12-month price trend.
- "View Full Market Report" link.
- Data from reporting_cache, always current.

#### 5. Video Feed Preview
- A section titled "Tour Homes Now" or "Virtual Walkthroughs."
- Horizontal scroll of 6-8 video thumbnails from listings with video content.
- Click to play inline or enter the full video feed experience.
- Creates engagement and differentiates from text-heavy competitors.

#### 6. "What's Your Home Worth?" CTA Section
- Full-width section with compelling background.
- Address input field: "Enter your address to get a free home value estimate."
- Links to the seller experience (Section 36).
- This is a primary lead generation section. Make it visually prominent.

#### 7. Community Spotlight
- Grid of 4-6 featured communities (admin-curated or auto-selected by trending score).
- Each community card: hero image, name, market temperature, quick stats, listing count.
- "Explore All Communities" link.

#### 8. Recently Sold Near You (Personalized)
- If the user is logged in or has location data: show recently sold homes near their area of interest.
- If not: show recently sold homes in the most active market areas.
- Horizontal slider of 5 cards with sold prices visible.
- Drives curiosity and positions the site as having the freshest data.

#### 9. Blog / Market Updates
- 3-4 recent blog post cards from the AI blog engine.
- Title: "Market Insights" or "Latest from [Brokerage Name]."

#### 10. Broker Team Section
- Headshots, names, and specialties of featured brokers.
- "Find a Broker" CTA.
- For single-broker tenants: personal introduction and CTA.

#### 11. Social Proof / Testimonials
- Rotating testimonials from Google Business reviews or manually curated.
- Review count and aggregate rating prominently displayed.

#### 12. Footer
- Full navigation links organized by category.
- Contact info (phone, email, address matching Google Business Profile).
- Social media links.
- Legal disclaimers, MLS attribution, Oregon Data Share language.
- "Powered by [Platform Name]" for white-label instances.
- Tenant-configurable in admin.

### Navigation

- Primary: Buy, Sell, Communities, Brokers, Blog, About, Contact.
- "Buy" dropdown: Search, Map Search, Open Houses, New Listings, Saved Searches.
- "Sell" dropdown: What's My Home Worth, Selling Guide, Find a Broker, Request a CMA.
- Persistent search bar in header on every page.
- User account icon (shows notification badge if there are unread alerts).
- AI chat bubble on every page.
- On scroll: header becomes compact/sticky with search always accessible.

---

## 17. Search, Filtering & Map Experience

### Search

- Universal auto-complete (addresses, MLS numbers, communities, neighborhoods, cities, brokers).
- AI natural language as primary. Traditional filters as secondary.
- Advanced filters on every exposed database field.
- Saved searches trigger Resend notifications and FUB events.

### Map (Google Maps)

- Full-screen map with pins.
- Draw-on-map custom boundary.
- **Community boundaries from Google Places.** If the community exists as a known place in Google Maps, use its polygon. For resort communities and subdivisions not in Google Places, support **KML file import** through the admin backend to define custom boundaries.
- Server-side clustering at scale.
- Pin hover cards. Real-time filter application. Saved map views.

### Results Display

**The search results page is where buyers spend most of their time.** It must be fast, flexible, and information-dense.

#### Layout Options (User-Toggleable)

- **Split view (default on desktop):** Map on the right (40-50% of viewport), results grid on the left. Map updates as user scrolls or filters. Clicking a pin highlights the card and vice versa.
- **Grid view:** Full-width grid of listing cards without map. 3-4 columns on desktop, 2 on tablet, 1 on mobile.
- **List view:** Compact rows with key details for faster scanning.
- **Feed view:** Instagram-style vertical scroll with larger photos/videos and engagement buttons.
- View toggle buttons at the top of results. User's preference is remembered.

#### Results Header

- Total result count with active filter summary (e.g., "247 homes in Bend, OR | $400K-$800K | 3+ beds").
- Sort dropdown: Price low-high, price high-low, newest, most viewed, most saved, price reduced, DOM low-high.
- View toggle buttons.

#### Filter Panel

- On desktop: collapsible sidebar or horizontal filter bar above results.
- On mobile: full-screen filter modal triggered by a "Filters" button.
- Filter categories with counts showing how many results each filter returns:
  - Price range (slider + manual input)
  - Beds (1+, 2+, 3+, 4+, 5+)
  - Baths (1+, 2+, 3+, 4+)
  - Sqft range
  - Lot size range
  - Year built range
  - Property type (single family, condo, townhouse, land, multi-family)
  - Status (active, pending, sold)
  - Community (multi-select dropdown with search)
  - Neighborhood
  - HOA max
  - Garage (1+, 2+, 3+)
  - Keywords (pool, view, fireplace, etc)
  - Open house (this weekend, next 7 days, next 30 days)
  - Price reduced (any reduction, 5%+, 10%+)
  - New listings (last 24h, last 3 days, last 7 days)
- "Clear All Filters" and "Save This Search" buttons.

#### Listing Cards in Results

Every card uses the Universal Card system (Section 8.1) with all trending badges from Section 24 (hot, trending, new, price drop, back on market, viewing count).

#### Pagination / Infinite Scroll

- Infinite scroll with lazy loading in grid and feed views.
- Traditional pagination option available for users who prefer it.
- "Back to top" floating button after scrolling past 20+ results.

#### No Results State

- Friendly message with suggestions: broaden filters, explore popular communities, try a different search.
- Show trending communities and popular listings as alternatives.
- Never show a blank page.

---

## 18. Community, Resort & Neighborhood Pages (Type Two Microsites)

**Baseline reference: Zillow neighborhood pages and Compass community pages.** These pages must be as data-rich and comprehensive as the listing detail page. Every community page is a destination that earns organic search traffic and keeps users engaged.

### Standard Community Page Layout (Top to Bottom)

#### 1. Hero Section
- Full-viewport hero image or video (community hero video > listing hero photo > Unsplash banner, Priority 4 implemented).
- Community name as large overlay text.
- Market temperature badge (🔥 Hot, ☀️ Warm, ❄️ Cool) from trending system (Section 24).
- Quick stats overlay: active listings count, median price, avg price/sqft.

#### 2. Community Overview
- AI-generated comprehensive description (admin-editable). Minimum 300 words of unique content covering the community's character, location, lifestyle, and appeal.
- Key facts in a visual grid: Year established, total homes, typical lot sizes, HOA monthly dues, architectural styles, proximity to downtown/amenities.
- "What makes this community special" section highlighting differentiators.

#### 3. Market Snapshot
- KPI cards row: Median price, avg price/sqft, avg days on market, number of active listings, homes sold last 30/60/90 days, inventory months, YoY price change %.
- Market temperature indicator with explanation.
- **Price trend chart** showing community median price over 1, 3, 5, and 10 year periods.
- **Inventory chart** showing active vs sold over time.
- **Price per sqft trend** over time.
- All data from reporting_cache, updated after each sync.

#### 4. Active Listings
- Grid of all active listings in the community using Universal Cards.
- Sort options: price, newest, most viewed, most saved.
- Trending and hot badges on applicable cards.
- "View all X listings in [Community]" link to full search results filtered to this community.

#### 5. Recently Sold
- Horizontal slider of 5-10 recently sold homes with sold prices visible.
- "View all sold homes in [Community]" link.
- Gives buyers pricing context.

#### 6. Map Section
- Google Maps embed showing community boundary (Google Places polygon or KML) with all active listings pinned.
- Hover cards on pins. Satellite/roads/lot lines toggles.
- Nearby points of interest (restaurants, schools, parks, golf courses).
- Street View availability.

#### 7. Schools Nearby
- List of schools serving this community with ratings (GreatSchools when available).
- Distance from community center.

#### 8. Walkability & Getting Around
- Walk Score, Transit Score, Bike Score for the community.

#### 8b. Demographics (US Census)
- Key demographic stats for the community's area: population, median income, median age, education levels, % homeowners, average household size, commute times.
- Data from Census ACS cached in Supabase. Displayed as a clean data grid or infographic.
- AI uses this data to enrich community descriptions.

#### 8c. Nearby Amenities
- Aggregate count of amenities near the community: restaurants, grocery, parks, medical, fitness, shopping.
- "What's Nearby" section with categorized lists and distances from community center.
- Data from Google Places API, cached in Supabase.

#### 9. AI-Generated Contextual Content
- Sections about the neighborhood the community is in, the city, local amenities, lifestyle, outdoor recreation, dining, shopping.
- This is unique AI-generated content per community that prevents thin pages and targets long-tail SEO keywords.
- Updated periodically by the AI optimization agent when new information is found.

#### 10. Community Leaderboard Position
- Where this community ranks among all communities (most active, fastest selling, most viewed). Links to the full community leaderboard.

#### 11. Nearby Communities Slider
- Horizontal slider of 5 nearby communities using Universal Cards (community variant) with market temperature badges.

#### 12. Blog Posts About This Community
- If any blog posts reference this community, show them as cards.

#### 12b. Frequently Asked Questions (FAQPage Schema)
- AI-generated FAQ section with 5-8 relevant Q&As specific to this community. Examples:
  - "What is the average home price in [Community]?"
  - "How long do homes take to sell in [Community]?"
  - "What are the HOA fees in [Community]?"
  - "What amenities does [Community] offer?"
  - "Is [Community] a good place for families?"
- Admin-editable. AI optimization agent refreshes when data changes.
- FAQPage JSON-LD structured data targets Google featured snippets.

#### 13. Contact a Broker CTA
- Prominent CTA with broker photos and contact options.
- "Interested in [Community]? Talk to a local expert."
- Tracked and pushed to FUB with community context.

#### 14. MLS Attribution & Footer
- Oregon Data Share compliance. Last updated timestamp. Standard footer.

### Resort Community Pages (Enhanced Microsites)

Tetherow, Crosswater, Caldera Springs, Pronghorn, Vandevert Ranch, and others flagged as resort communities. These get everything from the standard layout PLUS the following. The goal is to build the most comprehensive page about this resort that exists anywhere on the internet. Each resort page should be 1,500-2,500 words of unique content.

#### Resort Page Hero

**The hero MUST be video if at all possible.** A 10-15 second looping cinematic clip of the resort (golf course flyover, pool and mountain views, lifestyle footage). If no video exists, use a stunning Unsplash or admin-uploaded panoramic photo. This is the "splash page" experience. Full-viewport. Immersive. The user should feel like they're there.

#### Additional Resort Sections (inserted between Overview and Market Snapshot)

**Section R1: History & Vision**
- When was the resort/community established? Who developed it? What was the founding vision?
- AI-scraped from the resort's official website, Wikipedia, travel guides, and public sources. Admin reviews and edits.
- 100-200 words.

**Section R2: Lifestyle & Atmosphere**
- What is daily life like in this community? What type of person lives here?
- Demographics context: retirees, families, second-home owners, full-time residents.
- Social scene, community events, resident culture.
- 100-200 words.

**Section R3: Amenities Showcase**
- Full-width sections for each major amenity category, each with photos/video and detailed description:
  - **Golf:** Course designer, number of holes, course rating, signature holes, practice facilities, pro shop, lessons. Photo or video of the course.
  - **Pool/Fitness/Spa:** Pool types (lap, resort, hot tub), fitness center details, spa services, yoga/wellness.
  - **Dining/Restaurants:** On-site restaurants, cuisine types, notable chefs, bar/lounge, private dining.
  - **Trails/Recreation:** Hiking, biking, cross-country skiing, snowshoeing, fishing, river access.
  - **Other:** Tennis, pickleball, equestrian, kids programs, community center, art studios, event spaces.
- Each amenity category is a visual section with photo(s) and 50-100 words of description.

**Section R4: Membership Details**
- Membership tiers (social, golf, sports, full, etc) with initiation fees and monthly dues if publicly available.
- What each tier includes.
- Transfer/resale policies if known.
- AI-scraped from resort website and public sources. Admin editable.

**Section R5: Rental Restrictions**
- Whether short-term rentals are allowed (critical for buyers considering investment use).
- Minimum rental periods (30-day, 60-day, etc).
- HOA restrictions on rentals.
- Platform restrictions (Airbnb/VRBO allowed or not).
- This information can be the deciding factor for buyers. Make it prominent.

**Section R6: Four Seasons in [Community]**
- What is each season like? Central Oregon is a 4-season destination.
- Winter: proximity to Mt. Bachelor skiing, snowshoeing, cozy fireplaces.
- Spring: golf season opens, wildflowers, river flows.
- Summer: peak season, outdoor dining, festivals, warm days, cool nights.
- Fall: colors, quiet season, elk bugling, perfect golf weather.
- 100-200 words covering all four seasons. Creates lifestyle appeal.

**Section R7: Proximity & Convenience**
- Distance to downtown Bend (dining, shopping, nightlife).
- Distance to Roberts Field airport (RDM).
- Distance to St. Charles Medical Center.
- Distance to grocery stores, schools, and other essentials.
- Displayed as a visual proximity chart or list with drive times.

**Section R8: Community Comparison**
- How does this resort compare to similar communities?
- "Tetherow vs Pronghorn vs Broken Top" comparison table.
- Key metrics side by side: median price, HOA dues, lot sizes, amenities, membership costs, year established.
- This captures searchers who are comparing communities (high-intent SEO traffic).
- Links to the other community pages (internal linking).

**Standard resort sections also included:**
- Contact information: Resort management, HOA office, phone, email, website link.
- Photo gallery: Dedicated gallery of community amenities.
- Community video: Embedded video tour if available.
- Official website link.
- FAQ section (FAQPage schema): 5-8 Q&As specific to this resort.

Names in `lib/resort-communities.ts` match Spark API `SubdivisionName` / `City` exactly.

### City Page Layout (Top to Bottom)

Every city gets a comprehensive page. For Bend, this is a major SEO landing page.

#### 1. Hero Section
- City hero image (Unsplash or admin-uploaded). City name overlay.
- Quick stats: total active listings, median price, population (if available).

#### 2. City Overview
- AI-generated comprehensive description (300+ words). Covers what makes this city desirable, lifestyle, climate, economy, outdoor recreation, culture.
- Key facts grid: population, elevation, school districts, major employers, distance to Portland/airports.

#### 3. Market Snapshot
- Same KPI cards and charts as community pages but at the city level.
- Price trends, inventory, DOM, YoY changes.

#### 4. Neighborhoods in This City
- Horizontal slider or grid of neighborhoods within the city using Universal Cards (neighborhood variant) with market temperature badges.
- Each links to the neighborhood page.

#### 5. Top Communities in This City
- Horizontal slider of communities ranked by activity or engagement.
- Hot communities badge, trending indicators.

#### 6. Active Listings
- Featured listings grid (top 6-12). "View all X listings in [City]" link to full search.

#### 7. Recently Sold
- Slider of recent sales with prices.

#### 8. Map Section
- Google Maps showing city boundary with neighborhood/community overlays and listing pins.

#### 9. Schools
- School districts and individual schools serving the city.

#### 10. Things to Do / Lifestyle Content
- AI-generated sections about restaurants, outdoor recreation, events, culture, shopping.
- This is the content that wins long-tail SEO and keeps people on the page.

#### 10b. Demographics
- City-level Census data: population, median income, median age, education, employment, housing stats, commute times.
- Displayed as an infographic or data grid. Gives buyers context about the community they'd be joining.

#### 11. Blog Posts About This City
- Related blog content.

#### 12. Nearby Cities Slider
- Other cities in the area with listing counts and prices.

#### 13. CTA & Footer

### Neighborhood Page Layout (Top to Bottom)

Neighborhood pages sit between city and community pages in the hierarchy. A neighborhood may contain multiple communities/subdivisions. Minimum 500 words of unique content per page.

#### N1. Hero Section
- Neighborhood hero image (Unsplash by location keyword, or admin-uploaded). Name overlay.
- Quick stats: active listings, median price, number of communities within.

#### N2. Neighborhood Overview
- AI-generated description (200-300 words). What defines this neighborhood? Geographic boundaries? Character and feel?
- Key facts: approximate boundaries (streets or landmarks), distance to downtown, typical home styles, price range.

#### N3. Market Snapshot
- KPI cards from reporting_cache: median price, active listings, avg DOM, YoY price change, absorption rate.
- Price trend chart.
- Market temperature badge.

#### N4. Communities Within This Neighborhood
- Grid or slider of all communities/subdivisions within this neighborhood using Universal Cards with market temperature badges.
- Each links to the community page.
- This is the primary navigation element for users drilling down from neighborhood to community.

#### N5. Active Listings
- Grid of active listings within this neighborhood. Universal Cards with trending badges.
- "View All X Listings in [Neighborhood]" link.

#### N6. Recently Sold
- Slider of recent sales with prices.

#### N7. Map Section
- Google Maps showing neighborhood boundary with community boundaries overlaid within.
- All active listings pinned.
- Nearby schools, parks, amenities.

#### N8. Schools & Amenities
- Schools serving this neighborhood (SchoolDigger data).
- Nearby amenities (Google Places data).
- Walk Score if available.

#### N9. Demographics
- Census data for the area.

#### N10. FAQ Section (FAQPage Schema)
- AI-generated Q&As specific to this neighborhood. "What is the average home price in [Neighborhood]?" etc.
- 5-8 questions.

#### N11. Nearby Neighborhoods Slider
- Horizontal slider of adjacent neighborhoods.

#### N12. Blog Posts & CTA
- Related blog posts. Contact broker CTA. Footer.

---

## 19. Broker & Brokerage Pages

### Brokerage Page

- About (tenant-configurable), team roster, stats from reporting_cache, Google reviews (auto-synced from Google Business Profile), awards, service area map, CTA.

### Individual Broker Landing Page Layout (Top to Bottom)

**This page IS a landing page.** Every broker's page must function as a standalone lead generation page that converts visitors from ads, social media, email signatures, business cards, and organic search. Reference Compass agent pages and Zillow Premier Agent profiles as the baseline, then exceed them. Brokers will be driving paid traffic (Meta ads, Google Ads) directly to this page. It must convert.

#### 1. Hero Section (Above the Fold)
- **Split layout on desktop:** Left side has broker's professional headshot (large, high-quality). Right side has broker name (large), title/designations, brokerage name, and a one-line tagline or specialty (e.g., "Luxury Homes in Central Oregon").
- **On mobile:** Headshot centered above name/title, stacked vertically.
- **Star rating** (aggregate from all review platforms) with total review count displayed prominently.
- **Contact buttons row** immediately visible: Call (FUB-tracked number), Text, Email, Send Message. Each with icon.
- **Social media icons** row linking to configured accounts.

#### 2. Lead Capture CTA (Primary Conversion)
- Full-width section with contrasting background. Directly below hero.
- **"Contact [Broker Name]"** form: Name, Email, Phone, Message, optional "I'm interested in" dropdown (Buying, Selling, Both, Just Browsing).
- **OR** "Schedule a Consultation" button opening a calendar picker.
- This is the #1 conversion element. Must be visible without much scrolling. All submissions go to FUB.

#### 3. About / Bio Section
- Bio in brand tone (admin-editable, AI draft available).
- Specialties as visual tags/chips.
- Years of experience, license number, designations.
- "Why work with me" section with 3-4 differentiators and icons.
- Service area map.

#### 4. Performance Stats
- KPI cards: total transactions, sales volume, avg sale price, avg DOM, list-to-sale ratio, active listing count.
- Auto-calculated from broker-listing association. Broker can show/hide.

#### 5. Active Listings
- Grid using Universal Cards with trending badges. ARYEO-enhanced listings visually elevated.
- "View All [Broker]'s Listings" link.

#### 6. Recently Sold
- Horizontal slider with sold prices visible. Social proof.

#### 7. Reviews
- Unified feed from Zillow, Realtor.com, Yelp, Google Business. Each shows reviewer, rating, date, text, source icon.
- Aggregate rating at top. Paginated or "Show More."
- Manual testimonials interspersed.

#### 8. Video Content
- Personal intro video first (if exists). Market updates, community tours, listing walkthroughs.
- Horizontal scroll of thumbnails.

#### 9. Blog Posts by This Broker
- 3-4 recent posts as cards. Positions broker as local expert.

#### 10. Communities Served
- Horizontal slider of broker's specialty communities with market temperature badges.

#### 11. Second CTA (Bottom Conversion)
- Repeat lead capture. "Ready to Get Started? Contact [Broker Name] Today."

#### 12. MLS Attribution & Footer

**What Brokers Can Edit in Admin:**
- Headshot, tagline, bio (WYSIWYG), specialties, stat visibility, featured listings, testimonials, video uploads, social links, CTA text, section order (drag-and-drop reorder).

### Broker Social Media Account Settings (Admin Backend)

In the admin backend, each broker's profile includes a **Social Accounts** tab where they configure all their social media accounts. This is a one-time setup that powers all sharing features.

**Accounts they can configure:**
- **Instagram:** Username and optional OAuth connection (via META_APP_ID for direct posting through Graph API).
- **Facebook:** Page URL and optional OAuth connection for direct posting.
- **LinkedIn:** Profile URL.
- **X (Twitter):** Handle.
- **TikTok:** Handle.
- **YouTube:** Channel URL.
- **Pinterest:** Profile URL.
- **Google Business Profile:** Already configured in Section 22.

**For each account, the broker provides:**
- Platform username/URL (required, displays on their public broker page).
- OAuth connection status (connected/not connected). For Facebook/Instagram, they can click "Connect" to OAuth through Meta and grant posting permissions. This enables direct posting from the site.
- Default hashtags (per platform, pre-filled with brokerage defaults but broker can customize). Ryan Realty defaults: #BendOregon #BendRealEstate #CentralOregon #BendHomes #BendLife #RyanRealtyBend #QualityLocalService.
- Bio/description for social (optional, used when auto-generating post captions).

### Broker Social Sharing System

When a broker wants to share content from the site to their social media, the system makes it as fast and easy as possible.

#### How Sharing Works for Brokers (Browsing the Site)

When a broker is logged in and browsing the public site, the share button on every page shows enhanced options:

1. **"Share with My Lead"** — (Section 31, already defined) sends to a FUB contact via email.
2. **"Post to Social Media"** — opens the Social Share Modal.

#### Social Share Modal

**Step 1: Preview & Customize Content**
The system auto-generates platform-optimized content for the page being shared:

- **Branded image:** Auto-generated using the page's best photo, with Ryan Realty branding overlay (logo, colors, key data like price/address for listings). Different aspect ratios generated: square (1:1 for Instagram feed), portrait (4:5 for Instagram/Facebook), landscape (16:9 for LinkedIn/X). The broker sees thumbnail previews of each.
- **Caption:** AI-generated using the brokerage brand tone (direct, conversational, authentic, no hyphens or colons, no generic real estate phrases). Different caption lengths for different platforms (Instagram: longer with hashtags, X: concise under 280 chars, LinkedIn: professional and data-driven).
- **Hashtags:** Pre-filled from the broker's default hashtags plus AI-suggested hashtags relevant to the specific content.
- The broker can edit the caption and hashtags before sharing. WYSIWYG text editing.

**Step 2: Select Platforms**
Checkboxes for each platform the broker has configured. Platforms with OAuth connections show a "Direct Post" badge. Platforms without OAuth show "Open in App" or "Copy & Post."

**Step 3: Share**
For each selected platform:
- **OAuth-connected (Facebook/Instagram):** The site posts directly to the broker's account via the Meta Graph API. The broker confirms and it posts. No app switching needed.
- **Not OAuth-connected (LinkedIn, X, TikTok, etc.):**
  - On mobile: Uses the Web Share API to open the native share sheet. The branded image and caption are pre-loaded. The broker selects the app and taps post.
  - On desktop: Downloads the branded image to the broker's device and copies the caption to clipboard with one click. A toast notification says "Image downloaded and caption copied. Paste into [platform]."
- **All shares are tracked:** Which broker, which content, which platform, when. Visible in admin analytics.

#### Content Types That Can Be Shared

Every shareable page auto-generates platform-specific content:

- **Listing page:** Branded listing image with property photo, price, beds/baths/sqft, address, broker branding. Caption highlights key features.
- **Community page:** Branded community image with hero photo, community name, key stats (median price, active listings). Caption highlights the community.
- **Blog post:** Featured image with blog title overlay. Caption summarizes the post.
- **Market report:** Chart image with key stats. Caption shares the headline finding.
- **Just Listed / Just Sold:** Specific branded templates designed for maximum engagement on social.
- **Open House:** Event-style image with date, time, address, and photo. Caption includes RSVP link.
- **Home valuation result:** "What's your home worth in [Community]?" teaser image (does not reveal specific values).
- **Any page:** Generic branded screenshot/preview image with page title and URL.

---

## 20. Broker-Listing Association & License Matching

Every broker in the system has an Oregon real estate license number and/or MLS ID stored in their `brokers` table profile. The listings table carries `broker_id` (uuid FK, nullable) and `association_type` ('auto' or 'manual').

### Automatic Association

When listings are synced from the Spark API, the sync engine attempts to match `ListAgentMlsId` and `ListAgentStateLicense` from the listing against `brokers.mls_id` and `brokers.state_license`. This happens in the delta sync processing step (see Section 7.4).

**Matching algorithm (in order):**
1. Try exact match on `brokers.mls_id = listing.list_agent_mls_id`.
2. If no match, try exact match on `brokers.state_license = listing.list_agent_state_license`.
3. If match found, set `listings.broker_id = broker.id` and `listings.association_type = 'auto'`.
4. If no match found, leave `listings.broker_id = NULL`. The listing is shown as an unassociated listing in the admin dashboard.

**Edge case — Multiple brokers match (data error):**
- If `ListAgentMlsId` matches more than one broker (should not happen but may occur during initial data import), log a warning to `job_runs.errors` and attempt a secondary match using `state_license`. If still ambiguous after both checks, set `broker_id = NULL` and flag the listing with `finalization_notes = 'ambiguous_broker_match'` for manual review in Admin > Listings > Needs Review.

**Edge case — Broker license number changes:**
- Admin updates the broker's `state_license` in their profile. On save, the system re-runs the association algorithm for all listings where `association_type = 'auto'` (not manual overrides) and updates accordingly.

**Manual override:**
- Admin can manually associate or disassociate any listing from any broker in Admin > Listings > [Listing] > Association.
- Manual associations set `association_type = 'manual'` and are **never overwritten** by the automatic sync — even if the automatic match would produce a different result.
- Manual disassociation sets `broker_id = NULL` and `association_type = 'manual_unlinked'`.
- Manual overrides are shown with a "Manual" badge in the admin listing detail view.

### What This Enables

- Broker landing pages auto-populate with their current and historical listings.
- Broker performance stats (volume, transactions, average price) calculated automatically.
- When a listing closes, the sold data adds to the broker's track record.
- Broker can only enhance listings (Section 9) where they are the matched listing agent.

### Admin "Needs Review" Queue

A dedicated view in Admin > Listings > Needs Review shows:
- Listings with `broker_id = NULL` (no auto-match found).
- Listings flagged as `ambiguous_broker_match`.
- Count shown as a badge in the admin sidebar.

Admin can manually assign a broker from a dropdown of all active brokers.

---

## 21. Broker Review Aggregation

Brokers can link their profiles on external platforms. Reviews are auto-synced via API integration.

### Supported Platforms

- **Yelp** — Broker links their Yelp Business ID. System syncs reviews via Yelp Fusion API (`YELP_API_KEY`). Supported at launch.
- **Google Business** — Broker links their Google Business Profile ID. System syncs reviews via Google Business Profile API (OAuth 2.0 — no separate API key needed, uses `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`). Supported at launch.
- **Zillow** — **DEFERRED.** Zillow review syndication API terms are uncertain and may not permit third-party aggregation. Do not build. Track in Section 52 open questions. Broker can link their Zillow Agent ID in their profile for display purposes (as a link), but no API sync.
- **Realtor.com** — **DEFERRED.** Same reason as Zillow. Display profile link only, no API sync.

### How It Works

1. In the admin backend, the broker (or admin) enters their external platform IDs.
2. A scheduled background job queries each platform's API for new reviews.
3. Reviews are stored in Supabase with source attribution (which platform, date, rating, text, reviewer name if available).
4. Reviews are displayed on the broker's landing page, grouped by source or in a unified feed.
5. Aggregate rating (average across all platforms) displayed prominently.
6. Sync runs daily or on a configurable schedule.

### Admin Control

- Ability to hide inappropriate reviews (with logging).
- Review counts and ratings visible in admin analytics.

---

## 22. Google Business Profile Integration

Connect the brokerage's Google Business Profile to improve local SEO and sync reviews.

### What This Does

- **Review sync** from Google Business to the brokerage page and individual broker pages (via Section 21).
- **Local SEO signals.** Google Business Profile is a major ranking factor for local search. The website should reference and link to the Google Business Profile. Structured data (LocalBusiness schema) on the site should match the Google Business listing exactly (name, address, phone, hours, categories).
- **Google Maps integration.** If the brokerage has a verified Google Business location, it should appear on the site's map as the brokerage office pin.
- **Review solicitation.** After successful transactions, the system can prompt clients to leave a Google review (via Resend email with a direct review link).

### Implementation

- **No separate API key needed.** Google Business Profile API uses OAuth 2.0 via the existing Google Cloud project (`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`). Ensure the Google Business API is enabled in the Cloud Console and the OAuth consent screen has the `https://www.googleapis.com/auth/business.manage` scope.
- Ensure NAP (Name, Address, Phone) consistency between the website and Google Business listing.
- JSON-LD LocalBusiness schema on the homepage and about page matches Google Business exactly.
- Post updates to Google Business when notable content is published (new blog posts, market reports) to keep the profile active.

---

## 23. User Accounts, Dashboards & Preferences

### Authentication UX Flows

Google (configured), Apple, Facebook via Supabase Auth. Minimal friction. Every authentication screen uses the brokerage branding (logo, colors) and follows best practices.

#### Sign Up / Create Account
- Primary CTAs: "Continue with Google," "Continue with Apple," "Continue with Facebook." Social auth is the preferred path (less friction, immediate name/email).
- Secondary option: "Sign up with Email" for users who don't want social auth. Fields: First name, Last name, Email, Password (with strength indicator), Confirm password.
- Password requirements: minimum 8 characters, at least one uppercase, one lowercase, one number. Shown as a checklist that updates in real time as the user types.
- After submission: verification email sent via Resend. User clicks the link to verify. Redirected to the dashboard.
- All sign-up paths trigger the FUB Identity Bridge (see below).

#### Sign In
- Primary CTAs: "Continue with Google," "Continue with Apple," "Continue with Facebook."
- Secondary: "Sign in with Email." Fields: Email, Password, "Remember me" checkbox.
- "Forgot Password?" link below the password field.
- Failed login: clear error message ("Incorrect email or password. Try again or reset your password."). Rate-limited to prevent brute force (5 attempts, then temporary lockout with email notification).

#### Forgot Password / Password Reset
- User clicks "Forgot Password?" and enters their email address.
- System sends a password reset email via Resend with a secure, time-limited token link (expires in 1 hour).
- User clicks the link, enters new password (with strength indicator), confirms.
- Success: "Password reset successfully. You can now sign in." Redirected to sign-in page.
- Security: the reset token is single-use. If the user requests another reset, the previous token is invalidated.

#### Account Settings (Within User Dashboard > My Profile)
- Change password (requires current password).
- Connected accounts (show which social providers are linked, option to connect/disconnect).
- Email address management (update, verify new email).
- Delete account (with confirmation dialog and data deletion per GDPR/CCPA right to be forgotten). Deletion removes user data from Supabase, unsubscribes from Resend, and optionally removes from FUB (configurable).

#### Session Management
- Sessions persist for 30 days (remember me) or until browser close (no remember me).
- Supabase Auth handles session tokens and refresh.
- If a user is logged in on multiple devices, all sessions are valid.

**FUB Identity Bridge on Login (Critical):**

When a user logs in via "Continue with Google" (or Apple/Facebook), the system immediately checks Follow Up Boss for an existing contact with that email address before or during account creation. This is critical because the FUB database may contain thousands of contacts who have never created a website account.

**Flow:**
1. User clicks "Continue with Google." Google OAuth returns their name and email.
2. **Before completing account creation**, the backend calls the FUB API to search for a contact with that email.
3. If found in FUB: the new Supabase user account is automatically linked to the existing FUB contact. All historical FUB data (assigned broker, past interactions, lead score, tags, notes) is associated with this user. The assigned broker is notified that their lead just created an account.
4. If not found in FUB: a new FUB contact is created from the Google/Apple/Facebook profile data. Standard lead assignment rules apply.
5. Any anonymous browsing history (tracked via cookie before login) is merged with the authenticated profile and pushed to FUB.

This ensures that a broker's existing leads in FUB are seamlessly connected when they sign up on the website. No lead is orphaned.

**Apple and Facebook login:** Currently only Google OAuth is configured. Apple and Facebook social login must be added via Supabase Auth. All three providers follow the same FUB bridge flow above.

### User Dashboard Layout (Top to Bottom)

When a user logs in, they land on their dashboard. This is their home base for everything. It must feel like a personalized real estate command center.

#### Dashboard Navigation (Sidebar on Desktop, Bottom Tab Bar on Mobile)
- **Home** (dashboard overview)
- **Saved Homes** (favorited listings organized into collections)
- **Liked Homes** (social engagement likes)
- **Saved Searches** (with notification controls)
- **Recently Viewed** (browsing history)
- **Recommendations** (AI-powered suggestions)
- **Comparisons** (active comparison trays)
- **Shared Collections** (collections sent to others)
- **Messages** (AI chat history, broker messages)
- **My Profile** (buyer preferences, notification settings, account)

#### Dashboard Home Screen

**1. Welcome Header**
- "Welcome back, [First Name]" with last visit date.
- Notification badge count if there are unread alerts (price drops, new matches, status changes).

**2. Notification Center**
- A collapsible panel (or bell icon dropdown in the header) showing recent notifications:
  - "Price dropped on [listing address] — now $725,000 (was $750,000)"
  - "New listing matches your saved search: Tetherow homes under $900K"
  - "[Listing] just went under contract"
  - "New in Crosswater — 3 new listings this week"
- Each notification is clickable and goes to the relevant listing or search results.
- Mark as read / dismiss. "View All Notifications" link.

**3. Saved Homes Section**
- Grid of saved listings using Universal Cards with trending badges.
- Organized into collections (user can create collections like "Tetherow Favorites," "Top Picks for Mom"). Default collection is "All Saved."
- Each card shows current price. If price changed since save, show the change (green for drop, amber for increase).
- Status badges update live (if a saved home goes pending, the card reflects it immediately).
- Sort by: date saved, price, status, community.
- Quick actions per card: Remove from saved, Move to collection, Compare, Share.

**4. Saved Searches Section**
- List of saved searches with: search name (user-editable), filter summary, match count, notification frequency setting.
- Each search has a toggle for notifications (on/off) and a frequency selector (instant, daily, weekly).
- "View Results" button runs the search and shows current matches.
- "Edit Filters" opens the search with all filters pre-loaded.
- "New matches since last visit" badge count per search.
- "Create New Saved Search" button.

**5. Recently Viewed**
- Horizontal timeline or list of recently viewed listings with timestamps.
- Most recent at top/left. Shows last 20-50 viewed listings.
- Quick actions: Save, Like, Compare, Share.

**6. AI Recommendations ("Homes For You")**
- 5-8 AI-recommended listings based on: buyer preferences, browsing history, saved homes patterns, saved search criteria.
- Each shows why it was recommended (e.g., "Similar to homes you saved in Tetherow" or "Matches your 3+ bed, $600-800K search").
- Universal Card format with trending badges.

**7. Market Updates for Your Areas**
- If the user has saved searches or saved homes, show a mini market snapshot for their areas of interest.
- "Homes in Tetherow: 12 active, median $825K, avg 42 DOM" with trend arrows.
- Links to community pages.

**8. Buyer Preferences**
- Current settings displayed with "Edit" button: price range, beds, baths, communities of interest, down payment %, credit score, interest rate.
- When edited, the site immediately re-personalizes (monthly payment calculations, AI recommendations, search defaults).

### Sharing Collections

1. User selects homes from saved/liked lists or search results (checkbox on each card).
2. A sticky "Share Collection" bar appears at the bottom showing selected count.
3. Click "Share Collection" to open the share modal.
4. Choose channel: email (Resend-branded), text/SMS, copy link, social media.
5. A branded shareable page is generated with all selected listings as Universal Cards.
6. The recipient sees a beautiful, branded page at a unique URL (e.g., ryan-realty.com/shared/abc123).
7. Share tracked and pushed to FUB. The shared page tracks views.

### Data Storage

All activity in Supabase per user. Every interaction logged. Feeds dashboard, admin, FUB, Resend triggers.

---

## 24. Social Engagement, Feed System & Trending Intelligence

Listings are posts. Social proof drives engagement. But beyond individual listing metrics, the platform uses engagement data to create visual signals that appear across every page, driving curiosity, urgency, and return visits.

### Engagement Per Listing

View, like, save, share counts. All visible. Near real-time.

### Feed Mode

Instagram-style vertical scroll. Full-bleed 4:5 cards (Priority 5 implemented). Ranked by engagement. Filterable. Infinite scroll, lazy load. Video autoplay muted.

### Ranking Algorithm

Weighted score (recency, views, saves, likes, shares, price changes). Boosts for new and reduced. Weights configurable in admin and optimized by AI agent.

### Trending Intelligence System

This is a site-wide system that uses engagement data, market activity, and listing changes to create visual indicators everywhere. Think of it as the analytics layer that powers all the social-proof elements across the site. It makes data feel alive.

#### Listing-Level Indicators

Every listing card and listing detail page can display any applicable badges and signals:

- **"Hot" badge** — Listing has engagement velocity above a threshold (views/saves in the last 24-48 hours significantly above average). Badge appears on the card and detail page. Configurable threshold in admin.
- **"Trending" indicator** — Engagement is trending up (views increasing day over day). Small upward arrow or flame icon.
- **"X people viewing"** — Real-time or near-real-time count of users currently on this listing page. Creates urgency. (e.g., "4 people are looking at this right now")
- **"Viewed X times today"** — Daily view count for high-traffic listings.
- **"Saved by X people"** — Total saves count on cards and detail pages.
- **"New" badge** — Listing is less than 48 hours old. Fresh inventory is exciting.
- **"Price Drop" badge** — Price was reduced within the last 7 days. Shows the reduction amount or percentage.
- **"Back on Market" badge** — Listing returned to active after being pending.
- **"Under Contract" / "Pending" badge** — Creates FOMO and shows market activity.
- **Price trend arrow** — On cards and detail pages, a small up/down arrow showing the listing price trend (if there have been changes).

These badges and indicators should be subtle but noticeable. They are applied automatically based on data. No manual tagging.

#### Community-Level Indicators (Hot Communities)

Community cards and community pages display market intelligence signals:

- **"Hot Market" badge** — Community has above-average sales activity (closings per month compared to historical average). Displayed on community cards in carousels, search results, and the homepage spotlight.
- **Community temperature** — Visual indicator (🔥 Hot, ☀️ Warm, ❄️ Cool) based on a composite score of: closings in the last 30/60/90 days, average days on market, list-to-sale price ratio, inventory level vs demand.
- **"X homes sold in the last 30 days"** — Factual activity metric displayed on community cards and pages.
- **"Trending community" badge** — Community page views and listing engagement are trending up. This captures buyer interest even before sales activity confirms it.
- **Inventory change indicator** — "5 new listings this week" or "Inventory down 15% from last month." Gives context about whether the market is tightening or loosening.
- **Median price trend** — Up/down arrow with percentage on community cards showing 30-day or 90-day price movement.

#### Community Leaderboard

A dedicated section on the homepage and accessible from the Communities page:

- **"Hottest Communities Right Now"** — A ranked list or horizontal slider showing communities ordered by composite activity score (sales volume + engagement + price movement).
- **"Most Viewed Communities"** — Ranked by page views and listing views within the community.
- **"Fastest Selling"** — Communities with the lowest average days on market.
- **"Most Active"** — Communities with the most new listings, price changes, and status changes.
- These leaderboards update in real time from reporting_cache and engagement data. They create a dynamic, data-driven homepage that feels alive.

#### City and Neighborhood Level

Same trending indicators adapted for cities and neighborhoods:
- Market temperature badges on city and neighborhood cards.
- Activity metrics (homes sold, new listings, price trends).
- Trending up/down signals based on engagement and sales data.

#### Where Trending Indicators Appear

- **Homepage:** Trending communities leaderboard, hot listings in featured carousel, trending badge on all cards.
- **Search results:** Hot/trending badges on listing cards. Communities in results show temperature.
- **Listing pages:** Hot badge, viewing count, saved count, price drop badge, new badge.
- **Community pages:** Market temperature, activity stats, trending badge.
- **Feed mode:** Hot listings rise to the top. Trending badges on cards.
- **Map view:** Pin colors or sizes could reflect engagement level (hotter listings have larger or colored pins).
- **Universal cards everywhere:** Every card variant (listing, community, city, neighborhood) shows applicable trending indicators.

#### How It Works Technically

- A background job (runs after each sync and on a regular schedule) computes trending scores for all listings and all geographic entities.
- Scores are stored in dedicated columns or a separate `trending_scores` table in Supabase.
- Thresholds for "hot," "trending," and temperature levels are configurable per tenant in admin.
- The AI optimization agent monitors which indicators drive the most engagement and adjusts thresholds over time.
- Real-time viewer count uses Supabase Realtime subscriptions or a lightweight presence system.

---

## 25. Video & Media Strategy

### Video Sources

Videos come from three sources, in priority order:
1. **ARYEO professional video** — Highest quality. Imported via the ARYEO download center workflow (Section 9/Appendix B). Stored in Supabase Storage.
2. **MLS video URL** — Extracted from `VirtualTourURLUnbranded` during sync. These are typically YouTube, Vimeo, or Matterport URLs. Displayed as embedded iframes.
3. **AI-generated micro-videos** — Generated from listing photos (DEFERRED to post-launch, Section 13).

### Video Player Implementation

- **Direct video files** (MP4 from ARYEO or Supabase Storage): Use native HTML5 `<video>` tag with `playsinline`, `muted` (for autoplay), `loop` (for card previews), and `controls` (for full player). Preload `metadata` only to save bandwidth.
- **YouTube/Vimeo embeds** (from VirtualTourURLUnbranded): Parse the URL to detect the platform. Render as a lite-youtube or lite-vimeo web component (lazy-loaded iframe that only loads when clicked — saves ~500KB per embed).
- **Matterport 3D tours** (from VirtualTourURLUnbranded): Render as iframe embed with Matterport's embed SDK. Link to full-screen experience.

### Video on Listing Pages

- In the hero media collage (Section 8): video thumbnail tile with a play button overlay. Click opens the video in a lightbox/modal player.
- If ARYEO video exists, it plays inline in the hero section (muted, with unmute button).
- Video view events tracked via GA4 (`play_video` event with listing_id, video_source, video_duration).

### Video Feed (TikTok/Reels Style)

- Accessible from main navigation ("Video Tours" or "Explore").
- **Mobile:** Full-screen vertical scroll. Swipe up for next video. Each video has: listing photo/video auto-playing (muted by default, tap to unmute), price/address/beds/baths overlay at bottom, engagement buttons on the right (like, save, share, contact), tap to see full listing detail.
- **Desktop:** Grid of video thumbnails. Click to play in a lightbox with listing details alongside.
- Videos sorted by: newest, most viewed, trending. Filterable by community, city, price range.
- Implemented as a React component using Intersection Observer API for scroll-triggered autoplay/pause. Only the visible video plays; others pause to save bandwidth.

### Broker-Uploaded Video

Brokers upload video content through the admin backend (Media > Video Library):
- Manual upload (drag-and-drop MP4, MOV, or paste YouTube/Vimeo URL).
- ARYEO import (automatically captured during ARYEO media import).
- Content types: branded walkthrough videos, drone footage, community tour videos, market update videos, personal intro videos.
- Videos appear on the broker's landing page and on associated listing pages.

### Video Card Hover-Preview (Netflix Effect)

On any listing card site-wide that has video (ARYEO or MLS video), hovering (desktop) or scrolling into view (mobile) triggers a 3-5 second silent video preview loop. Implementation: a `<video>` tag with `muted autoplay loop playsinline` that is hidden until the Intersection Observer fires or a `mouseenter` event occurs. The static photo cross-fades to the video over 200ms. On `mouseleave` or scroll-out, cross-fade back to the static photo.

---

## 26. Imagery (Unsplash Integration & Media Pipeline)

Unsplash provides high-quality stock imagery for pages that don't have original photography. This prevents any page from looking empty or unprofessional.

### Where Unsplash Is Used

- **Community hero images:** Search Unsplash for "{community name} Oregon" or "Central Oregon {landscape/golf/mountains}". Cache the best result.
- **City hero images:** Search for "{city name} Oregon". Bend, Redmond, Sisters, Sunriver, La Pine each get a unique hero.
- **Neighborhood hero images:** Search for "{neighborhood name} Bend Oregon" or fall back to city-level imagery.
- **Homepage sections:** Lifestyle imagery for CTA sections, seasonal content, and background images.
- **Blog post featured images:** When a blog post doesn't have a custom image, auto-select from Unsplash based on the post title/keywords.
- **Default broker headshots:** Never. Brokers must have real photos. A placeholder silhouette is used until they upload one.

### Unsplash API Implementation

- **Server-side only.** The `UNSPLASH_ACCESS_KEY` is never exposed to the client.
- **Search endpoint:** `GET https://api.unsplash.com/search/photos?query={keywords}&orientation=landscape&per_page=5`
- **Selection logic:** Take the first result with a minimum resolution of 1920x1080. If no results match, try broader keywords (drop the city name, search just "Central Oregon mountains").
- **Caching:** Store the selected Unsplash photo URL and attribution data in a `page_images` table in Supabase. Never re-fetch for the same page unless admin explicitly refreshes.
- **Attribution:** Unsplash requires attribution. Store and display: photographer name, Unsplash profile URL. Display as small text below the image: "Photo by [Name] on Unsplash" with links. This is required by the Unsplash API Terms.
- **Admin override:** In the admin backend, any page's hero image can be replaced with an uploaded original photo. When an original is uploaded, it takes priority over Unsplash. Priority order: admin-uploaded original > ARYEO professional > MLS photo > Unsplash > AI-generated.

### Listings With No Photos

**Listings with zero photos are excluded from display entirely.** They do not appear in search results, feeds, cards, or sliders. They exist in the database for data completeness but are hidden from the UI with a `WHERE photos_count > 0` filter on all public queries.

### Image Optimization Pipeline

All images (from any source) go through the same optimization:
- **Sizes generated:** 300w (card thumbnails), 600w (mobile cards), 1200w (desktop cards and content), 2400w (hero images and full-screen gallery).
- **Formats:** WebP primary (30-50% smaller than JPEG), AVIF where supported (even smaller), JPEG fallback for older browsers.
- **Implementation:** Next.js `<Image>` component handles this automatically. Set `sizes` prop correctly for responsive loading. Use `placeholder="blur"` with a generated blur data URL for perceived instant loading.
- **Lazy loading:** All images below the fold use `loading="lazy"`. Hero images and above-fold content use `loading="eager"` with `priority={true}`.
- **CDN:** Vercel's built-in image CDN handles format conversion and resizing at the edge. No separate image CDN needed.

---

## 27. Sharing & Social Distribution

Every page on the site is shareable. The share experience must be seamless on both mobile and desktop, and every share must be tracked for analytics and lead attribution.

### Share Button Behavior

A single "Share" button (share icon) appears on every listing card, listing detail page, community page, city page, blog post, market report, and broker page.

**On mobile (iOS/Android):** Clicking the share button triggers the **Web Share API** (`navigator.share()`). This opens the native share sheet showing all installed apps (Messages, WhatsApp, email, social media, AirDrop, etc.). The share payload includes: title, text (brief description), and URL (with UTM parameters appended).

**On desktop (no Web Share API):** Clicking the share button opens a **share modal** with buttons for: Copy Link, Email, Facebook, X, LinkedIn, Pinterest, and SMS. Each button either opens a new window with the platform's share URL (pre-populated) or copies the shareable link to clipboard with a "Copied!" confirmation toast.

### Dynamic OG Images (Open Graph Previews)

When a link is shared on any platform, the preview must look professional and branded. Every page type has a dynamically generated OG image.

**Implementation:** Use `@vercel/og` (Satori engine) to generate OG images at the edge. Create an API route at `/api/og` that accepts parameters and returns a PNG:
- **Listing share:** Shows property hero photo, price, beds/baths/sqft, address, brokerage logo. Size: 1200x630px.
- **Community share:** Community hero image, name, median price, active listing count, brokerage logo.
- **Blog post share:** Post title, excerpt, author headshot, brokerage logo.
- **Market report share:** Key stats (median price, trend arrow, absorption rate), community/city name, brokerage logo.
- **Broker page share:** Broker headshot, name, star rating, transaction count, brokerage logo.

Every page's `<head>` includes `og:image` pointing to the dynamic OG route with the right parameters.

### UTM Parameters on All Shared Links

Every shared URL automatically appends UTM parameters for attribution tracking:
- `utm_source` = the platform (facebook, twitter, email, sms, link, etc.)
- `utm_medium` = social, email, or direct
- `utm_campaign` = share (distinguishes organic shares from paid campaigns)
- `utm_content` = the entity ID (listing_id, community_slug, post_slug)

These UTMs flow through to GA4 for traffic source analysis and to FUB when the visitor converts to a lead.

### Share Tracking

Every share event fires:
- `trackEvent('share_listing', { listing_id, share_method, page_type })` → GA4 via dataLayer
- `POST /v1/events` to FUB with share context (if the user is identified)
- Increment `share_count` on the entity's `engagement_metrics` record in Supabase
- Share counts are visible on listing cards and detail pages (social proof)

---

## 28. Lead Generation, Scoring, CRM & Behavioral Intelligence (Follow Up Boss)

This is the most critical section for business outcomes. Every user interaction on the site is tracked, scored, and pushed to Follow Up Boss via the Events API (`POST /v1/events`). The goal is to build the most comprehensive behavioral profile of every visitor so brokers can convert them with perfectly timed, contextually relevant outreach.

### 28.1 FUB Events API — Complete Event Inventory

Every event below is sent to FUB via `POST /v1/events` with the appropriate event type. All events include the `system` field (our site identifier) and the `source` field (our domain). All events include the `person` object (email, name, phone if known) and `campaign` object (UTM parameters if present).

**Registration Events (trigger Action Plans + Automations in FUB):**
- `Registration` — User creates an account (via Google, Apple, Facebook, or email). Includes: name, email, phone if provided, registration method, referring URL, UTM parameters.
- `General Inquiry` — User submits the contact form on any page (homepage, community, about, etc). Includes: message, page URL, form context.
- `Property Inquiry` — User submits a contact form or clicks "Contact Agent" on a specific listing. Includes: listing MLS number, address, price, listing URL.
- `Seller Inquiry` — User submits the "What's My Home Worth" form. Includes: address, estimated value (if computed), user's price expectation if provided.
- `Visited Open House` — User RSVPs for an open house event. Includes: listing address, open house date/time.

**Property Activity Events (tracked on lead timeline in FUB):**
- `Property Viewed` — User views a listing detail page. Includes: MLS number, address, price, beds/baths/sqft, listing URL. **Batched:** views are batched and sent every 5 minutes (not on every page load) to avoid rate limiting. Each batch includes all properties viewed in the window.
- `Property Saved` — User saves/favorites a listing. Includes: MLS number, address, price, listing URL. Sent immediately (high-intent signal).
- `Property Liked` — User likes a listing. Includes: MLS number, address, price.
- `Property Shared` — User shares a listing (any channel). Includes: MLS number, platform shared to.
- `Property Compared` — User adds a listing to the comparison tray. Includes: MLS numbers of all properties in the comparison.

**Search & Discovery Events:**
- `Property Search` — User executes a search (including filter changes). Includes: search filters as JSON (price range, beds, baths, community, property type, etc), result count. **Batched:** sent at end of search session or on navigation away.
- `Saved Search Created` — User saves a search. Includes: search name, filters, notification frequency.
- `Community Viewed` — User views a community page. Includes: community name, URL.
- `City Viewed` — User views a city page. Includes: city name.
- `Neighborhood Viewed` — User views a neighborhood page.
- `Blog Post Viewed` — User views a blog post. Includes: post title, URL.

**CMA & Report Events (highest-intent signals):**
- `CMA Downloaded` — User downloads a CMA report on a listing. Includes: property address, estimated value, MLS number. This is a **critical lead signal** indicating the user is seriously evaluating a property's value.
- `CMA Shared` — User shares a CMA via link or email.
- `Market Report Viewed` — User views a market report on a city/community page.
- `Market Report Downloaded` — User downloads a market report as PDF.
- `Valuation Requested` — User submits "What's My Home Worth" (same as Seller Inquiry).

**Engagement Events:**
- `Return Visit` — Known user (cookie match or login) returns to the site after 24+ hours absence. Includes: last visit date, pages viewed this session. This is a "Magic Moment" that triggers broker alerts.
- `Collection Shared` — User shares a curated collection of listings. Includes: number of listings, recipient info if email.
- `AI Chat Interaction` — User engages with the AI assistant. Includes: summary of the conversation (AI-generated, not verbatim), topics discussed, any listings referenced.
- `Tour Requested` — User clicks "Request a Tour." Includes: listing address, preferred date/time if provided.
- `Call Initiated` — User clicks "Call" button. FUB handles via phone number tracking.
- `Email Opened` — Tracked via pixel in Resend emails. Reported to FUB via `POST /v1/emEvents`.
- `Email Clicked` — Tracked via redirect links. Reported to FUB.
- `Email Bounced/Unsubscribed` — From Resend webhooks. Reported to FUB.

### 28.2 Geolocation Tracking

When a user first visits the site, a non-intrusive prompt asks: "Allow [site] to use your location for a better experience?" (standard browser geolocation API).

**If the user allows:**
- Latitude/longitude stored in their user record (if logged in) or cookie (if anonymous).
- Included in the FUB person record as a custom field: `location_lat`, `location_lng`, `location_city` (reverse geocoded).
- The site uses their location to: center the map on their area, show "near you" content, personalize the homepage, determine if they're browsing from within the service area (local buyer) or from out of town (relocation buyer — a high-value lead signal).
- If a user is browsing Bend listings from, say, Portland or San Francisco, that's a relocation signal. FUB gets tagged: `out-of-area-buyer`.
- If a user is browsing from within Bend, they get tagged: `local-buyer`.

**If the user declines:**
- Fall back to IP-based geolocation (coarse city-level). Store estimated location.
- No degraded experience. All features still work.

**Location stored in FUB custom fields:**
- `browsing_location` — The city/state they're browsing from.
- `is_local` — Boolean. Are they in the Central Oregon service area?
- `distance_from_service_area` — If out of area, how far? (Relocation indicator.)

### 28.3 CMA Download on Listing Pages (Public Lead Workflow)

Every listing page shows a **"Get This Home's Value Report"** CTA. This is a powerful lead capture mechanism because it offers instant, tangible value in exchange for contact information.

**User-facing workflow:**

1. User is browsing a listing page. They see the estimated value section (Section 6 of the listing page) showing the number and range.
2. Below the estimated value, a prominent CTA: **"Download Full Value Report"** with subtext: "See comparable sales, market trends, and detailed analysis." Icon of a PDF document.
3. **If the user is signed in:** One click. The pre-generated CMA PDF downloads instantly. Event `CMA Downloaded` pushed to FUB. The broker assigned to this user (or the listing agent) gets an immediate alert: "[User] just downloaded the CMA for [address]." This is a high-intent signal.
4. **If the user is NOT signed in:** Clicking the CTA opens a sign-in/sign-up modal. After authentication, the CMA downloads immediately. The user doesn't have to click again. The registration event AND the CMA download event both fire to FUB.
5. The CMA is **pre-generated** for every active listing by the background job (Estimated Value Computation). It's stored as a cached PDF in Supabase Storage. No computation delay at download time.

**CMA Display Design (In-Browser Preview + PDF):**

The CMA is designed to be both viewable in-browser (scrollable, interactive) and downloadable as a branded PDF. The design is clean, modern, and scannable. A user should be able to understand the key takeaway (estimated value) in 3 seconds and dig into details if they want.

**CMA Layout (Top to Bottom):**

**Page 1: Summary (The "3-Second View")**
- Brokerage logo (top left), report date (top right).
- Property hero photo (if available, full width, 40% of page height).
- Property address in large text.
- **Estimated Value: $XXX,XXX** (huge, bold, centered, brand primary color).
- Estimated range: $XXX,XXX — $XXX,XXX (smaller, below).
- Confidence indicator: High / Medium / Low with icon (green check, yellow dot, orange caution).
- Key property stats row: Beds | Baths | SqFt | Lot | Year Built | Garage.
- "Based on [X] comparable sales within [X] miles, sold in the last [X] months."

**Page 2: Comparable Sales**
- Section title: "Comparable Sales Analysis"
- Each comp displayed as a compact card (2 per row on desktop, 1 per row on mobile/PDF):
  - Small photo (if available, else placeholder).
  - Address (linked to listing page on web version).
  - Sold price (large), sold date.
  - Beds/Baths/SqFt/Lot/Year Built (compact row).
  - Distance from subject (e.g., "0.3 miles").
  - Price per sqft.
  - **Adjustment line:** "+$15,000 (larger sqft)" or "-$8,000 (older construction)". This is the key differentiator — showing WHY the comp price matters relative to the subject.
  - **Adjusted value** (comp price after adjustments applied to subject).
- After all comps: "Weighted Average of Adjusted Values: $XXX,XXX" (this IS the estimated value).
- Design note: Comps sorted by relevance (same subdivision first, then proximity). Most relevant comps visually emphasized (slightly larger card or subtle highlight border).

**Page 3: Market Context**
- Section title: "Market Conditions in [Community/City]"
- Market condition badge: "Seller's Market" / "Balanced" / "Buyer's Market" with color.
- 4 mini-charts (compact, 2x2 grid):
  - Median price trend (12 months, sparkline style with current value labeled).
  - Number of sales trend (12 months).
  - Days on market trend (12 months).
  - Months of inventory trend (12 months, color zones).
- Key stats row: Median Price | Avg DOM | Inventory | List-to-Sale Ratio.
- AI-generated 2-3 sentence narrative: "The Tetherow market is currently favoring sellers with 2.3 months of inventory. Homes are selling within an average of 34 days at 99.2% of asking price. Prices have increased 4.2% year-over-year."

**Page 4: Comp Map + Methodology**
- Google Maps static image showing: subject property (red pin with label), all comps (blue numbered pins matching comp cards).
- Scale bar and distance references.
- Methodology section (plain language, 3-4 sentences): "This value estimate is based on recent comparable sales in [community] and surrounding areas. Properties were selected based on similarity in size, age, and features, with adjustments made for differences. Sales within 90 days are weighted most heavily. This is a market analysis estimate and is not a substitute for a professional appraisal."
- Disclaimer: "This Comparative Market Analysis (CMA) is an estimate of market value based on available MLS data and is not an appraisal. Actual sale price may vary based on property condition, buyer/seller motivation, market changes, and other factors."
- Broker signature block: headshot, name, phone, email, designations, license, brokerage logo, Equal Housing logo.

**Design principles for the CMA:**
- Clean whitespace. Not crowded.
- Brand colors used sparingly (headings, estimated value, accent lines). Primary content in dark gray/black on white.
- Charts use the same design system as the site (Recharts/Chart.js style, brand colors).
- Typography: one heading font, one body font. Consistent with site typography.
- PDF is letter-size (8.5x11), portrait orientation. 4 pages maximum for the standard CMA.
- Web preview uses the same layout but is scrollable with interactive chart tooltips.

### 28.4 Lead Scoring System

Points assigned by behavior. Score stored per user in Supabase and synced to FUB as a custom field.

**Point values (configurable in admin):**

| Action | Points | Rationale |
|---|---|---|
| Registration | 10 | Baseline engagement |
| Property Viewed | 1 | Low intent per view |
| Property Saved | 5 | Moderate intent |
| Property Liked | 2 | Light engagement |
| Property Shared | 5 | Sharing indicates real interest |
| Search Executed | 1 | Exploring |
| Saved Search Created | 8 | Ongoing intent |
| CMA Downloaded | 15 | Very high intent — evaluating value |
| Market Report Downloaded | 8 | Research mode |
| Tour Requested | 20 | Highest intent CTA |
| Contact Form Submitted | 15 | Direct outreach |
| Call Initiated | 20 | Direct outreach |
| Return Visit | 5 | Re-engagement |
| Collection Shared | 10 | Curating for decision |
| "What's My Home Worth" Submitted | 15 | Seller lead |
| AI Chat Interaction | 3 | Moderate engagement |
| Open House RSVP | 12 | Intent to see in person |
| Out-of-area browsing (relocation signal) | 10 | High-value lead type |

**Score thresholds (configurable):**
- 0-10: Cold. Standard nurture.
- 11-30: Warm. Increase outreach frequency.
- 31-50: Hot. Broker should be actively engaging. Alert sent.
- 51+: Very Hot. Immediate personal outreach. Push notification to broker. Auto-create FUB task: "High-intent lead — reach out now."

**Score decay:** Points decay by 20% per week of inactivity to prevent stale high scores.

### 28.5 Lead Conversion Workflows

Automated workflows that trigger based on specific behavioral patterns. These go beyond simple scoring.

**Workflow 1: The "Silent Browser" (Anonymous High-Engagement)**
- Trigger: Anonymous visitor (no login) has viewed 5+ listings, visited 2+ community pages, and spent 10+ minutes on site.
- Action: Show a tasteful overlay: "Looking for your next home? Save your favorites and get personalized recommendations." CTA: "Create a Free Account."
- If they don't convert: set a cookie. On their next visit, show a different prompt: "Welcome back! You were viewing homes in Tetherow and Broken Top. Want to pick up where you left off?"

**Workflow 2: The "CMA Downloader" (High-Intent Buyer or Seller)**
- Trigger: User downloads a CMA report.
- Action: FUB event fires immediately. Broker alerted within 60 seconds. FUB auto-creates task: "Follow up on CMA download for [address]." If no broker response within 2 hours, escalate to broker admin.
- Follow-up email (Resend, 24 hours later): "Here's more about [community] — recent sales, market trends, and similar homes." Includes market intelligence tile and 3 similar listings.

**Workflow 3: The "Active Saver" (Curating a Shortlist)**
- Trigger: User saves 3+ listings within 48 hours.
- Action: FUB tag: `actively-shopping`. Email (Resend): "You've saved [X] homes! Want to schedule tours? [Broker] can help you see them in person." CTA links to tour request form pre-loaded with their saved listings.

**Workflow 4: The "Price Watcher" (Waiting for a Deal)**
- Trigger: User has saved a listing that gets a price drop.
- Action: Instant Resend notification: "[Address] just dropped $X. Now listed at $X." CTA: "View Updated Details" and "Request a Tour." FUB event: `Price Drop Alert Sent`. If the user clicks through, broker is alerted: "Price-watching lead is back on [address]."

**Workflow 5: The "Seller Curious" (Exploring Selling)**
- Trigger: User visits the "What's My Home Worth" page OR downloads a CMA for a home that is NOT currently listed (implies they own it).
- Action: FUB tag: `potential-seller`. Broker task: "Potential seller interested in [address/area]." Email drip (Resend): seller-focused content — market conditions, recent sales in their area, "Is now a good time to sell?" blog post.

**Workflow 6: The "Relocation Lead" (Out-of-Area Browsing)**
- Trigger: User's geolocation is 100+ miles from the service area AND they've viewed 3+ listings.
- Action: FUB tag: `relocation`. FUB note: "Browsing from [city, state]." Email: "Planning a move to Central Oregon? Here's what you need to know." Links to city page, community guide, and broker contact.

**Workflow 7: The "Ghosted Lead" (Re-engagement)**
- Trigger: Known lead (in FUB) hasn't visited the site in 30+ days.
- Action: Resend email: "The market in [their preferred community] has changed since your last visit. [X] new listings, median price now $X." Personalized with their saved search criteria. If they click through, FUB event: `Return Visit`. Broker alerted.

### 28.6 FUB Custom Fields

Set up the following custom fields in FUB to store website intelligence:

- `lead_score` (number) — Current lead score from Section 28.4.
- `browsing_location` (text) — City/state they browse from.
- `is_local` (boolean) — Are they in the service area?
- `preferred_communities` (text) — Comma-separated list of communities they've saved/viewed most.
- `preferred_price_range` (text) — Inferred from saved listings and searches.
- `preferred_beds` (text) — Inferred from searches.
- `buyer_or_seller` (dropdown) — Buying, Selling, Both, Unknown.
- `cma_downloads` (number) — Count of CMA reports downloaded.
- `last_active_date` (date) — Last site visit.
- `total_listings_viewed` (number) — Lifetime count.
- `total_listings_saved` (number) — Lifetime count.
- `saved_search_count` (number).
- `registration_source` (text) — UTM source at registration.
- `device_type` (text) — Desktop, Mobile, Tablet.

### 28.7 FUB Identity Bridge (Priority 6 Implemented)

`NEXT_PUBLIC_FUB_EMAIL_CLICK_PARAM` maps email clicks to cookies. Links anonymous visitors to known leads. When a known lead clicks a link in an email (Resend), the `_fuid` parameter in the URL associates their browser cookie with their FUB contact ID. All subsequent browsing is attributed to that lead.

### 28.8 Lead Routing

- On contact form submission: check FUB for existing contact by email. If found, route to assigned broker. If not found, create new contact using FUB round-robin assignment or area-based rules (configurable in admin).
- All payloads include full context: which page, which listing, UTM parameters, lead score, browsing history summary.

### 28.9 CTAs & Conversion Points

Every page has strategically placed CTAs. No page is a dead end.

- **Listing pages:** Request Tour (primary), Contact Agent (secondary), Download CMA (high-value), Save, Share. Sticky bar on scroll.
- **Community pages:** "Find Homes in [Community]" (search CTA), "Get Market Report," "Contact a [Community] Expert."
- **City pages:** "Search [City] Homes," "Download [City] Market Report," "What's Your [City] Home Worth?"
- **Neighborhood pages:** Same pattern as community.
- **Blog posts:** "Contact our team," inline CTAs within content.
- **Broker pages:** Lead capture form (primary CTA above fold, repeated at bottom).
- **"What's My Home Worth" page:** Address entry (ungated) → instant estimate → full breakdown gated behind contact info.
- **Search results:** After viewing 5+ listings without an account, prompt: "Save your search and get alerts when new homes match."
- **Exit intent popup:** When cursor moves toward browser close (desktop only), show: "Before you go — save your search and we'll email you new matches." Not shown to logged-in users or users who've dismissed it.
- **AI chat:** At the end of any substantial chat conversation, AI suggests: "Would you like me to connect you with a broker who specializes in [topic discussed]?"

### 28.10 Call Tracking (FUB Phone Numbers)

When a user clicks "Call" on any listing or broker page, the call is routed through a Follow Up Boss phone number. This means FUB tracks the call automatically (duration, caller ID, recording if enabled, which listing/broker triggered it). No separate call tracking service (like CallRail) is needed because FUB handles attribution natively.

- Every "Call" button on the site uses the FUB-assigned phone number for the relevant broker.
- FUB records the call and associates it with the lead's contact record.
- If the caller is a known FUB contact, the broker sees the full lead history before answering.
- If unknown, FUB creates a new contact from the caller ID.
- Call events appear in the admin lead activity timeline and in broker reporting.

---

## 29. Notification Architecture (Resend + FUB Dual Channel)

Two separate notification systems serve two different audiences. They work in parallel — the same user action often triggers notifications on BOTH channels.

### Follow Up Boss (Broker-Facing)

FUB handles ALL broker-facing communications. Brokers never see Resend emails — they see FUB alerts. Notifications to brokers include:
- **New lead alerts** — Instant notification when a new lead is created (form submission, registration, CMA download).
- **Lead activity alerts** — "Your lead [Name] just viewed 5 listings in Tetherow" or "Your lead downloaded a CMA for [address]."
- **Return visit alerts** — "Your lead [Name] is back on the site after 14 days." (Magic Moment)
- **Lead score threshold alerts** — When a lead crosses into "Hot" or "Very Hot" tier, FUB auto-creates a task: "High-intent lead — reach out now."
- **Drip campaigns** — Managed entirely within FUB. Not built in our app. Our app feeds data to FUB; FUB handles the broker follow-up sequences.

### Resend (User-Facing)

Resend handles ALL user-facing transactional emails. Implementation details:

**Resend SDK setup:**
```typescript
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY);
```

**Email types and triggers:**
| Email Type | Trigger | Frequency |
|---|---|---|
| Welcome email | Account creation | Once |
| Saved search match | New listing matches saved search filters | Instant, daily, or weekly (user's choice) |
| Price drop alert | A saved listing's price decreases | Instant |
| Status change alert | A saved listing goes Pending or Sold | Instant |
| Similar listing suggestion | A saved listing goes Pending → suggest alternatives | Once per event |
| Shared collection delivery | User shares a collection via email | On share |
| CMA report delivery | Broker emails a CMA to a contact | On send |
| Open house reminder | User RSVPs to an open house | 24 hours before + 1 hour before |
| Market digest | Weekly summary of market activity in user's areas of interest | Weekly |
| Password reset | User requests password reset | On request |

**Email template rendering:** All emails are built as React components using `@react-email/components` (works natively with Resend). This means emails are React components, not HTML strings — they're type-safe, composable, and easy to maintain.

**Resend webhook integration:** Resend sends webhook events for email delivery, opens, clicks, bounces, and unsubscribes. Our app receives these at an API route (`/api/webhooks/resend`) and:
- Reports open/click events to FUB via `POST /v1/emEvents`
- Updates the `email_campaigns` table with delivery stats
- Handles bounces by flagging the user's email in Supabase
- Handles unsubscribes by updating the user's notification preferences

### Dual Channel Event Flow (Example)

User saves a listing → logged in Supabase `saved_listings` table → event pushed to FUB (broker's assigned lead activity updates) → listing syncs with a price drop → Resend emails the user "Price dropped on your saved home" → email open tracked by Resend → reported to FUB → broker sees "Your lead opened the price drop email" → broker reaches out.

### Notification Queue Processing

All notifications go through the `notification_queue` table (defined in Section 7.10b). A background job (Inngest function) processes the queue every 30 seconds, respecting each user's frequency preferences and deduplicating multiple notifications about the same listing.

---

## 30. Tracking, Analytics & Cookie Policy (GA4 + GTM + Meta Pixel + CAPI)

### 30.1 Architecture Overview

All tracking flows through a single `window.dataLayer` array. Google Tag Manager (GTM) listens to the dataLayer and routes events to GA4, Meta Pixel, and any future platforms. This means adding a new tracking platform (TikTok Pixel, LinkedIn Insight, etc.) never requires code changes — just a new GTM tag.

**Flow:** User action → Next.js pushes event to `window.dataLayer` → GTM triggers fire → GA4 tag sends to Google → Meta Pixel tag sends to Meta → CAPI server-side events send from Next.js API routes for deduplication.

**Environment variables:**
- `NEXT_PUBLIC_GTM_CONTAINER_ID` — GTM container. Loads on every page.
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` — GA4 property. Configured as a Google Tag inside GTM.
- `NEXT_PUBLIC_META_PIXEL_ID` — Meta Pixel. Loaded via GTM.
- `META_CAPI_ACCESS_TOKEN` — Meta Conversions API. Server-side only.

### 30.2 Cookie Consent

Consent banner (GDPR/CCPA/Oregon Consumer Privacy Act). Categories: Essential (always on), Analytics (GA4, Clarity), Marketing (Meta Pixel), Personalization (saved preferences). Non-essential scripts fire ONLY after consent. GTM uses Consent Mode v2 to handle this. `CookieConsentBanner` component exists.

**Consent storage:** When a visitor interacts with the consent banner (accept all, reject non-essential, or granular selection), their choices are recorded in the `cookie_consents` table (see Section 6 schema) keyed by their `visitor_cookie_id` (a UUID set in a first-party cookie `rr_vid` on first visit, 2-year expiry). Cookie preferences are also stored in localStorage so the banner doesn't re-appear on repeat visits within the same browser.

**90-day anonymous data purge implementation:** A weekly cron job (`purge_non_consenting_data`, runs every Sunday at 2:00 AM Pacific) deletes rows from `user_activities` that meet ALL of the following conditions:
1. `user_id IS NULL` (anonymous session — no authenticated account attached)
2. `created_at < now() - interval '90 days'` (older than 90 days)
3. The visitor's `visitor_cookie_id` either has no record in `cookie_consents`, or has a record where `analytics = false` (consent was never granted for analytics tracking)

This ensures we never retain anonymous behavioral data beyond 90 days for visitors who did not consent to analytics. Authenticated users' activity data is retained per the privacy policy (7 years for business records, 2 years for behavioral data, configurable).

### 30.3 GA4 Custom Event Taxonomy

Every custom event follows GA4 naming conventions: lowercase, underscores, descriptive. Parameters add context. All events are defined here so the AI agent building the site AND the AI agent analyzing analytics share the same vocabulary.

**GA4 limits to respect:** Max 500 custom events per property. Max 25 parameters per event. Max 50 custom dimensions. Max 50 custom metrics. Our taxonomy uses approximately 30 custom events, well within limits.

#### Lead Generation Events (Marked as GA4 Conversions)

These are the actions that directly generate business value. All marked as "Key Events" (conversions) in GA4.

| Event Name | Trigger | Key Parameters | GA4 Conversion |
|---|---|---|---|
| `generate_lead` | Any contact form submitted | `lead_type` (buyer/seller/general), `form_location` (page URL), `listing_id` (if property-specific) | ✅ Yes |
| `tour_requested` | "Request a Tour" clicked and form submitted | `listing_id`, `listing_address`, `listing_price` | ✅ Yes |
| `call_initiated` | "Call" button clicked | `broker_name`, `listing_id` (if on listing page), `page_type` | ✅ Yes |
| `cma_downloaded` | User downloads CMA report | `listing_id`, `listing_address`, `estimated_value`, `is_gated` (true if required login) | ✅ Yes |
| `valuation_requested` | "What's My Home Worth" submitted | `address_entered`, `estimated_value` | ✅ Yes |
| `sign_up` | Account created (GA4 recommended event) | `method` (google/apple/facebook/email) | ✅ Yes |
| `open_house_rsvp` | Open house RSVP submitted | `listing_id`, `listing_address`, `event_date` | ✅ Yes |

#### Property Engagement Events

| Event Name | Trigger | Key Parameters |
|---|---|---|
| `view_listing` | Listing detail page viewed | `listing_id`, `listing_address`, `listing_price`, `community`, `city`, `beds`, `baths`, `sqft` |
| `save_listing` | User saves/favorites a listing | `listing_id`, `listing_price`, `community` |
| `like_listing` | User likes a listing | `listing_id`, `listing_price` |
| `share_listing` | User shares a listing | `listing_id`, `share_method` (email/facebook/link/etc) |
| `compare_listing` | User adds to comparison tray | `listing_id`, `comparison_count` (how many in tray) |
| `view_photo_gallery` | User opens full photo gallery | `listing_id`, `photo_count` |
| `play_video` | User plays listing video | `listing_id`, `video_source` (mls/aryeo/ai), `video_duration` |

#### Search & Discovery Events

| Event Name | Trigger | Key Parameters |
|---|---|---|
| `search` | User executes a property search (GA4 recommended) | `search_term` (text query if used), `filters_json` (beds/baths/price/community), `results_count` |
| `save_search` | User saves a search | `search_name`, `filters_json`, `notification_frequency` |
| `view_community` | Community page viewed | `community_name`, `community_type` (resort/standard) |
| `view_city` | City page viewed | `city_name` |
| `view_neighborhood` | Neighborhood page viewed | `neighborhood_name` |
| `view_blog_post` | Blog post viewed | `post_title`, `post_category`, `post_author` |
| `view_market_report` | Market report section viewed on city/community page | `geo_name`, `geo_type` |
| `download_report` | User downloads a market report PDF | `report_type`, `geo_name`, `time_period` |

#### Engagement & UX Events

| Event Name | Trigger | Key Parameters |
|---|---|---|
| `scroll_depth` | User scrolls to 25%, 50%, 75%, 100% | `percent_scrolled`, `page_type` (listing/community/city/blog) |
| `click_cta` | Any CTA button clicked | `cta_text`, `cta_location` (hero/sticky_bar/footer/sidebar), `page_type` |
| `calculator_used` | Payment calculator interacted with | `listing_id`, `fields_changed` (down_payment/rate/term) |
| `map_interaction` | User interacts with map (zoom, pan, draw boundary) | `action` (zoom/pan/draw/satellite_toggle), `page_type` |
| `share_collection` | User shares a curated collection | `listing_count`, `share_method` |
| `ai_chat_started` | User begins AI chat conversation | `page_type`, `initial_query` |
| `return_visit` | Known user returns after 24+ hours | `days_since_last_visit`, `total_visit_count` |
| `exit_intent_shown` | Exit intent popup displayed | `page_type`, `was_dismissed` (boolean) |

### 30.4 GA4 Custom Dimensions & Metrics

Register these as custom dimensions/metrics in GA4 Admin > Custom Definitions. They allow slicing reports by real estate-specific attributes.

**Custom Dimensions (Event-scoped):**
- `listing_id` — MLS number. Allows reporting on specific listing performance.
- `community` — Community/subdivision name. Allows "which communities get the most engagement?"
- `city` — City name. Geographic segmentation.
- `page_type` — listing / community / city / neighborhood / blog / broker / search / home. Allows "what page types drive the most conversions?"
- `lead_type` — buyer / seller / general. Segment leads by intent.
- `share_method` — email / facebook / instagram / link / text. Which sharing channels are used most.
- `cta_location` — hero / sticky_bar / sidebar / footer / inline. Which CTA placements convert best.

**Custom Dimensions (User-scoped):**
- `user_type` — anonymous / registered / broker. Segment all reports by user type.
- `is_local` — true / false. Are they browsing from within the service area.
- `preferred_community` — Most-viewed community for this user.
- `lead_score_tier` — cold / warm / hot / very_hot. Segment engagement by lead quality.

**Custom Metrics:**
- `listings_viewed` — Count of listings viewed per session. Understanding browsing depth.
- `listings_saved` — Count of listings saved per session. Intent signal.

### 30.5 GTM Container Structure

The GTM container should be organized with the following tag groups, triggers, and variables.

**Tags (organized by platform):**
- **Google Tag** (base GA4 configuration, fires on all pages via Initialization trigger)
- **GA4 Event tags** (one tag per custom event above, or use a single GA4 Event tag with a variable for event name)
- **Meta Pixel Base** (fires on all pages after marketing consent)
- **Meta Pixel Custom Events** (mirror key conversion events: Lead, ViewContent, Search, AddToWishlist)
- **Microsoft Clarity** (fires on all pages after analytics consent)
- **Google Ads Remarketing** (fires on all pages after marketing consent, if Google Ads are used)
- **Google Ads Conversion tags** (fire on conversion events)

**Triggers:**
- Page View (all pages)
- Custom Event triggers matching each dataLayer event name
- Scroll Depth triggers (25/50/75/100%)
- Form Submission triggers
- Click triggers (for CTAs, buttons, links)
- Timer triggers (for time-on-page/section tracking)
- Element Visibility triggers (for "viewed section" tracking, e.g., user scrolled to the payment calculator)

**Variables:**
- DataLayer variables for every parameter (listing_id, listing_price, community, etc.)
- 1st Party Cookie variables (user_id, consent_status)
- URL variables (page path, query string, UTM parameters)
- Custom JavaScript variables for computed values (e.g., extracting listing_id from the URL path)

### 30.6 Data Layer Implementation

In the Next.js application, a `trackEvent` utility function pushes events to the dataLayer:

```
// lib/tracking.ts
export function trackEvent(eventName: string, params: Record<string, any>) {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  }
}
```

This function is called from React components at the point of interaction. Examples:
- Listing page `useEffect` calls `trackEvent('view_listing', { listing_id, listing_price, community, city, ... })`.
- Save button onClick calls `trackEvent('save_listing', { listing_id, listing_price, community })`.
- CTA button onClick calls `trackEvent('click_cta', { cta_text, cta_location, page_type })`.

**Server-side tracking (Meta CAPI):** For conversion events (generate_lead, tour_requested, cma_downloaded), a server-side event is also sent from a Next.js API route to Meta Conversions API with the same event_id for deduplication. This ensures conversions are tracked even if the browser blocks client-side pixels.

### 30.7 GA4 Data API — Admin Dashboard Integration

The admin backend pulls GA4 data directly into the admin analytics dashboard using the GA4 Data API (`runReport` and `runRealtimeReport` methods). This means brokers and admins see site analytics without leaving the admin backend.

**Authentication:** A Google Cloud service account with Viewer access to the GA4 property. The service account JSON key is stored as an environment variable. The GA4 property ID is stored as `GA4_PROPERTY_ID` in env vars.

**Data pulled into admin dashboard:**

**Real-time panel (updates every 60 seconds):**
- Active users right now (from `runRealtimeReport`).
- Active users by page type (listing/community/search/blog).
- Events firing right now (top 5 event names with counts).

**Daily/weekly/monthly summary (cached, refreshed hourly):**
- Total sessions, users, new users.
- Avg session duration, pages per session, bounce rate equivalent (engagement rate).
- Top 10 most viewed listings (by `view_listing` event count, with listing address and community).
- Top 10 most saved listings.
- Top 10 most viewed communities.
- Top 10 most viewed blog posts.
- Top traffic sources (organic, direct, paid, social, referral, email) with session counts.
- Top search queries on-site (from `search` event's `search_term` parameter).
- Conversion funnel: sessions → listing views → saves → contact form → tour request. Visualized as a funnel chart.
- Conversion rate by traffic source (which sources produce the most leads per session).
- Device breakdown (desktop/mobile/tablet).
- Geographic breakdown (city-level, from GA4 geo dimensions).

**Listing-specific analytics (viewable per listing in admin):**
- Total views, unique viewers, saves, shares, CMA downloads.
- Traffic sources driving views to this listing.
- Avg time on listing page.
- Conversion events (inquiries, tour requests) attributed to this listing.
- Trend chart: views per day for the last 30 days.

**SEO dashboard (from Google Search Console API, refreshed daily):**
- Top 20 queries by impressions and clicks.
- Click-through rate (CTR) by query.
- Average position by query.
- Top 20 pages by impressions and clicks.
- Indexed page count.
- Crawl errors (if any).
- This data is already confirmed available via the GA4 Data API service account credential in `.env.local`.

### 30.8 AI Analytics Agent

A dedicated AI agent (separate from the coding agent) continuously reviews analytics data and generates actionable insights. This agent runs daily as a background job.

**What the AI analytics agent does:**

1. **Pulls GA4 data** via the Data API: traffic trends, conversion rates, top/bottom performing pages, engagement metrics, funnel drop-off points.
2. **Pulls Search Console data:** keyword trends, position changes, CTR changes, new queries appearing.
3. **Pulls internal data** from Supabase: listing engagement, lead scores, FUB conversion rates, email performance.
4. **Analyzes for patterns:**
   - Which pages have high traffic but low conversion? (Optimization opportunity.)
   - Which listings get views but no saves? (Possible pricing or photo issue.)
   - Which communities are trending up in search impressions? (Content opportunity.)
   - Which traffic sources have the best lead-to-close ratio? (Budget allocation insight.)
   - Are there pages with high bounce rates that need content improvement?
   - Are there broken pages or 404 errors spiking?
   - Which blog posts drive the most organic traffic? (Create more like these.)
   - Which CTA placements convert best? (Replicate across pages.)
5. **Generates insights** written in plain language and stores them in the `agent_insights` table.
6. **Prioritizes insights** as high/medium/low based on potential impact.
7. **Presents in admin dashboard** as an "AI Insights" panel with a daily digest.

**Example insights the agent might generate:**
- "Tetherow community page traffic is up 34% this week but conversion rate dropped 12%. Consider updating the CTA or adding more compelling content."
- "The search term 'homes for sale bend oregon' gained 15 positions this month. The Bend city page is now appearing on page 2 of Google. Recommend creating additional content targeting this keyword."
- "Listings with professional video get 2.3x more saves than listings without. Consider prioritizing ARYEO uploads for active listings."
- "The 'Download CMA' button on listing pages has a 4.2% click rate, which is 3x higher than the industry average for gated content. This is your highest-converting CTA."
- "Mobile users have a 40% lower conversion rate than desktop. The contact form may need mobile UX improvements."

### 30.9 Meta Pixel & Conversions API

Meta Pixel loads via GTM after marketing consent. Key events mirrored to Meta:
- `ViewContent` (listing viewed) with `content_ids` = listing_id, `value` = listing_price, `content_type` = 'home'.
- `Search` (property search) with `search_string` = filters summary.
- `AddToWishlist` (listing saved).
- `Lead` (any contact form, tour request, CMA download).
- `CompleteRegistration` (account created).

Server-side CAPI sends the same events from Next.js API routes with `event_id` for deduplication. This ensures accurate tracking even with ad blockers or iOS privacy changes.

### 30.10 UTM Tracking & Attribution

All outbound links (email campaigns, social posts, ads) include UTM parameters: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`. UTM values are captured on page load and stored in the session. When a user converts (submits a form, downloads CMA, etc.), the UTM values are included in the FUB event payload for attribution. This closes the loop from ad spend to lead.

### 30.11 Microsoft Clarity

Clarity (free) loaded via GTM after analytics consent. Provides click heatmaps, scroll maps, and session recordings. The AI analytics agent can reference Clarity data for UX insights. No additional API key needed — Clarity has a simple GTM tag.

### 30.12 Key GA4 Reports for Non-Technical Users

GA4's standard reports can be confusing. Configure these custom reports in GA4 Explorations so Matt and the brokers can easily understand performance:

**"Listing Performance" report:** Dimensions: listing_id, community, city. Metrics: event count (view_listing), event count (save_listing), event count (cma_downloaded), event count (generate_lead). Shows which listings get the most attention and which convert.

**"Lead Funnel" report:** Funnel exploration: Step 1: session_start → Step 2: view_listing → Step 3: save_listing → Step 4: generate_lead. Shows where users drop off and how many make it through each step.

**"Community Popularity" report:** Dimensions: community. Metrics: event count (view_community), event count (view_listing filtered by community parameter), event count (save_listing filtered by community). Ranks communities by interest level.

**"Traffic Sources → Leads" report:** Dimensions: session_source, session_medium. Metrics: sessions, engaged_sessions, event count (generate_lead), event count (sign_up). Shows which marketing channels produce leads.

**"Content Performance" report:** Dimensions: page_path, page_type. Metrics: sessions, avg engagement time, event count (generate_lead). Shows which pages keep users engaged and which drive conversions.

### Admin Visibility

Visitor log, lead timelines, top pages, conversion funnel.

---

## 31. Admin Backend & Content Management (Full CRUD)

Every visible element editable. Built for non-technical operators. The admin backend is a full application with its own navigation, dashboard, and workflows.

### Admin Access & URL

The admin backend is accessible at **`/admin`** (e.g., `https://ryan-realty.com/admin`). It is a completely separate layout from the public site — different navigation, different header, different sidebar. The `/admin` route and all sub-routes are protected by middleware that checks:
1. User is authenticated (Supabase Auth session exists).
2. User has a role of `super_admin`, `broker_admin`, `broker`, or `viewer` in the `users` table.
3. If neither condition is met, redirect to `/admin/login`.

The admin login page (`/admin/login`) uses the same Supabase Auth but is styled with the admin layout, not the public site layout.

**`robots.txt` must include `Disallow: /admin/`** to prevent search engines from indexing the admin backend.

### Default Superuser (First-Run Setup)

When the application is deployed for the first time and the database is empty, a **first-run setup flow** is triggered:

**Step 0 — Environment Variable Validation (runs before showing the wizard):**
Before presenting the Setup Wizard, the server checks that the following critical environment variables are set and non-empty:
- `SPARK_API_KEY` (MLS data — nothing works without this)
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
- `FOLLOWUPBOSS_API_KEY` (lead management)
- `RESEND_API_KEY` (email delivery)

If any of these are missing, **do not show the Setup Wizard**. Instead, show a **Configuration Checklist** page at `/admin` listing each missing variable with a one-line instruction for how to add it:
- "Set `SPARK_API_KEY` in Vercel > Settings > Environment Variables. Get this from your FlexMLS back office account."
- etc.

This page auto-refreshes every 30 seconds. Once all critical variables are present, it automatically transitions to the Setup Wizard.

1. The first person to visit `/admin` (after env vars are valid) sees a **Setup Wizard** (not the login page).
2. The wizard collects: Full name, Email, Password (this creates the first Supabase Auth user).
3. This user is automatically assigned the `super_admin` role.
4. The wizard then collects basic brokerage info: Brokerage name, primary color, logo upload (or skip for now).
5. After completion, the user is logged in and lands on the admin dashboard.
6. The first-run flag is stored in the `settings` table (key: `first_run_complete`, value: `true`) so the wizard never appears again.

**For Ryan Realty:** Matt will be the default super_admin. He can then add brokers via People > Broker Team.

### Admin Navigation Structure (Sidebar)

The admin backend uses a persistent left sidebar with the following top-level navigation items. Each expands to show sub-items. The sidebar collapses to icons on smaller screens.

**Dashboard** (home screen, see Analytics & AI Dashboard below)

**Listings**
- All Listings (search, filter, sort, bulk actions)
- My Listings (broker's own, filtered by license match)
- Enhanced Listings (ARYEO uploads, manual media)
- Sync Status (full sync dashboard per Section 7.11)

**Communities & Locations**
- Communities (CRUD, resort flag, boundaries, content)
- Neighborhoods (CRUD, parent city assignment)
- Cities (CRUD, content)
- Boundary Manager (KML upload, Google Places polygon viewer)

**People**
- My Leads (broker's FUB-assigned contacts, CRM mirror view)
- All Users (registered site users, activity, exports)
- Anonymous Visitors (cookie-tracked, high-engagement flagged)
- Broker Team (manage brokers, onboard, roles, permissions)

**Content**
- Blog Posts (create, edit, publish, AI-generate)
- AI Content Queue (drafts awaiting review/approval)
- AI Video Queue (generated clips to approve/reject)
- Social Posts (content engine drafts, approve and publish)
- Site Content (about page, homepage sections, footer, nav, announcements)

**Email**
- Compose (template selector, listing picker, recipient selector)
- Campaigns (sent campaigns, performance stats)
- Drafts (saved unsent emails)
- Templates (view/customize email templates)

**Reports**
- Market Reports (generate, view, schedule, share)
- Broker Performance (leaderboard, individual drill-down)
- Lead Analytics (sources, conversion, response time)
- Site Analytics (traffic, engagement, top content)
- Listing Performance (views, saves, shares per listing)

**Media**
- Media Library (all images, upload, Unsplash, AI generation)
- Video Library (MLS videos, ARYEO videos, AI-generated clips)

**Settings**
- Brokerage Profile (name, logo, colors, fonts, contact info)
- Social Accounts (OAuth connections, default hashtags)
- Integrations (FUB, Resend, Google Maps, Spark API status)
- SEO Settings (default meta templates, sitemap config, robots.txt)
- Notification Defaults (email frequency defaults, CAN-SPAM compliance)
- Redirect Manager (301 redirects, bulk import)
- Background Jobs (all scheduled processes, status, monitoring, manual run triggers)
- Audit Log (all admin actions, filterable)

### Universal AI Writing Assistant (Every Text Field)

**CRITICAL: Every multi-line text field in the entire admin backend has an AI writing assistant attached to it.** This is not limited to the email editor. It appears on:

- Community descriptions
- Neighborhood descriptions
- City descriptions
- Broker bios
- Blog post content
- Listing description supplements
- Homepage section content
- About page content
- Social post captions
- Email body text
- Any other textarea or rich text editor in admin

**How it works on every text field:**

A small **"AI Assist"** button (sparkle icon ✨) appears in the top-right corner of every multi-line text input.

Clicking it opens a compact panel with:
1. **Action selector:** Generate from scratch, Rewrite existing text, Expand (make longer), Condense (make shorter), Fix grammar/spelling.
2. **Tone selector:** Professional, Friendly, Concise, Enthusiastic, Empathetic, Luxury/Sophisticated, Casual, Urgent.
3. **Context:** The AI automatically has context from the page (e.g., if editing a community description, it knows the community name, location, listing data). If editing a broker bio, it knows the broker's name, specialties, and transaction history.
4. **Optional prompt field:** "Any specific instructions?" (e.g., "Mention the golf course" or "Focus on families").
5. **Generate button:** AI (X AI / Grok) generates the text. It appears in a preview below.
6. **Insert / Replace:** One click to insert the generated text into the field, replacing or appending to existing content.
7. **Regenerate:** Try again with a different result.

**Implementation:** A reusable `<AIAssistButton>` React component that wraps any `<textarea>` or rich text editor. It calls a server action (`/api/ai/generate-text`) with the context, tone, action, and optional prompt. The API route calls X AI / Grok with a system prompt that includes the brand tone guidelines and the page context.

### Roles & Permissions

Four roles, each with clearly defined access. The super_admin assigns roles when adding users.

**Role: Super Admin**
Full, unrestricted access to everything. This is you (Matt). Only super_admins can:
- Add/remove users and change roles
- Access brokerage-wide settings (branding, integrations, SEO)
- View all broker performance data and lead analytics
- Manage the data sync (start, stop, force resync)
- Access the audit log
- Manage redirect rules and site-wide content
- Delete any content (listings, blog posts, communities, etc.)

**Role: Broker Admin**
Senior brokers or team leads. Everything a Broker can do, PLUS:
- View and manage other brokers' profiles (but not delete them)
- View brokerage-wide lead analytics and reports
- Edit brokerage content (about page, homepage featured listings)
- Manage the content queue (approve/reject AI-generated content and social posts)
- Create and send email campaigns to any FUB contacts (not just their own)
- Access all listings (not just their own)

**Role: Broker**
The standard broker experience. Full access to their own world:
- **Profile:** Edit all their own profile info (bio, headshot, photos, videos, specialties, social links, external platform IDs). Full media upload/delete on their own profile.
- **Listings:** View all listings. Enhance their own listings (ARYEO import, additional photos/video, supplemental description). Generate CMAs for any listing. Feature their own listings.
- **Leads:** View and manage their own FUB-assigned leads. See lead activity timeline. See lead score and engagement history.
- **Email:** Compose and send emails using the email editor with templates. AI writing assistant available. Send to their own FUB contacts. Email any page to a lead ("Email This Page" feature).
- **Social:** Draft social posts for their own listings. Publish to connected social accounts.
- **Reports:** Generate market reports for any area. Generate CMAs. View their own performance stats. Download/share/email any report.
- **Blog:** Create blog post drafts (enter content queue for admin approval before publishing).
- **Share with Lead:** Use the "Share with My Lead" feature on any page to send branded content to their FUB contacts.
- **Cannot:** Add/remove other users, change roles, edit brokerage settings, access other brokers' leads, edit other brokers' profiles, manage the data sync, access the audit log.

**Role: Viewer/Staff**
Read-only access for office staff or assistants:
- View all listings, reports, and analytics dashboards
- View (but not edit) broker profiles and lead data
- Cannot send emails, edit content, upload media, or make any changes

### Permissions Matrix (Quick Reference)

| Feature | Super Admin | Broker Admin | Broker | Viewer |
|---|---|---|---|---|
| View all listings | ✅ | ✅ | ✅ | ✅ |
| Enhance own listings (ARYEO, media) | ✅ | ✅ | ✅ | ❌ |
| Edit own broker profile & media | ✅ | ✅ | ✅ | ❌ |
| Edit other brokers' profiles | ✅ | ✅ | ❌ | ❌ |
| Compose & send emails | ✅ | ✅ | ✅ (own leads) | ❌ |
| AI Writing Assistant | ✅ | ✅ | ✅ | ❌ |
| Generate CMAs & reports | ✅ | ✅ | ✅ | ✅ (view only) |
| Download/share reports | ✅ | ✅ | ✅ | ✅ |
| View own leads (FUB) | ✅ | ✅ | ✅ | ✅ (read only) |
| View all leads | ✅ | ✅ | ❌ | ❌ |
| Draft social posts | ✅ | ✅ | ✅ (own listings) | ❌ |
| Approve/publish social posts | ✅ | ✅ | ❌ | ❌ |
| Create blog post drafts | ✅ | ✅ | ✅ (enters queue) | ❌ |
| Publish blog posts | ✅ | ✅ | ❌ | ❌ |
| Edit homepage & site content | ✅ | ✅ | ❌ | ❌ |
| Edit communities & geo content | ✅ | ✅ | ❌ | ❌ |
| Manage users & assign roles | ✅ | ❌ | ❌ | ❌ |
| Brokerage settings & branding | ✅ | ❌ | ❌ | ❌ |
| Data sync controls | ✅ | ❌ | ❌ | ❌ |
| Integrations (FUB, Resend, etc.) | ✅ | ❌ | ❌ | ❌ |
| Audit log | ✅ | ❌ | ❌ | ❌ |
| SEO settings & redirects | ✅ | ❌ | ❌ | ❌ |

### User Management

**Adding a user:**
1. Super Admin goes to People > Broker Team > "Add Broker" button.
2. Fills in: First name, Last name, Email, Role (dropdown: Broker Admin, Broker, Viewer).
3. Clicks "Send Invite." System sends an invitation email via Resend with a unique signup link.
4. The invited person clicks the link, sets their password (or uses social auth), and their account is created with the assigned role.
5. Their profile is pre-created in the `brokers` table with the basic info. They can then log in to `/admin` and complete their profile (bio, headshot, etc.).

**Managing users:**
- View all users in a table: name, email, role, status (active/invited/deactivated), last login, listing count.
- Edit role (dropdown change, immediate effect).
- Deactivate (user can no longer log in to admin, but their profile and data are preserved).
- Reactivate (restore access).
- Delete (permanently removes admin access; profile data optionally retained or deleted).
- Activity log per user (last login, actions taken in admin).

**Role stored in database:**
```sql
-- In the users table (extends Supabase Auth)
ALTER TABLE users ADD COLUMN admin_role text CHECK (admin_role IN ('super_admin', 'broker_admin', 'broker', 'viewer'));
```

**Middleware enforcement:** Every admin API route and page checks the user's `admin_role` before allowing access. This is not client-side hiding of UI elements — it's server-side enforcement. Even if someone modifies the frontend to show a hidden button, the API route rejects the request if the role doesn't have permission.

### Full CRUD on Every Entity

- **Communities** — All fields, hero, boundary data (Google Places polygon or KML import), resort flag, amenities.
- **Neighborhoods, Cities** — All fields, hero, parent relationships.
- **Broker profiles** — Full profile editor with tabs:
  - **Profile tab:** First name, last name, display name, email, phone, Oregon license number, MLS ID, title/designations, years of experience, specialties (tag selector), service areas (community multi-select), tagline.
  - **Bio tab:** Rich text editor for bio with AI Assist button. "Why work with me" section with AI Assist.
  - **Media tab:** 
    - **Professional headshot:** Upload (drag-and-drop or file picker). Crop tool to ensure consistent aspect ratio (1:1 square). This is the primary photo used on the broker landing page hero, email signatures, listing attribution, and social cards.
    - **Additional photos:** Upload gallery of lifestyle/professional photos (at showings, with clients, community events, office photos). Used on the broker landing page.
    - **Video uploads:** Upload or paste URL for personal intro video, market update videos, community tour videos. MP4 upload goes to Supabase Storage. YouTube/Vimeo URLs stored as embeds.
    - **All uploaded media** stored in Supabase Storage under `/brokers/{broker_id}/`.
  - **Social tab:** Social media account URLs and OAuth connections per Section 19.
  - **External profiles tab:** Zillow Agent ID, Realtor.com profile ID, Yelp Business ID, Google Business Profile ID (for review aggregation per Section 21).
  - **Signature tab:** Preview of auto-generated email signature. Broker can see exactly how their signature will look in emails.
- **Brokerage content** — About, mission, reviews, awards, service areas.
- **Homepage** — Featured listings, spotlights, hero, market snapshot, all sections.
- **Blog posts** — Create (via AI blog engine or manual), edit, publish, unpublish, delete.
- **Reports** — Generate, configure, share.
- **Navigation and footer** — Items, labels, links.
- **Announcements** — Site-wide banners.
- **AI content queue** — Review, approve, edit, regenerate.
- **AI video queue** — Approve or reject generated clips.
- **Content engine drafts** — Social posts for review and publish.
- **Listings** — Search, filter, sort, flag, feature, override descriptions, sync status, manual re-sync.
- **Enhanced listings** — ARYEO URL intake, manual media upload, manage premium content.

### Lead & User Management

All registered users and anonymous visitor activity. Lead pipeline with score, status, broker. Activity timelines. Export.

### Broker CRM View (FUB Mirror)

Each broker, when logged into the admin backend, sees a CRM dashboard that mirrors their assigned contacts from Follow Up Boss.

**How it works:**
- A scheduled sync job pulls contacts from FUB via `GET /v1/people` filtered by assigned agent.
- Contact data is cached in Supabase (name, email, phone, tags, stage, lead score, assigned date, last activity, source).
- The broker's admin view shows their contacts with search, filter, and sort.
- Each contact shows: name, email, phone, lead score, source, assigned date, last activity timestamp, and a link to their full profile in FUB.
- Contact's website activity is also visible (pages viewed, listings saved, searches run, time on site) pulled from the site's own activity_events table.
- Clicking a contact shows a combined timeline: FUB events (calls, emails, notes, tasks) + website events (views, saves, shares, searches, chat interactions) in chronological order.
- Brokers can see at a glance which of their leads are actively browsing the site right now or were recently active.

**What brokers can do from this view:**
- Click through to the full FUB contact record (opens FUB in a new tab).
- Send an email directly from the site (see Email From Website below).
- Create and send a saved search for this contact.
- View all listings this contact has saved, liked, or viewed.
- See the contact's buyer preferences if they set them on the site.

**Sync frequency:** Every 15-30 minutes or on-demand when a broker opens their CRM view. Cache in Supabase to minimize FUB API calls.

### Broker Saved Search Email Campaigns

Brokers can create curated saved searches and send them as beautifully formatted emails to their assigned contacts.

**How it works:**

1. **Broker creates a saved search in admin.** They define the search criteria (community, price range, beds, baths, or any filter combination) and give it a name (e.g., "Luxury Homes in Tetherow Under $1.2M").
2. **System generates a rich email preview.** The email contains:
   - Branded header (Ryan Realty logo, colors).
   - Search title and description.
   - Listing cards (3-6 matching listings) with: hero photo, price, beds/baths/sqft, address, community, status. Each card is visually consistent with the site's Universal Card design.
   - Each listing card links to the listing page on the website.
   - A "View All Results" button linking to the full search results page on the site.
   - Broker's contact info and headshot in the footer.
3. **Broker selects recipients.** From their CRM view, they select individual contacts or filter by tags/stage to create a recipient list.
4. **Every link in the email includes FUB tracking.** All URLs include the FUB email click parameter (`_fuid` with the contact's FUB ID). This means when the recipient clicks any link, the identity bridge (Priority 6) connects them to their FUB record, and the site tracks their browsing session.
5. **Email sent via Resend.** The actual email delivery happens through Resend (not FUB).
6. **Events reported back to FUB.** After sending, the system:
   - Creates an email campaign in FUB via `POST /v1/emCampaigns` with the email subject and HTML body.
   - Saves the FUB campaign ID.
   - Reports delivery events via `POST /v1/emEvents` (delivered, opened, clicked, bounced, unsubscribed).
   - This means the email and all engagement shows up in the contact's FUB timeline, and the broker sees opens/clicks in FUB's interface.
7. **Broker sees campaign performance in admin.** Sent count, open rate, click rate, which contacts opened, which listings were clicked.

**Ongoing saved searches:** If the broker enables "auto-send" on a saved search, the system monitors for new listings matching the criteria and automatically sends update emails (with the same rich format and FUB tracking) on a configurable schedule (daily, weekly). These automated sends also report events back to FUB.

### Email Any Page From the Website

Any page on the website (listing, community, city, report, blog post, comparison) can be emailed directly.

**How it works:**

1. **"Email This Page" button** available on every page (alongside the share button).
2. **For logged-in brokers:** Clicking opens a compose modal:
   - Pre-populated with a rich HTML preview of the page content (listing details, community stats, report charts, etc.).
   - Recipient field (can type email or select from their FUB contacts).
   - Optional personal message field.
   - All links in the email body include FUB tracking parameters for the recipient.
   - Sent via Resend. Events reported to FUB.
3. **For regular users:** Clicking opens a simpler share-by-email flow:
   - Pre-filled subject line (e.g., "Check out this home at 19496 Tumalo Reservoir Rd").
   - Recipient email field.
   - Optional personal message.
   - Branded email with page preview content and link back to the site.
   - Sent via Resend. If the sender is a known user, the share event is logged to `user_activities` with `activity_type = 'email_page'`.
   - **For unauthenticated users:** Display a Cloudflare Turnstile CAPTCHA widget in the form (using `NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY`). Validate the Turnstile token server-side before sending. This prevents automated spam.
   - **Rate limiting (Upstash Redis):** Unauthenticated users: max 3 email sends per hour per IP. Authenticated users: max 10 per hour. Return HTTP 429 with message "Email limit reached. Please try again later." if exceeded.
4. **Rich email format:** The email is not just a link. It contains a visual preview of the page content (photos, key data, charts if applicable) so the recipient gets value immediately in their inbox, with CTAs to "View Full Details" on the site.

### FUB Email Tracking Architecture

The technical flow for all emails sent from the site with FUB tracking:

1. **Before sending:** Create campaign in FUB via `POST /v1/emCampaigns` with subject and HTML body. Save the returned campaign `id`.
2. **Link rewriting:** Every link in the email body is rewritten to include: the recipient's FUB contact ID as the `_fuid` parameter, UTM parameters for source attribution, and a click tracking redirect through the site (to capture the click event before redirecting to the destination page).
3. **Send via Resend:** Deliver the email. On successful delivery, report `delivered` event to FUB via `POST /v1/emEvents`.
4. **Open tracking:** Embed a 1x1 tracking pixel in the email. When loaded, report `open` event to FUB.
5. **Click tracking:** When a tracked link is clicked, the site's redirect handler reports `click` event to FUB (with the destination URL) and then redirects the user to the actual page. The identity bridge also fires, linking the cookie to the FUB contact.
6. **Bounce/unsubscribe handling:** Resend webhooks report bounces and unsubscribes. These are forwarded to FUB via `POST /v1/emEvents`.

This creates a complete loop where every email interaction appears in the FUB contact timeline, the broker sees full engagement data, and the site can track the recipient's browsing session after they click through.

### Email Template Library

A library of pre-built, branded email templates that brokers can select when sending emails. Templates use React Email (compatible with Resend) and match the site's visual design language. All templates are mobile-responsive, dark-mode compatible, and render correctly across major email clients (Gmail, Outlook, Apple Mail, Yahoo).

#### Template Types

**1. Single Listing Alert**
- Hero photo of the listing (full-width, high quality).
- Price prominently displayed with estimated monthly payment.
- Beds, baths, sqft, lot size, year built in a clean stats row.
- Address and community name.
- Status badge (New, Price Reduced, Back on Market, Open House).
- 2-3 additional photos in a smaller grid below the hero.
- Brief property description (first 150 characters of MLS remarks).
- Two CTA buttons: "View Full Listing" and "Schedule a Tour."
- Broker info footer with headshot, name, phone, email.
- All links include FUB tracking.

**2. Multi-Listing Digest (Saved Search Results)**
- Header with search criteria summary (e.g., "New Homes in Tetherow | $600K-$900K | 3+ Beds").
- 3-6 listing cards in a vertical stack. Each card contains: hero photo, price, beds/baths/sqft, address, community, one-line description. Click-through to the listing page.
- Cards mirror the site's Universal Card design as closely as email HTML allows.
- "View All X Matches" CTA button linking to the full search results on the site.
- Broker info footer.

**3. Just Listed Announcement**
- Bold "JUST LISTED" header with branding.
- Large hero photo.
- Full listing details (price, stats, description, key features).
- Multiple photos (3-5 in a grid).
- Strong CTA: "Be the First to See This Home" or "Schedule a Private Tour."
- Broker info footer.
- P.S. line: "Know someone who might be interested? Forward this email."

**4. Just Sold Announcement**
- "JUST SOLD" header.
- Property photo and sold price.
- Original list price vs sold price (shows broker's negotiation skill).
- Days on market.
- Brief success story or testimonial from the seller.
- CTA: "Thinking of Selling? Find Out What Your Home Is Worth."
- Broker info footer.

**5. Open House Invitation**
- Event-style header with date, time, and address.
- Property hero photo.
- Key listing details.
- Map showing property location.
- "RSVP" CTA button.
- "Add to Calendar" link (.ics file).
- Broker info footer.

**6. Market Report / Community Update**
- Header with report title and date range.
- Key stats displayed as visual KPI cards (median price, inventory, DOM, price trends).
- 1-2 charts rendered as static images (generated server-side, embedded in email).
- Brief narrative summary (AI-generated).
- "View Full Report" CTA linking to the report page on the site.
- Broker info footer.

**7. Home Valuation Report**
- Personalized to the homeowner's address.
- Estimated value prominently displayed.
- Estimated range.
- Brief comp summary (2-3 nearby recent sales with prices).
- "See Full Analysis" CTA (links to the gated valuation detail page).
- "Schedule a Free Consultation" CTA.
- Broker info footer.

**8. Shared Collection**
- Header: "[Broker Name] Shared These Homes With You."
- 3-8 listing cards in a vertical stack.
- Optional personal message from the sender at the top.
- "View Full Collection" CTA linking to the branded collection page.
- Broker info footer.

**9. Welcome Email**
- Sent on account creation.
- Warm greeting, brief intro to the site's features.
- Quick links: Search Homes, Explore Communities, Get Your Home Value.
- Broker introduction (assigned broker's headshot, name, phone).
- "Need Help? Reply to This Email" CTA.

**10. Price Drop Alert**
- Compact format showing: property photo, old price (strikethrough), new price, reduction amount and percentage.
- "View Updated Listing" CTA.
- Broker info footer.

#### Email Template Editor (Admin)

The admin backend includes a visual email editor that allows brokers and admins to compose and customize emails without touching code.

**Editor features:**
- **Template selector:** Choose from the pre-built templates above. Each template loads with placeholder content that the editor populates from listing/community/report data.
- **Listing picker:** Search and select listings to insert into the email. Selected listings auto-populate the template with their photos, price, stats, and details. Drag to reorder listings.
- **Community/page picker:** Insert community, city, or report content blocks.
- **Personal message field:** Rich text area for the broker to add a custom message above or below the template content.
- **Subject line editor:** Pre-filled with a suggested subject (customizable). Character count shown.
- **Live preview:** Side-by-side view showing the editor on the left and a rendered preview on the right. Toggle between desktop and mobile preview.
- **Recipient selector:** Search FUB contacts by name, email, tag, or stage. Multi-select. Or paste email addresses for non-FUB contacts.
- **Schedule send:** Send immediately or schedule for a future date/time.
- **Test send:** Send a test email to yourself before sending to recipients.
- **Save as draft:** Save without sending. Drafts appear in the admin email drafts section.
- **Campaign naming:** Name the campaign for tracking in admin and FUB.

**What the editor does NOT need to be:**
- A full drag-and-drop email builder (like Mailchimp). The templates handle layout. The editor handles content population and personalization.
- The focus is on making it fast and intuitive for a broker to select a template, pick listings, add a personal note, choose recipients, and send. Under 2 minutes from start to send.

### Admin Share-to-Lead Flow (Browsing the Site as a Broker)

When a logged-in broker is browsing the public-facing site (not just the admin backend), they see an enhanced share experience.

**How it works:**
- When a broker is authenticated and has the Broker or Broker Admin role, the standard share button on every page shows an additional option: **"Share with My Lead."**
- Clicking "Share with My Lead" opens a modal:
  1. **Lead selector:** Type-ahead search of their FUB-assigned contacts. Shows name, email, lead score, last activity.
  2. **Template selector:** Choose how to share. Options include: Quick Share (just a link with a preview), Single Listing Template, or custom note with the page content embedded.
  3. **Personal message:** Optional text field.
  4. **Send:** Sends via Resend with full FUB tracking.
- This means a broker can be browsing the site, find a listing that's perfect for a client, and share it directly from the listing page without ever going to the admin backend.
- The share event is logged: which broker, which lead, which page, when. Visible in admin analytics and in the lead's FUB timeline.

### Analytics & AI Dashboard (Admin)

Not just a summary page. A full analytics home screen in the admin backend.

**Layout:**
- **KPI cards row at the top:** Total active listings, total site visitors (today/this week/this month), new leads (today/this week/this month), total registered users, conversion rate (visitors to leads).
- **Traffic chart:** Line chart showing daily visitors over the last 30/60/90 days. Filterable by source (organic, direct, social, email, paid).
- **Top performing content:** Tables showing top 10 listings by views, top 10 communities by views, top 10 blog posts by views, top 10 search queries. Each row shows: title, views, unique visitors, engagement (saves/likes/shares), trend arrow (up/down vs prior period).
- **Lead pipeline:** Funnel visualization showing visitor > registered user > engaged lead > contacted > converted. Numbers and percentages at each stage.
- **Broker performance summary:** Quick table of all brokers with: active listings, leads, response time, conversions. Links to full broker performance dashboard (Section 40).
- **Recent activity feed:** Live stream of recent events: new user registrations, listing saves, tour requests, messages sent, AI chat interactions. Shows the last 50 events with timestamps.
- **AI agent insights panel:** Latest recommendations from the AI optimization agent with approve/dismiss actions. Priority-ranked.
- **Sync status widget:** Current sync status, last sync time, records synced, errors if any. Link to full sync dashboard.
- **Email campaign performance:** Recent email campaigns with open rate, click rate, total sent. Link to full email analytics.

### Image Management

**Not just an upload button.** A full media library in the admin backend.

**Features:**
- **Media library view:** Grid of all uploaded images with thumbnails, filterable by type (listing, community, broker, blog, site element), source (original upload, MLS, Unsplash, AI-generated), and associated entity.
- **Upload:** Drag-and-drop upload area. Support for multiple files. Auto-generates multiple sizes (300w, 600w, 1200w, 2400w). Auto-converts to WebP/AVIF.
- **Unsplash browser:** Search Unsplash by keyword directly in the media library. Select an image and it's cached in Supabase with attribution.
- **AI image generation:** Request an AI-generated image by description. Generated image is stored in the media library.
- **Image details:** Click any image to see: all sizes generated, current usage (which pages reference this image), alt text (editable), source attribution, upload date, file size.
- **Bulk operations:** Select multiple images to delete, re-categorize, or regenerate sizes.
- **KML file upload:** Upload KML files for community boundary definitions. Preview the boundary on a map before saving.
- **Orphan detection:** Identify uploaded images not currently used on any page (potential cleanup candidates).

### Admin UI Principles

Inline editing, drag and drop, WYSIWYG, bulk actions, role-based access, mobile-friendly.

### Audit Trail

Every admin action is logged with who, what, when, and the before/after state:
- Content edits (listing descriptions, community pages, broker bios)
- Settings changes (feature flags, tenant config, role assignments)
- Content approvals/rejections (AI drafts, video queue, social posts)
- User management actions (invites, role changes, deactivations)
- Sync operations (manual re-syncs, pause/resume)
- Viewable in admin as a filterable activity log. Essential for multi-user environments and required when selling this as a product.

### Broker Onboarding Wizard

When a new broker is invited to the system, they go through a guided onboarding flow:
1. Accept invite email (via Resend) and create their account.
2. Upload professional headshot.
3. Fill in bio, specialties, designations, Oregon license number, MLS ID.
4. Connect external review accounts (Zillow ID, Realtor.com ID, Yelp, Google Business).
5. Set up contact preferences (phone, email, social links).
6. Preview their broker landing page.
7. Confirm and publish.

This ensures every broker page is complete and professional from day one.

### 301 Redirect Management

When URLs change (listing removed, community renamed, slug updated), broken links destroy SEO equity. The admin backend includes a redirect management tool:
- Automatically create 301 redirects when a slug is changed.
- Manual redirect creation (old URL > new URL).
- Bulk redirect import via CSV.
- Redirect log showing all active redirects, hit counts, and creation dates.
- Redirect chain detection (A > B > C should be flattened to A > C).

---

## 32. Reporting Engine

The reporting engine is a core differentiator. It provides the most comprehensive, real-time, visually engaging market analysis available for Central Oregon real estate. Every report uses data from `reporting_cache` which is recomputed after every sync, ensuring all data is current.

**Geographic scope:** Reports are generated for EVERY city, community, and neighborhood in our Spark API data subscription — not just a handful of major markets. The Cascades East MLS covers Bend, Redmond, Sisters, Sunriver, La Pine, Madras, Prineville, Terrebonne, Crooked River Ranch, Eagle Crest, Black Butte Ranch, Tumalo, Powell Butte, Culver, Metolius, Camp Sherman, and dozens more. Every community/subdivision in the MLS data (hundreds of them) gets its own market report auto-generated from reporting_cache. Smaller markets with fewer transactions automatically use quarterly data points instead of monthly. The system scales to whatever data the Spark API provides.

### 32.1 City Market Report (Public-Facing, Beacon Report Equivalent)

Every city page automatically displays a comprehensive market report. This is the equivalent of the Beacon Report but better: it is real-time, interactive, downloadable, shareable, and built from live MLS data.

**Report sections (for each city, e.g., Bend, Redmond, Sisters, Sunriver, La Pine, Madras, Prineville):**

**Section 1: Median Price Trend**
- Line chart showing median sold price by month for the last 3 years (36 data points).
- Each data point labeled with the dollar amount.
- Y-axis in thousands. Title: "[City] SFR — Median Price."
- Note below chart: "Median is the midpoint with half above and half below."
- For smaller markets with fewer sales, use quarterly instead of monthly.

**Section 2: Number of Sales**
- Line chart showing monthly closed transactions.
- Subtitle showing: "Total sold 12 months prior: [X]. Total currently listed: [X]. Inventory as of report date: [X] months."
- Inventory defined as current listings ÷ prior 12 months' sales.

**Section 3: Days on Market for Sold Properties**
- Line chart showing median DOM by month.
- Note: DOM represents time from listing date to contract date (not closing date).

**Section 4: Months Supply of Inventory**
- Line chart showing months of inventory by month.
- Color-coded regions: green (seller's market, <4 months), yellow (balanced, 4-6), red (buyer's market, >6).

**Section 5: Median Price per Square Foot**
- Line chart showing median sold price per sqft by month.

**Section 6: Transaction Type Split (Conventional vs Cash)**
- Dual-line chart showing conventional financing transactions vs cash transactions by month.
- Shows the mix of buyer types in the market.

**Section 7: Sales vs Current Listings by Price Range**
- Grouped bar chart with price brackets on X-axis ($0-$100K, $100-$150K, ... $1M-$1.2M, $1.2M-$1.4M, ... $1.8M+).
- Three bars per bracket: sales last month (blue), sales last 12 months (gray), currently listed (green).
- This shows where supply and demand align or diverge at each price point.

**Section 8: KPI Summary Cards**
- At the top of the report section: Median Price, Total Sales (12mo), Avg DOM, Inventory Months, Price/SqFt, YoY Price Change %. Each as a visual card with trend arrow.

**Display on city pages:**
- The full report renders inline on the city page in an interactive, scrollable section.
- Charts are rendered using Recharts or Chart.js with hover tooltips showing exact values.
- A "Download Report as PDF" button generates a branded PDF of the full report (brokerage logo, colors, date, disclaimer).
- A "Share This Report" button generates a branded social card image and shareable link with OG tags.
- Charts are responsive (resize for mobile, tablet, desktop).

**User-configurable time range:**
- Dropdown or toggle at the top of the report section allowing the user to switch between: Last 6 months, Last 12 months (default), Last 3 years, Last 5 years, Last 10 years, All available data.
- Charts update dynamically when the time range changes.

### 32.2 Community and Neighborhood Market Reports

Same chart types as the city report but scoped to a specific community or neighborhood. Displayed inline on community and neighborhood pages. For communities with lower transaction volume, use quarterly data points instead of monthly to smooth out noise.

Additional community-specific metrics:
- HOA dues trend (if available).
- Average lot size trend.
- New construction vs resale split.

### 32.3 One-Click CMA Generation (Broker Admin)

When a broker views any listing or property in the admin backend, they can click **"Generate CMA"** and have a comprehensive, branded CMA report ready in seconds.

**CMA generation workflow:**

1. **Broker clicks "Generate CMA"** on any listing in admin (or enters any address in the CMA tool).
2. **System runs the CMA engine** (Section 10) using the stored procedure. Sub-2-second computation.
3. **Report is generated** containing:

**CMA Report Sections:**
- **Cover page:** Brokerage branding (logo, colors, name), property address, report date, broker name/headshot/contact.
- **Subject property summary:** Photo (if available), address, beds/baths/sqft/lot/year built, current listing status and price (if active), most recent sale price and date (if sold).
- **Estimated value:** Prominently displayed with range and confidence indicator.
- **Comparable sales detail:** 6-10 comps, each showing:
  - Address, photo (if available), sold price, sold date.
  - Beds/baths/sqft/lot/year built.
  - Distance from subject.
  - Adjustments applied (sqft differential, age differential, feature differences) with dollar amounts.
  - Adjusted price after all adjustments.
  - Price per square foot.
  - DOM.
- **Comp map:** Google Maps static image showing subject property (red pin) and all comps (blue pins) with distance lines.
- **Market context section:** Market intelligence for the community/area:
  - Median price trend chart (12 months, matching the city report format).
  - Number of sales trend.
  - DOM trend.
  - Months of inventory.
  - Buyer's/seller's market classification.
  - Price per sqft trend.
- **Sales vs inventory by price range** chart for the area.
- **Methodology narrative:** AI-generated plain language explanation of how the estimate was derived, which comps were weighted most heavily and why, and what market conditions mean for the value.
- **Disclaimer:** Standard CMA disclaimer that this is an estimate and not an appraisal. Fair housing compliance language. MLS attribution.
- **Broker signature:** Headshot, name, designations, license number, phone, email, brokerage info, Equal Housing logo.

4. **Broker can:**
   - **Preview** the report in the browser (scrollable, interactive).
   - **Download as branded PDF.**
   - **Email directly** to a contact (opens the email editor with the CMA report attached or linked, FUB-tracked).
   - **Generate a shareable link** (gated: recipient must enter email to access full report, creating a lead in FUB).
   - **Edit/customize** before sending: add personal notes, adjust the narrative, select which comps to include/exclude, override the estimated value with their professional opinion.

5. **CMA is logged:** Which broker generated it, for which property, when, who it was sent to. Visible in admin analytics and in FUB.

### 32.4 Report Generator (Admin > Reports)

The admin backend has a dedicated report generator that allows brokers and admins to create custom market reports.

**Report generator interface:**

1. **Select report type:**
   - City Market Report (Beacon-equivalent)
   - Community Market Report
   - Neighborhood Market Report
   - Multi-area Comparison Report (select multiple cities/communities to compare side by side)
   - CMA Report (for a specific address)
   - Broker Performance Report
   - Listing Engagement Report
   - Expired Listing Prospecting Report
   - Price Reduction Report

2. **Select geographic scope:**
   - Multi-select cities (Bend, Redmond, Sisters, Sunriver, La Pine, Madras, Prineville, etc).
   - Multi-select communities within selected cities.
   - Multi-select neighborhoods.

3. **Select time period:**
   - Smart presets: This week, Last 7 days, Last 30 days, Last quarter, Last 6 months, Last 12 months (default), Last 2 years, Last 3 years, Last 5 years, Last 10 years, All available data, Custom date range (calendar picker).

4. **Select property type filters:**
   - Single Family Residential (default, excludes condos, manufactured, acreage per Beacon standard).
   - Option to include/exclude: Condos/Townhomes, Manufactured Homes, Acreage/Land, Multi-family.

5. **Select price range filter** (optional): min-max price.

6. **Generate:** Report renders in-browser in seconds from reporting_cache data. All charts are interactive (hover for values).

7. **Actions on generated report:**
   - Download as branded PDF.
   - Share as link (public URL with OG tags).
   - Share as social media card (branded image).
   - Email to contacts (via email editor, FUB-tracked).
   - Schedule recurring delivery (daily/weekly/monthly via Resend).
   - Create blog post from report (AI writes narrative, one-click publish).
   - Include in a CMA (attach market report to a CMA being generated).

### 32.5 Admin Reports (Internal)

- **Lead analytics:** Sources, conversion rates, lead score distribution, response time, broker attribution.
- **User engagement:** Active users, returning users, session duration, popular pages/features.
- **Sync health:** Records synced, errors, speed, uptime.
- **AI agent performance:** Recommendations made, implemented, outcomes.
- **Broker production leaderboard:** Rank by volume, transactions, avg sale price, avg DOM.
- **Search Console / SEO dashboard:** Rankings, impressions, clicks from Google Search Console API.
- **Email campaign performance:** Send rates, open rates, click rates, per campaign and aggregate.

### 32.5b Broker-Specific Reports

- **Broker monthly recap:** Auto-generated monthly by background job for each broker. Contains: closed transactions, new leads received, lead response time, listing engagement stats, top performing listings. Sent via Resend as a formatted email AND viewable in admin.
- **Expired/withdrawn listing prospecting report:** Listings that expired or were withdrawn in the last 30/60/90 days. Shows: address, original list price, DOM, listing agent/office (if another brokerage = prospecting opportunity). Filterable by community, price range, property type.
- **Price reduction report:** Listings with price drops this week/month. Filterable.
- **Listing engagement report:** Per-listing breakdown of views, saves, shares, inquiries over time.
- **Absorption rate report:** Months of inventory per community/city. Community cards color-coded: green (seller's market <4mo), yellow (balanced 4-6mo), red (buyer's market >6mo).

### 32.5c Report Scheduling

Brokers and admins can schedule any report to auto-generate and deliver on a recurring basis:
- Select report type and all filters.
- Set frequency: daily, weekly (choose day), monthly (choose day of month).
- Set delivery time (e.g., 8:00 AM).
- Set distribution list (email addresses via Resend, or "send to all brokers").
- Report auto-generates on schedule, renders to PDF, and emails to the list.
- Example: "Weekly Bend Market Overview" auto-sends every Monday at 8am. "Monthly CMA Accuracy Report" auto-sends 1st of every month.
- Scheduled reports visible and manageable in admin under Reports > Scheduled.

### 32.6 Report Display Standards

All charts follow consistent design standards:
- Use brokerage brand colors for primary data series.
- Secondary series use a complementary color from the brand palette.
- All charts have clear titles, axis labels, and data point labels where space permits.
- Hover tooltips show exact values on all interactive charts.
- Charts use Recharts or Chart.js, rendered SSR for SEO (static image fallback for bots).
- Responsive: readable on mobile (charts scale, labels condense).
- Print-optimized: PDF exports render charts as high-DPI images.
- Accessibility: charts have alt text descriptions and data tables available for screen readers.

### 32.7 Export Formats

All reports exportable in:
- **PDF** (branded, print-ready, high-DPI charts).
- **Image** (PNG, optimized for social sharing, branded card with key stats).
- **CSV / Excel** (raw data underlying the report, for broker's own analysis).
- **Shareable link** (public URL with OG tags for social preview).

### 32.8 Blog Integration

Any report can be turned into a blog post. Admin clicks "Create Blog Post from Report," AI generates a narrative analyzing the data (using the brand tone), admin reviews and publishes with one click.

---

## 33. Market Stats Pre-Computation

**See Section 7.10 (Post-Sync Processing Pipeline) for the complete implementation.** The `compute_market_stats` stored procedure, the `reporting_cache` schema, and the full processing chain are defined there. This section is kept as a reference pointer only.

---

## 34. Identified Personalization

When a user is signed in (or recognized via cookie), the entire site adapts to their behavior and preferences. This is not a single feature but a system-wide layer that affects every page.

### How Personalization Manifests Per Page Type

**Homepage:**
- "Welcome back, [Name]" if signed in.
- Featured listings section shows homes matching their buyer preferences instead of the generic featured set.
- Community spotlight prioritizes communities they've browsed or saved homes in.
- "New in communities you follow" section shows recent listings in their saved search areas.
- Market snapshot shows stats for their area of interest instead of the whole service area.
- "Homes For You" section with AI recommendations.
- If they have saved listings that recently changed (price drop, pending, sold), a notification banner appears at the top.

**Search page:**
- Filters pre-filled with their buyer preferences (price range, beds, baths).
- Map centered on their area of interest (inferred from saved homes and browsing).
- Recent searches appear as quick-access chips below the search bar.
- Results weighted toward communities they've shown interest in.

**Listing page:**
- Monthly payment calculator pre-filled with their saved buyer preferences (down payment %, credit score, interest rate) instead of defaults.
- "Homes For You" slider personalized to their history.
- "People who viewed this also viewed" reflects co-viewing patterns.
- AI chat has full context about what they've saved, viewed, and searched.

**Community page:**
- If they've been browsing this community, show "You've viewed X homes in [Community]" with links to those listings.
- Highlight new listings since their last visit.

**Broker page:**
- If the user is a lead assigned to this broker in FUB, the page can show a personalized message (e.g., "Welcome back! [Broker] is ready to help you find your home in [Community].").

### Personalization for Anonymous Visitors

Even without login, the site uses cookies to personalize:
- Track which pages they visit, which listings they view, which communities they browse.
- After 3+ listing views, the "Homes For You" section starts showing relevant suggestions based on their browsing patterns.
- The AI chat uses their browsing session as context.
- If they return (cookie recognized), their previous browsing context informs the experience.
- When they eventually log in, all anonymous history merges with their profile.

### Progressive Engagement

The site should get smarter with each visit:
- **First visit:** Generic homepage. Cookie set. Browsing tracked.
- **Second visit (recognized cookie):** "Welcome back" feel. Recommendations start appearing based on first visit behavior.
- **Third+ visit:** Personalization is fully active. Listings they've viewed before show a "Viewed" badge. Communities they frequent are highlighted.
- **After login:** Full personalization with saved searches, notifications, and FUB integration.

---

## 35. Third Party Data (Schools, Walkability, Scores)

### Required Data

Walk Score, Transit Score, Bike Score. School info (nearby, district, rating, distance). Community livability score. Flood zone, hazard, crime data if available.

### How to Get These

- **Walk Score:** Applied for API access at walkscore.com/professional. Awaiting approval. Cost ~$0.01/request. Populate for active listings only. Cache in Supabase.
- **SchoolDigger (replaces GreatSchools):** Sign up at developer.schooldigger.com. Free tier: 2,000 calls/month included. Provides school ratings, test scores, student/teacher ratios, demographics for 120,000+ US schools. Much more affordable than GreatSchools. If the budget does not support an API, school data can be manually added in the admin backend per community or sourced from the NCES (National Center for Education Statistics) public dataset.

### Oregon Data Share Attribution & Logo

Every page displaying MLS data must include:
- **Oregon Data Share logo** (download from oregondatashare.com/datafeeds, three size options available).
- **Listing broker name and brokerage** (from Spark API, already stored in Supabase).
- **ODS attribution text** from Sections 5-3 and 5-4 of the ODS Rules and Regulations. The exact required language includes an "All rights reserved" statement, data accuracy disclaimer, and source attribution. Pull the verbatim text from your ODS/COAR agreement.
- **"Last updated" timestamp** showing when listing data was last synced.
- Attribution must be directly adjacent to listing price, bed/bath, sqft, or photo per IDX standards. Font size and color must be no smaller or lighter than the property description text.

### Freshness

Refresh weekly or monthly. Cache heavily in Supabase.

### API Cost Budget

Target under $300/month total for all third-party API costs combined (Google Maps, Walk Score, SchoolDigger, review APIs). To manage Google Maps costs: cache static map renders per page in Supabase or CDN so a map is only loaded live once per page, then served from cache on subsequent visits. Use static map images where interactive maps are not needed (e.g., listing cards, email previews, social share images).

---

## 36. Seller Experience & "What's My Home Worth"

The seller journey is a primary lead generation funnel. When a homeowner clicks "Sell" in the navigation or the "What's My Home Worth?" CTA, they enter a dedicated experience.

### "What's My Home Worth" — Page URL & Entry Points

- **URL:** `/sell/home-value`
- **Entry points:** "Sell" nav dropdown ("What's My Home Worth" link), homepage "What's Your Home Worth?" CTA section (Section 16), community pages seller CTA, any "Sell" contextual CTA across the site.
- The `/sell` page (landing page — see below) links prominently to `/sell/home-value`.

### "What's My Home Worth" Flow

1. **Address entry.** User types their home address. Auto-complete from the listing database and Google Places. If the address exists in Supabase (from historical MLS data), we immediately have data to work with.
2. **Instant estimate.** Using the valuation engine (Section 10), generate an estimated value. Priority order: same subdivision recent closings first, then year built, then proximity. This is the same CMA-based logic used on listing pages but applied to the user's home.
3. **Value display page.** Shows:
   - Estimated value (single prominent number)
   - Estimated sales range (low to high)
   - Recent comparable sales in their subdivision (addresses, sold prices, dates, photos if available)
   - 10-year price trend for their community/area
   - Current market conditions (inventory, avg DOM, median price for their area)
   - How their home compares (price/sqft vs community average)
4. **Lead capture gate.** The estimated value number is shown immediately (ungated) to create the "aha moment." But to see the full breakdown (comps used, detailed analysis, downloadable report), the user must provide their contact info (name, email, phone). This creates the lead in FUB with the property address as context.
5. **CTA to connect with a broker.** "Want a more accurate valuation? Connect with a local expert for a free CMA." Schedules a consultation. Routes to appropriate broker in FUB.

**Edge case — Insufficient comparable data:**
If the entered address has zero comparable sales within 1 mile and 12 months, do **not** show a $0 or null estimated value. Instead show:
> "Insufficient Data — We don't have enough recent sales near this address to generate a reliable estimate. A local broker can provide a personalized analysis."
Show the estimated value field as "—" with an explanation badge. Display the broker contact CTA prominently.

**Edge case — Address not found:**
If the address cannot be resolved by Google Places autocomplete or does not match any record in the Supabase properties table, show:
> "Address not found. Please check the address or contact us for a manual valuation."
Offer a "Contact Us" button. Do not show an empty estimate or a valuation form with a null address.

### Seller Content Pages

SEO-optimized content pages for the seller journey:
- "How to Sell Your Home in Oregon" (step-by-step guide)
- "What to Expect During the Selling Process"
- "How to Prepare Your Home for Sale"
- "Understanding Your Home's Value"
- "Choosing the Right Listing Agent"

These are AI-generated (via the blog engine) with admin review and publish. They target long-tail seller keywords and build trust with homeowners earlier in their journey.

### Seller Notifications

When a homeowner enters their address for a valuation, they can opt in for ongoing market updates:
- "A home similar to yours just sold for $750K"
- "Inventory in your neighborhood dropped 15% this month"
- "Your estimated home value changed"
- Delivered via Resend. Events pushed to FUB so the assigned broker sees the engagement.

---

## 37. Home Comparison Tool

Buyers constantly compare homes. This tool makes it effortless and tracks the comparison behavior as a high-intent lead signal.

### Comparison Tray (Persistent UI Element)

- A "Compare" button appears on every listing card and listing detail page (part of the Universal Card action buttons).
- When clicked, the listing is added to the **comparison tray** — a sticky bar at the bottom of the viewport.
- The tray shows thumbnails of selected homes (2-4 maximum), a count badge, and a "Compare Now" button.
- The tray persists across page navigation (stored in React context + localStorage for non-logged-in users, or Supabase `user_comparisons` table for logged-in users).
- Remove a home from the tray by clicking the X on its thumbnail.
- If the user tries to add a 5th home, prompt: "Remove one to add another. Maximum 4 homes can be compared."
- **Login merge behavior:** When an anonymous user (with listings in the comparison tray stored in localStorage) logs in, automatically merge their localStorage tray with any existing `user_comparisons` record for that user. Deduplicate by `listing_id`. If the merged count exceeds 4, keep the 4 most recently added and show a toast: "Your comparison was trimmed to 4 homes." This merge happens silently in the `onAuthStateChange` callback — the user should not need to re-add homes already in their tray.

### Comparison Page Layout

When the user clicks "Compare Now," they navigate to `/compare?ids=listing1,listing2,listing3`:

**Header row:** Each home's hero photo in a horizontal row of columns (2, 3, or 4 columns depending on count). Below each photo: address, price (large), and a "Remove" button.

**Comparison rows (vertical scroll):** Each row compares one attribute across all homes:
| Attribute | Display | Highlight Logic |
|---|---|---|
| Price | Dollar amount | Lowest price highlighted green |
| Price per sqft | Dollar amount | Lowest highlighted green |
| Beds | Number | Highest highlighted green |
| Baths | Number | Highest highlighted green |
| Living area (sqft) | Number with commas | Largest highlighted green |
| Lot size | Acres or sqft | Largest highlighted green |
| Year built | Year | Newest highlighted green |
| HOA fee | Monthly amount or "None" | Lowest (or None) highlighted green |
| Property taxes | Annual amount | Lowest highlighted green |
| Est. monthly payment | Dollar amount (using user's buyer prefs if logged in) | Lowest highlighted green |
| Days on market | Number | Lowest highlighted green |
| Community | Name (linked) | No highlight |
| Walk Score | Number | Highest highlighted green |
| School rating | Number | Highest highlighted green |
| Garage spaces | Number | Highest highlighted green |
| Status | Badge | No highlight |
| Estimated value | Dollar amount (if VOW allows) | No highlight |

**Highlight logic:** The "best" value in each row gets a subtle green background. This instantly draws the eye to which home wins on each metric. When values are equal, no highlight.

**Map section:** Below the comparison table, a Google Map showing all compared homes as numbered pins (matching the column order).

**CTA per column:** Each column has "Contact Broker," "Schedule Tour," "Save," and "Share" buttons at the bottom.

### Sharing Comparisons

The entire comparison is shareable as a single link (`/compare?ids=...`). This link generates a branded OG image showing all compared homes with key stats. The shared comparison page is accessible to anyone (no login required to view, but saving or contacting requires auth).

### Tracking

Every comparison action pushes to GA4 and FUB:
- `compare_listing` event when a home is added to the tray.
- `view_comparison` event when the comparison page loads.
- FUB receives the comparison context: "Lead is comparing [address1] vs [address2] vs [address3]." This tells the broker exactly what the buyer is deciding between.

---

## 38. Open Houses

### Open House Data Source

Open house schedules come from the Spark API via the `$expand=OpenHouse` parameter during listing sync. The OpenHouse resource includes: `OpenHouseKey`, `ListingKey`, `OpenHouseDate`, `OpenHouseStartTime`, `OpenHouseEndTime`, `OpenHouseRemarks`, `ShowingAgentName`.

**Storage:** `open_houses` table in Supabase:
```sql
CREATE TABLE open_houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id),
  open_house_key text UNIQUE,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  host_agent_name text,
  remarks text,
  rsvp_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_open_houses_date ON open_houses(event_date) WHERE event_date >= CURRENT_DATE;
```

Synced during the delta sync when `$expand=OpenHouse` is included. Past open houses are retained for history but filtered out of upcoming views.

### Dedicated Open Houses Page (`/open-houses`)

- Accessible from main navigation under a "Buy" dropdown or as a top-level nav item.
- **Default view:** "This Weekend" showing all open houses for the upcoming Saturday and Sunday.
- **Filters:** Date range picker, community (multi-select), city, price range, beds, baths.
- **Three view modes:**
  - **Map view:** Google Map with pins for each open house. Pin label shows the time window. Click pin to see listing card with open house details.
  - **List view:** Listing cards with prominent open house date/time badge. Sorted by date, then time.
  - **Calendar view:** Week or month calendar with open houses as events. Click an event to see the listing.
- SEO: Title "Open Houses in Bend, Oregon — This Weekend and Upcoming", JSON-LD Event schema for each open house.

### Open House on Listing Pages

When a listing has an upcoming open house, it's prominently displayed:
- **Banner** below the hero section: "Open House: Saturday, March 15, 1:00 PM — 3:00 PM" with the host agent's name.
- **"Add to Calendar"** button: generates an `.ics` file that works with Google Calendar, Apple Calendar, and Outlook. The .ics includes: event title ("Open House at [address]"), date/time, location (address), description (listing URL, host agent), and a reminder (1 hour before).
- **"RSVP / Get Reminder"** button: If logged in, one click to RSVP. If not, opens auth modal, then auto-RSVPs. RSVP stores the user's contact in `open_house_rsvps` table and: sends a Resend reminder email 24 hours before AND 1 hour before, pushes `open_house_rsvp` event to FUB with listing context. This is a high-intent lead signal.

### Open House Lead Capture

Open house RSVPs are among the highest-intent actions on the site (alongside CMA downloads and tour requests). Every RSVP creates or updates a FUB contact with: the listing address and MLS number, the open house date/time, and the tag `open-house-rsvp`. The broker assigned to the listing is notified immediately.

---

## 39. Broker Tools (Presentations, QR Codes, Just Listed/Sold)

### Listing Presentation Generator

When a broker is pitching to a potential seller, they need a branded CMA/market report. This feature packages valuation engine data and market stats into a polished, branded PDF.

- Broker selects an address (or a listing).
- System generates a branded presentation including: estimated value with methodology, comparable sales with photos and details, market trends for the area, community overview, broker bio and credentials, brokerage branding.
- Output as a downloadable PDF or shareable link.
- Branded with the tenant's colors, logo, and the broker's headshot/contact info.
- Configurable templates in admin.

### QR Code Generation

Brokers put QR codes on yard signs, flyers, open house sheets, and print ads.

- One-click QR code generation per listing.
- QR code links to the listing page with UTM parameters for attribution (utm_source=qr, utm_medium=print, utm_campaign=yard-sign).
- Downloadable as PNG/SVG at various sizes.
- Also available for: broker landing page, community page, open house page, any shareable URL.
- QR scan tracking via UTM in GA4.

### Just Listed / Just Sold Automated Campaigns

When a listing goes active or closes, the system auto-generates targeted announcements:

**Just Listed:**
- Auto-generate a "Just Listed" email template with listing details, photos, and CTA.
- Target audience: users who have saved searches matching this listing's criteria, users browsing in this community/neighborhood, optionally a geographic radius around the listing.
- Sent via Resend. Event logged in FUB.

**Just Sold:**
- Auto-generate a "Just Sold" announcement.
- Target audience: homeowners in the same subdivision/neighborhood (if they have accounts or are in FUB), users watching this listing.
- Includes sold price, DOM, broker who sold it (builds credibility).
- Also generates a social media post via the content engine.

Both campaigns enter the admin review queue with one-click send.

---

## 40. Broker Performance Dashboard

A dedicated admin section for brokerage owners to evaluate broker performance.

### Metrics Per Broker

- Active listing count
- Closed transactions (current month, quarter, YTD, all-time)
- Total sales volume (same periods)
- Average sale price
- Average days on market for their listings
- List-to-sale price ratio (how close to asking did their listings sell)
- Lead count and sources
- Lead response time (from FUB data)
- Lead conversion rate (leads to clients)
- Review count and average rating (from aggregated reviews)
- Website engagement (views, saves, shares on their listings)
- Enhanced listing count (how many listings have ARYEO media)

### Views

- **Leaderboard:** All brokers ranked by key metrics. Configurable sort.
- **Individual broker drill-down:** Full performance detail page per broker.
- **Comparison:** Select 2-3 brokers to compare side by side.
- **Trend:** Performance over time (monthly/quarterly charts).

### Access

- Super Admin and Broker Admin roles can see all brokers.
- Individual brokers can see their own dashboard only.

---

## 41. Print & PDF Export

Every important page on the site can be exported as a professionally branded PDF. This is used by buyers (bring to showings, share with family), sellers (review market data), and brokers (print marketing materials, email to clients).

### PDF Generation Technology

Use **@react-pdf/renderer** for all PDF generation. This library renders React components directly to PDF without a headless browser (no Puppeteer, no Chrome instance). It runs server-side in a Next.js API route or Inngest function.

**Why @react-pdf/renderer:** Server-side only (no browser needed), React component model (familiar syntax), supports images/fonts/layouts, generates professional output, and works within Vercel's serverless function constraints.

### Listing PDF

Generated when user clicks "Print" or "Save as PDF" on any listing page. Also used for the "Email This Listing" feature.

**Layout (letter-size, portrait):**

**Page 1:**
- Brokerage header: logo (left), brokerage name and contact (right). Navy color bar.
- Hero photo (full width, 40% of page height).
- Property address (large), city, state, zip.
- Price (large, bold, brand accent color).
- Stats row: Beds | Baths | SqFt | Lot | Year Built | Garage.
- Status badge and DOM.
- MLS number.

**Page 2:**
- 4-6 additional photos in a 2x2 or 2x3 grid.
- Property description (PublicRemarks, truncated to fit).
- Key features list (2 columns): Heating, cooling, flooring, appliances, exterior features.

**Page 3:**
- Monthly payment estimate (breakdown: P&I, taxes, insurance, HOA).
- Estimated value with range (if VOW allows).
- Map image (Google Static Maps API — a static PNG of the property location).
- Nearby schools list.

**Footer on every page:**
- Broker headshot (small), name, phone, email, license number.
- Brokerage logo and name.
- Equal Housing Opportunity logo.
- MLS attribution and ODS compliance text.
- QR code linking back to the listing's URL on the website (generated via a QR code library like `qrcode`).
- "Generated on [date] from ryan-realty.com"

### CMA PDF

See Section 28.3 for the complete 4-page CMA layout. Uses the same @react-pdf/renderer technology.

### Market Report PDF

Generated from the reporting engine (Section 32). Includes charts rendered as static images (use Recharts' `renderToStaticMarkup` or a chart-to-image approach). Branded header/footer. 2-4 pages depending on the report scope.

### Comparison PDF

Home comparison (Section 37) exported as a branded PDF. Side-by-side columns with all comparison metrics. Includes hero photos for each home and the comparison map.

### PDF Generation API Route

```
POST /api/pdf/listing    — body: { listingId: string }
POST /api/pdf/cma        — body: { propertyId: string }
POST /api/pdf/report     — body: { reportType: string, geoName: string, period: string }
POST /api/pdf/comparison — body: { listingIds: string[] }
```

Each route returns the PDF as a binary response with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="..."`. The client triggers a download via a Blob URL.

---

## 42. Notification Preference Management

Every user has a full notification settings page accessible from their dashboard. This is required by CAN-SPAM and critical for user experience.

### Notification Categories

Users can manage preferences for each category independently:
- **Saved search alerts:** On/off, frequency (instant, daily digest, weekly)
- **Price drop notifications:** On/off for saved listings
- **Status change alerts:** On/off for saved listings
- **Market digests:** On/off, frequency (weekly, monthly)
- **Just Listed/Just Sold campaigns:** On/off
- **Blog/content updates:** On/off

### Controls

- Per-category toggle (on/off)
- Frequency selector where applicable
- "Pause all notifications for 30 days" option
- "Unsubscribe from all" with confirmation
- Every Resend email includes an unsubscribe link that routes to this settings page

### Backend

- Preferences stored in Supabase per user
- Resend integration respects these preferences before sending
- Unsubscribe events logged and synced to FUB

---

## 43. Mobile, Responsive & Progressive Web App

65%+ of real estate browsing happens on mobile. The mobile experience is not a scaled-down desktop — it's a purpose-built interface.

### Mobile-Specific Design Patterns

- **Bottom navigation bar** (not top hamburger menu). 5 tabs: Home, Search, Saved, Video Feed, Profile. Always visible. Thumb-reachable. Active tab highlighted with brand accent color.
- **Swipe gestures:** Swipe left/right on listing photo galleries. Swipe up in video feed for next video. Pull-down to refresh on any list view.
- **Full-screen photo gallery:** Tap any listing photo to open a full-screen gallery with pinch-to-zoom and swipe navigation.
- **One-handed operation:** All primary CTAs (Contact, Tour, Save, Share) are in the bottom half of the screen, reachable with one thumb.
- **Touch-optimized inputs:** No tiny dropdowns. Use bottom sheets for filters. Use large toggle buttons for bed/bath selection. Date pickers use native mobile date inputs.
- **Map experience on mobile:** Full-screen map with a draggable bottom sheet showing listing cards. Pull up the sheet to see results, pull down to see more map. Listing pins show price badges.

### Responsive Breakpoints (Reference Section 1 Design System)

- **Mobile:** 0-639px. Single column. Bottom tab nav. Feed mode default for search results.
- **Tablet:** 640-1023px. Two columns. Sidebar collapses to bottom sheet.
- **Desktop:** 1024-1279px. Full layout. Sidebar visible. Split view for search.
- **Wide desktop:** 1280px+. Max content width 1280px centered.
- **CSS approach:** Mobile-first. Base styles are mobile. Add complexity via `@media (min-width: ...)`.

### Progressive Web App (PWA) Configuration

**manifest.json:**
```json
{
  "name": "Ryan Realty — Central Oregon Real Estate",
  "short_name": "Ryan Realty",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#102742",
  "theme_color": "#102742",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Service worker (via next-pwa or Serwist):**
- **Cache strategy:** Stale-while-revalidate for API responses (listing data, search results). Cache-first for static assets (JS, CSS, images, fonts). Network-first for HTML pages (always get the latest, fall back to cache if offline).
- **Offline support:** Cache the homepage, search page shell, and the user's last 10 viewed listing pages. When offline, show cached content with a subtle banner: "You are offline. Showing cached data."
- **Install prompt:** After 2 visits or 30+ seconds on site, show a non-intrusive banner: "Add Ryan Realty to your home screen for the fastest experience." Dismissable. Never show again if dismissed.

**Push notifications (Web Push API):**
- Prompt users to enable push notifications after they save their first listing or create a saved search.
- Push notification types: price drop on saved listing, new listing matching saved search, open house reminder.
- Implementation: Web Push API with VAPID keys. Subscription stored in Supabase `push_subscriptions` table. Push sent from an Inngest function alongside the Resend email (user gets both email and push, if enabled).
- **New env vars needed:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

---

## 44. Performance, Speed & SEO

### Performance Targets

| Page Type | LCP Target | TTI Target | Notes |
|---|---|---|---|
| Homepage | < 1.5s | < 2.0s | Hero image preloaded. Market data from edge cache. |
| Listing detail | < 1.8s | < 2.5s | Photo collage is heaviest element. Lazy load below fold. Map deferred. |
| Search results | < 1.2s | < 1.5s | Results from Supabase with indexes. Map loads in parallel. |
| Community page | < 1.5s | < 2.0s | Charts render client-side from cached data. |
| City/Neighborhood page | < 1.5s | < 2.0s | Similar profile to community. |
| Broker page | < 1.0s | < 1.5s | Mostly text and one image. Lightest page type. |
| Blog post | < 1.0s | < 1.5s | Static content. Fully SSG. |
| Admin pages | < 2.0s | < 3.0s | Not public-facing. Less strict. |

FID < 100ms and CLS < 0.1 on all pages. SSR/SSG for all public pages. CDN for assets. Database indexes on every queried field. Pre-computed aggregates. Connection pooling. Edge caching for slowly changing data. AI agent monitors Web Vitals per page template and flags regressions.

### SEO Strategy (Comprehensive)

#### Title & Meta

- Every page has a unique, keyword-rich `<title>` tag (AI-generated with admin override). Format examples:
  - Listing: "19496 Tumalo Reservoir Rd, Bend OR 97703 | 4 Bed 3 Bath | $875,000 | Ryan Realty"
  - Community: "Tetherow Homes for Sale | Bend OR Real Estate | Ryan Realty"
  - City: "Bend Oregon Homes for Sale | Real Estate & Market Data | Ryan Realty"
  - Blog: "Central Oregon Housing Market Update March 2026 | Ryan Realty"
- Every page has a unique `<meta name="description">` (150-160 characters, AI-generated, admin-editable).
- Canonical tags on every page to prevent duplicate content.

#### Structured Data (JSON-LD)

Every page includes appropriate JSON-LD schema markup in the `<head>`:

- **Listing pages:** `RealEstateListing` schema with price, address, beds, baths, sqft, images, agent, broker, date listed, status. Also `Product` schema for rich snippets showing price in search results.
- **Community/City/Neighborhood pages:** `Place` schema with geo coordinates, description, containedInPlace hierarchy.
- **Broker pages:** `Person` schema with name, job title, employer, image, contact info, review aggregate. `RealEstateAgent` where applicable.
- **Brokerage page / Homepage:** `LocalBusiness` + `RealEstateAgent` schema matching Google Business Profile exactly (name, address, phone, hours, geo, logo, social profiles, aggregate rating).
- **Blog posts:** `Article` schema with headline, author, datePublished, dateModified, image, publisher.
- **FAQ sections:** `FAQPage` schema on community pages, city pages, and seller content pages. AI generates 5-8 relevant Q&As per page (e.g., "What is the average home price in Tetherow?" / "How long do homes take to sell in Bend?"). These target featured snippets in Google.
- **Breadcrumbs:** `BreadcrumbList` schema on every page (see below).
- **Search results page:** `SearchResultsPage` schema.
- **Open house listings:** `Event` schema with date, time, location for potential rich results.

#### Breadcrumb Navigation

Every page displays visible breadcrumbs AND includes `BreadcrumbList` JSON-LD:

- **Listing:** Home > Bend, OR > Tetherow > 19496 Tumalo Reservoir Rd
- **Community:** Home > Bend, OR > Tetherow
- **City:** Home > Oregon > Bend
- **Neighborhood:** Home > Bend, OR > Northwest Bend
- **Blog:** Home > Blog > Post Title
- **Broker:** Home > Brokers > Matt Ryan

Breadcrumbs are clickable navigation elements AND structured data that Google uses for search result display.

#### Internal Linking Strategy (Automated)

The content rendering engine automatically creates internal links when it recognizes named entities in text:

- When any page's content mentions a **community name** (e.g., "Tetherow"), it automatically links to that community's page.
- When content mentions a **city name** (e.g., "Bend"), it links to the city page.
- When content mentions a **neighborhood name**, it links to the neighborhood page.
- When content mentions a **broker name**, it links to their broker page.
- Links are created using exact-match entity recognition against the database of communities, cities, neighborhoods, and brokers.
- Each entity is only linked once per page (first occurrence) to avoid over-linking.
- AI-generated content should naturally include entity references to maximize internal linking.

Additionally, every page has contextual navigation links:
- Listing pages link to their community, neighborhood, and city pages.
- Community pages link to their city, neighborhood, and nearby communities.
- City pages link to their neighborhoods and top communities.
- Blog posts link to related listings, communities, and other posts.

This creates a dense internal link graph that distributes page authority and helps search engines understand the site hierarchy.

#### Image SEO

- Every image has a descriptive `alt` attribute. For listing photos, the photo classification pipeline generates descriptive alt text (e.g., "Exterior front view of 19496 Tumalo Reservoir Rd, a 4-bedroom home in Tetherow, Bend OR"). If AI classification is not available, format as "[property type] at [address], [community], [city]."
- Image file names are descriptive, not generic. Rename from IMG_4532.jpg to `19496-tumalo-reservoir-rd-exterior-front.webp`.
- All images include `width` and `height` attributes for CLS prevention.
- Use Next.js `<Image>` component with `priority` on above-fold images and lazy loading on everything else.
- Generate responsive `srcset` for all images (300w, 600w, 1200w, 2400w).
- Use WebP/AVIF with JPEG fallback.

#### Sitemaps

- **Sitemap index** (`sitemap.xml`) that references individual sitemaps:
  - `sitemap-listings.xml` (split into multiple files if > 50,000 URLs per file)
  - `sitemap-communities.xml`
  - `sitemap-cities.xml`
  - `sitemap-neighborhoods.xml`
  - `sitemap-brokers.xml`
  - `sitemap-blog.xml`
  - `sitemap-pages.xml` (static pages: about, contact, sell, etc.)
- Each sitemap entry includes `<lastmod>` (from sync timestamp or content update date) and `<changefreq>` (daily for active listings, weekly for communities, monthly for closed listings).
- Sitemap automatically regenerates after each sync run.
- Submitted to Google Search Console and Bing Webmaster Tools.

#### Robots.txt

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/
Disallow: /auth/
Disallow: /settings/
Sitemap: https://ryan-realty.com/sitemap.xml
```

#### Crawl Budget Management

With 500,000+ pages, crawl budget optimization is critical:
- Active listing pages have highest priority (freshest content, most valuable for search).
- Community, city, and neighborhood pages have high priority (core SEO landing pages).
- Closed/final listing pages have lower priority (historical, less frequently updated).
- Use `<lastmod>` in sitemaps to signal which pages have changed recently.
- Internal linking structure naturally prioritizes active content.
- Monitor crawl stats in Google Search Console. AI agent flags anomalies.

#### HTML Sitemap Page

A user-facing HTML sitemap page accessible from the footer:
- Links to all cities, neighborhoods, and communities organized hierarchically.
- Links to all broker pages.
- Links to key content pages (About, Contact, Sell, Blog).
- Helps both users navigate and bots discover all pages.

#### Session Recording & Heatmaps

Microsoft Clarity (free) loaded via GTM after cookie consent. Provides click maps, scroll maps, and session recordings. AI optimization agent analyzes this data for UX improvements.

#### Offline Conversion Tracking

When a lead generated online eventually closes a transaction (offline), that data flows back to Google Ads and Meta for campaign optimization. Implement via Google Ads offline conversion import and Meta offline event uploads from FUB transaction data.

#### AI Content Strategy for Thin Pages

Every page must have substantial, unique content. Here is how AI generates that content for different page types.

**Listing pages (500+ words total):** MLS remarks provide the base (typically 200-500 words). AI supplements with: a paragraph about the community/subdivision the home is in (character, amenities, lifestyle), a paragraph about the city/neighborhood (what makes the area desirable, proximity to recreation, dining, schools), and a market context paragraph (how this home compares to others in the area, current market conditions). The AI uses the listing's actual data (beds, baths, sqft, year built, community, city) plus the community and city data from Supabase to generate contextually accurate content. Regenerated when listing data changes significantly.

**Resort community pages (1,000+ words):** AI scrapes the resort's official website, review sites, travel guides, and public information to generate comprehensive content about: history and vision of the community, lifestyle and atmosphere, detailed amenity descriptions (golf course designer and details, pool and fitness, dining options, spa services, trails and recreation), membership structures and costs if publicly available, rental policies, architectural standards and home styles, proximity to Bend and outdoor recreation, and why buyers choose this community. Admin reviews and edits before publishing. The AI optimization agent periodically checks for new information and flags content for refresh.

**Standard subdivision/community pages (300-500 words):** For smaller subdivisions that are not resort communities, AI generates content based on: the listings in that subdivision (price range, home sizes, year built range, lot sizes, styles), the city and neighborhood it's in, proximity to amenities (using Google Places data), schools in the area (SchoolDigger data), Census demographics for the zip code, and general lifestyle context for Central Oregon. Example: "River Rim is a residential community in Bend, Oregon, featuring homes built primarily between 2004 and 2012. The neighborhood offers a mix of single-family homes ranging from 1,800 to 3,200 square feet on lots averaging a quarter acre. Located on Bend's west side, residents enjoy easy access to the Deschutes River trail system and are within 10 minutes of downtown dining and shopping..."

**City pages (500-800 words):** AI generates comprehensive city overviews covering: geographic setting, climate, economy and major employers, outdoor recreation, culture and dining, real estate market overview, school districts, and why people move there. For Bend specifically, this is a major SEO landing page and the content should be exceptionally thorough.

**Neighborhood pages (300-500 words):** AI generates content about the neighborhood's character, boundaries, what communities are within it, typical price ranges, lifestyle, and proximity to amenities.

**Blog posts (800-1,500 words):** AI generates market reports, community guides, buying/selling tips, and lifestyle content using the predefined brand tone. Admin reviews and publishes with one click.

**AI content tone for all pages:** Direct, conversational, authentic. No hyphens or colons in copy. No generic real estate phrases. No pandering. Empathetic but not salesy. The content should read as if written by a knowledgeable local who genuinely knows the area, not a marketing department.

#### LLM & AI Discoverability

Modern search increasingly involves AI assistants (ChatGPT, Claude, Perplexity, Google AI Overviews) that consume and reference web content. The site should be optimized for AI discoverability in addition to traditional SEO.

**Implementation:**
- **llms.txt file:** Create a `/llms.txt` file at the site root (similar to robots.txt) that describes the site's content, structure, and key data for AI crawlers. Include: site name, purpose, geographic focus, data sources (MLS via Spark API), update frequency, content types available, and API endpoints if any are public.
- **Structured data depth:** The more structured data (JSON-LD) on each page, the more useful the page is to AI systems that parse structured content. Our comprehensive schema markup (Section 44) serves double duty for both Google and AI discoverability.
- **Content depth and accuracy:** AI systems favor pages with substantial, factual, well-organized content. The 500+ word minimum per page, combined with structured sections (headings, data tables, FAQ schema), makes every page a high-quality source that AI systems are likely to reference.
- **Canonical authority:** By having the most comprehensive, accurate, and current real estate data for Central Oregon (updated faster than competitors, with more data points per listing, more community content, more market analysis), the site becomes the authoritative source that AI systems prefer to cite.
- **FAQ sections with natural language Q&As** (already planned on community and city pages) are particularly valuable for AI systems that answer user questions by extracting from web content.

---

## 45. Neighborhood Data Sources

### Google Places Nearby Amenities (Already Have API Key)

Use the Google Places API (part of Google Maps Platform, same API key) to query nearby points of interest for each listing and community. Categories to query:

- Grocery stores and supermarkets
- Restaurants and cafes
- Parks and recreation
- Schools (supplement SchoolDigger data)
- Hospitals and medical facilities
- Gyms and fitness centers
- Shopping centers
- Banks and ATMs
- Gas stations
- Public transit stops

**Implementation:**
- For each listing, query Google Places API for nearby amenities within a configurable radius (0.5 to 2 miles).
- Cache results in Supabase per listing. Refresh monthly (amenities don't change frequently).
- Display on listing page in the Neighborhood Section as a categorized list with distances.
- Display on community and city pages as aggregate amenity counts.
- Use static map images showing amenity pins to minimize live Google Maps API calls.

**Cost management:** Batch amenity lookups during sync (not on page load). Cache aggressively. Use Nearby Search endpoint which returns up to 20 results per call. One call per category per listing = ~10 calls per listing. For 2,000 active listings = ~20,000 calls per initial population. Google Places allows 100,000 calls/month on the standard plan before additional charges.

### US Census Demographics (Free, No Key Needed)

The US Census Bureau provides free demographic data via API (api.census.gov). Use the American Community Survey (ACS) 5-year estimates.

**Data to pull per geographic area (city, zip code, census tract):**

- Population and population density
- Median household income
- Median age
- Education levels (% with bachelor's degree or higher)
- Employment rate
- Housing stats (owner-occupied vs renter, median home value, median rent)
- Commute times (average commute, % working from home)
- Household composition (average household size, % families with children)

**Implementation:**
- Query Census API by zip code or census tract (geocode listing addresses to census tracts).
- Cache in Supabase per geographic area. Refresh annually (Census data updates yearly).
- Display on community, neighborhood, and city pages in a "Demographics" or "Community Profile" section.
- Use the data in AI-generated content to enrich community descriptions.
- No API key required for basic access. Register for a free key for higher rate limits at api.census.gov/data/key_signup.html.

---

## 46. Missing Site Pages

### About Page

Accessible from main navigation. Tells the Ryan Realty story and builds trust.

**Layout (top to bottom):**
1. Hero image (team photo or Central Oregon landscape) with brokerage name.
2. Brokerage story (AI-generated draft, admin-editable). Origin, mission, what makes us different.
3. Core values or differentiators (3-4 highlighted with icons).
4. Service area map (Google Maps with service area boundary).
5. Team section with broker headshots, names, titles, and links to individual broker pages.
6. Google Business reviews carousel (auto-synced).
7. Awards, certifications, designations.
8. "Work With Us" CTA.
9. Contact info matching Google Business Profile exactly (NAP consistency for local SEO).
10. JSON-LD `LocalBusiness` + `RealEstateAgent` schema.

### Contact Page

**Layout:**
1. Contact form (name, email, phone, message, optional listing/community reference). All submissions go to FUB.
2. Office address with embedded Google Map showing office location.
3. Phone number (FUB-tracked number).
4. Email address.
5. Office hours.
6. Social media links.
7. "Find a Broker" section with broker cards if multiple brokers.
8. JSON-LD `LocalBusiness` with `ContactPoint` schema.

### Legal Pages

Required for compliance. Linked from footer on every page.

- **Privacy Policy:** How user data is collected, stored, used, and shared. CCPA rights. Cookie usage. Third-party services (Google Analytics, Meta Pixel, FUB). Data deletion requests.
- **Terms of Service:** Site usage terms, intellectual property, MLS data disclaimers, limitation of liability.
- **Cookie Policy:** Detailed explanation of cookie categories (essential, analytics, marketing, personalization), what each does, and how to manage preferences. Links to the cookie consent settings.
- **DMCA Policy:** Required for sites displaying MLS content. How to report copyright infringement. ODS Rules and Regulations reference DMCA safe harbor compliance.
- **Accessibility Statement:** Commitment to WCAG 2.1 AA compliance, contact info for accessibility issues.

These can be AI-generated initial drafts but **must be reviewed by a legal professional** before publishing.

### /sell Landing Page

**URL:** `/sell`
**Entry points:** "Sell" nav item dropdown (top-level link), footer "Sell" link, any "Sell your home" contextual CTA.

**Layout (top to bottom):**
1. **Hero section** — Full-width background image (Central Oregon home/landscape), headline: "Thinking of Selling?" or "What's Your Bend Home Worth?", subheadline: "Get an instant estimate, then connect with a local expert." CTA button: "Get My Home Value" → links to `/sell/home-value`. Secondary CTA: "Talk to a Broker" → contact form.
2. **"What's My Home Worth" address entry widget** — inline version of the address entry from `/sell/home-value` (user can start the flow right on the /sell page without clicking through).
3. **Seller content page links** — Cards or links to the seller guide pages: "How to Sell," "Preparing Your Home," "Understanding Your Value," "Choosing the Right Agent."
4. **Why Ryan Realty** — 3-4 differentiators for sellers: local market expertise, marketing reach, negotiation track record.
5. **Recent sales in Bend** — 3-6 recently sold listing cards from the brokerage to demonstrate track record.
6. **Market stats** — Current market conditions for the service area: median price, avg DOM, active listings, list-to-sale ratio.
7. **Broker contact CTA** — "Get a Free CMA from a Local Expert" with broker headshots and one-click contact.
8. **JSON-LD:** `WebPage` schema. `FAQPage` schema if FAQ content is included.

### HTML Sitemap Page

User-facing page linked from footer:
- Organized by hierarchy: States > Cities > Neighborhoods > Communities.
- Links to all broker pages.
- Links to all static pages (About, Contact, Sell, Blog, What's My Home Worth).
- Clean, scannable layout. Helps users navigate and bots discover all pages.

### 404 Page

Custom branded 404 page that:
- Shows the Ryan Realty brand (logo, colors).
- Displays "Page not found" with a friendly message.
- Includes the search bar so users can find what they were looking for.
- Shows 3-4 popular community links and 3-4 trending listings.
- Logs the attempted URL to the AI agent's data quality monitoring for broken link analysis and redirect opportunities.
- Does NOT show a generic browser error or a blank page.

---

## 47. Accessibility (ADA / WCAG 2.1 AA)

Accessibility is a legal requirement for commercial websites and affects SEO. The entire site must conform to WCAG 2.1 Level AA standards.

### Requirements

- **Keyboard navigation:** Every interactive element must be reachable and operable via keyboard alone. Focus indicators must be visible.
- **Screen reader support:** All images have descriptive alt text (AI-generated for listing photos if needed). All form fields have associated labels. ARIA landmarks and roles on all major page sections. ARIA live regions for dynamic content updates (search results, payment calculator).
- **Color contrast:** All text meets 4.5:1 contrast ratio against its background (normal text) and 3:1 (large text). Verified against tenant brand colors.
- **Text resizing:** Content remains usable at 200% zoom.
- **Focus management:** When modals, dropdowns, or expandable sections open, focus moves appropriately. When closed, focus returns to the trigger.
- **Skip navigation:** "Skip to main content" link as the first focusable element on every page.
- **Media accessibility:** Video content has captions where possible. Audio content has transcripts.
- **Form error handling:** Errors identified by color AND text. Error messages are associated with the field via ARIA. Required fields are indicated.
- **Motion:** Respect prefers-reduced-motion for animations, autoplay, and Ken Burns effects.

### Testing

- **Automated CI testing:** Add `axe-playwright` to the Playwright E2E test suite. Run accessibility checks against every critical page template: listing detail, search results, community page, homepage, broker page, user dashboard. These checks run as part of the GitHub Actions CI pipeline on every PR. Any WCAG 2.1 AA violations **fail the PR** — accessibility regressions cannot be merged.
  ```typescript
  // Example axe-playwright check in a Playwright test
  import { checkA11y, injectAxe } from 'axe-playwright';
  await injectAxe(page);
  await checkA11y(page, null, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
  ```
- **Local development:** Lighthouse accessibility audit in Chrome DevTools. axe browser extension for manual checks.
- **Manual testing:** Screen reader testing with VoiceOver on Mac (Safari) and NVDA on Windows (Chrome) on all critical page templates before each major release.
- **Ongoing monitoring:** AI optimization agent includes accessibility score monitoring via Lighthouse CI scores tracked over time.

---

## 48. UX Standards (Loading States, Errors, Skeletons)

### Skeleton Screens

While data loads, display skeleton screens (gray placeholder shapes matching the layout) instead of spinners or blank pages. This prevents CLS and gives users immediate visual feedback. Define skeleton variants for: listing card, listing detail page, community page, map view, report charts, dashboard.

### Loading States

- Buttons show a loading spinner inside the button on click **and are disabled** to prevent double-submit. This matches the standard defined in Section 1 Forms. The visual: spinner replaces or appears alongside the button label, button opacity reduced to 70%, cursor set to `not-allowed`.
- Form submissions show inline progress.
- Infinite scroll shows a loading indicator at the bottom of the feed.

### Error Pages

- **Custom 404 page:** Branded, includes search bar, shows popular listings and communities, "Back to Home" link. Do not show a generic browser 404.
- **Custom 500 page:** Branded, apologetic message, "Try Again" or "Back to Home." Logs error to monitoring.
- **Search no results:** Friendly message with suggestions ("Try broadening your search" or "Explore these popular communities").

### Empty States

Every dashboard section has a designed empty state:
- "No saved homes yet. Start browsing to find your dream home." with a CTA to search.
- "No saved searches. Set up alerts to be the first to know about new listings."
- Never show a blank white area.

### Offline / Connection Lost

For PWA: when connection is lost, show cached content where available and a subtle banner "You are offline. Some data may not be current."

---

## 49. Email Deliverability & Infrastructure

For Resend emails to reach inboxes and not spam folders:

### DNS Records Required

- **SPF record:** Authorize Resend's sending servers for the tenant's domain.
- **DKIM record:** Cryptographic signature proving emails are from the legitimate domain.
- **DMARC record:** Policy telling receiving servers how to handle emails that fail SPF/DKIM. Start with p=none for monitoring, graduate to p=quarantine or p=reject.

### Per Tenant

Each tenant's Resend sender domain needs SPF, DKIM, and DMARC configured. This must be part of the tenant onboarding checklist.

### Email Best Practices

- Use a dedicated sending subdomain (e.g., mail.ryan-realty.com) to protect the primary domain's reputation.
- Warm up new sending domains gradually (start with low volume, increase over weeks).
- Include unsubscribe link in every email (required by CAN-SPAM and handled by notification preference management, Section 42).
- Monitor bounce rates and complaint rates via Resend dashboard.

---

## 50. Security, Compliance & Privacy

### MLS Compliance (Oregon Data Share / IDX)

IDX rules reviewed and understood. Every page displaying MLS data must include:
- Oregon Data Share logo (downloaded from oregondatashare.com/datafeeds).
- Listing broker name and brokerage (from Spark API data in Supabase).
- ODS attribution text from Sections 5-3/5-4 of ODS Rules and Regulations.
- "Last updated" timestamp showing when data was last synced.
- Attribution must be directly adjacent to listing price, bed/bath, sqft, or photo per IDX standards.
- Data refreshed per mandated timeframes.
- Sold data display rules verified per Oregon MLS rules.

### Fair Housing Compliance

Federal Fair Housing Act (42 U.S.C. 3601 et seq.) and Oregon state fair housing law (ORS 659A.421) apply to all aspects of this site.

**Protected classes (federal + Oregon):** Race, color, religion, sex, sexual orientation, gender identity, national origin, familial status, disability, marital status, source of income.

**Website requirements:**
- **Equal Housing Opportunity logo** displayed in the footer of every page and in email footers.
- **Fair Housing Statement** accessible from the footer: "We are committed to fair housing. We do not discriminate based on race, color, religion, sex, sexual orientation, gender identity, national origin, familial status, disability, marital status, or source of income."
- **No discriminatory language** in any AI-generated content, listing descriptions, community descriptions, or blog posts. The AI content generation system must be prompted to avoid any language that could be interpreted as steering, exclusion, or preference based on protected classes.
- **No discriminatory imagery.** Photo selection (both AI classification and manual curation) must not show preference for any demographic in hero images or featured content.
- **Search filters must not enable discrimination.** Filters like "family-friendly" or similar proxies for familial status are prohibited. Filters should be limited to objective property characteristics (beds, baths, sqft, price, year built, etc.).
- **Advertising compliance.** All social media posts, email campaigns, and Meta/Google ads generated by the site must include Equal Housing Opportunity logo and comply with fair housing advertising guidelines.

### Oregon Real Estate Law Compliance

- **Oregon Real Estate Agency (OREA) licensing:** Every broker displayed on the site must have a valid Oregon real estate license. License numbers are stored and displayed per broker.
- **Initial Agency Disclosure:** The site must not create an implied agency relationship. A disclaimer should state that browsing the website does not create an agent-client relationship.
- **Listing agreement limitations:** Oregon law (HB 4058, effective July 2025) limits listing agreements to 24 months maximum. Not directly applicable to the website but relevant for broker education content.
- **Lead-based paint disclosure:** Listings of homes built before 1978 should note that federal lead-based paint disclosure requirements may apply. This can be an automated note based on year_built < 1978.
- **Property disclosure:** While the website doesn't handle transaction documents, seller-focused content should reference Oregon's requirement for property disclosure statements (ORS 105.465).

### Privacy & Data Protection

- **Cookie Policy page** (linked from footer and cookie consent banner): detailed explanation of every cookie category (essential, analytics, marketing, personalization), what data each collects, how long cookies persist, and how to manage preferences. Updated whenever new tracking is added.
- **Privacy Policy page** (linked from footer): comprehensive document covering data collected (personal info, browsing behavior, search history, saved listings, device info), how data is used (personalization, analytics, lead routing, email notifications), who data is shared with (Follow Up Boss, Resend, Google Analytics, Meta), data retention periods, user rights (access, correction, deletion, portability), and how to exercise those rights.
- **CCPA compliance:** California residents have the right to know what data is collected, request deletion, and opt out of sale. While Oregon does not yet have a comprehensive privacy law equivalent to CCPA, Oregon Consumer Privacy Act (effective July 2025) requires similar protections. Build for the strictest standard.
- **Right to be forgotten:** User can request complete data deletion from dashboard or by contacting support. Deletion removes data from Supabase, unsubscribes from Resend, and optionally removes from FUB.
- **Data encrypted at rest** (Supabase default). **TLS in transit** (HTTPS everywhere).
- **DMCA Policy page:** Required for sites displaying MLS content. How to report copyright infringement. References ODS Rules and Regulations DMCA safe harbor compliance.

### Security

- SSL/TLS everywhere. HTTPS enforced.
- Supabase Row Level Security (RLS) on all tables.
- Rate limiting on API endpoints, auth endpoints, and form submissions.
- CAPTCHA (Cloudflare Turnstile or similar) on lead forms, contact forms, and registration.
- Regular dependency updates and vulnerability scanning.
- Environment variables: server-only keys never exposed. `NEXT_PUBLIC_` only for client-safe values.
- Input sanitization on all user-submitted content to prevent XSS and SQL injection.
- Content Security Policy (CSP) headers configured.
- API authentication on all admin and server endpoints.

### Brokerage Configuration (Admin > Settings > Brokerage Profile)

All brokerage identity elements are configurable in the admin backend. When this product is eventually sold to other brokerages, these settings drive all branding.

**Brokerage identity:**
- Brokerage legal name
- DBA / display name
- Oregon principal broker license number
- Oregon brokerage license number
- Office address (must match Google Business Profile for NAP consistency)
- Office phone (FUB-tracked number)
- Office email
- Office hours
- Website URL

**Branding:**
- Primary logo (uploaded, used in header, emails, reports, social cards)
- Reversed/white logo (for dark backgrounds)
- Favicon
- Primary color (default: Navy #102742)
- Secondary color (default: Cream #F0EEEC)
- Accent color
- Heading font, body font
- Brand tagline

**Legal:**
- Equal Housing Opportunity logo (always displayed, non-editable)
- Fair Housing Statement (default provided, admin can customize)
- MLS attribution text (from ODS agreement)
- Privacy Policy content (admin-editable, AI-generated draft, legal review required)
- Terms of Service content
- Cookie Policy content
- Brokerage-specific disclaimers

**Social Media:**
- Facebook page URL
- Instagram handle
- LinkedIn page URL
- X (Twitter) handle
- YouTube channel URL
- TikTok handle
- Default hashtags (used in all auto-generated social content)

**Email Branding:**
- Resend sender domain (e.g., mail.ryan-realty.com)
- Email "from" name (e.g., "Ryan Realty" or "Matt Ryan, Ryan Realty")
- Email header logo
- Email footer content (brokerage name, address, phone, Equal Housing logo, unsubscribe link)

### Broker Email Signatures

Every email sent from the site (via the email template editor or the "Email This Page" feature) includes a broker signature block in the footer.

**Signature block contains:**
- Broker headshot (small, circular)
- Broker name
- Title / designations
- Phone (FUB-tracked number)
- Email
- Brokerage name and logo
- Oregon license number
- Social media icons linking to the broker's configured accounts
- Equal Housing Opportunity logo
- Links: broker landing page, brokerage website

Each broker's signature is auto-generated from their admin profile data. Brokers can preview their signature in admin settings.

### AI Email Composition Assistant

When composing any email in the admin email editor, the broker has access to an AI writing assistant.

**How it works:**
- A "Write with AI" button in the email editor opens an AI composition panel.
- The broker provides a brief prompt or selects from preset options:
  - **Tone presets:** Professional, Friendly, Concise, Enthusiastic, Empathetic, Luxury/Sophisticated, Casual, Urgent.
  - **Content presets:** "Introduce these listings," "Follow up on our conversation," "Share market update," "Check in after showing," "Congratulate on purchase," "Invite to open house."
- The AI (X AI / Grok) generates the email body using the selected tone, the listing/page data in context, and the brokerage brand tone guidelines.
- The broker can accept, edit, or regenerate with a different tone.
- The AI-generated text is inserted into the email editor where the broker can further customize before sending.
- Subject line suggestions are also AI-generated based on the email content.

---

## 50b. Market Intelligence System

Every geographic page (city, neighborhood, community) and listing page displays real-time market intelligence. This data is the foundation for an informed buyer/seller experience that no competing site can match.

### Market Condition Determination (Buyer's vs Seller's Market)

The system automatically classifies each geographic area's market condition using industry-standard methodology.

**Metrics used:**
- **Absorption rate** (months of inventory) = active listings ÷ average monthly closings. This is the primary indicator.
- **Average days on market** relative to historical average.
- **List-to-sale price ratio** (are homes selling above, at, or below asking).
- **Price trend direction** (rising, flat, declining over 90 days).
- **Inventory change** (more or fewer homes for sale vs prior month/quarter).

**Classification thresholds (configurable in admin):**
- **Seller's Market:** Absorption rate < 4 months, prices rising, DOM below historical average, list-to-sale ratio > 98%.
- **Balanced Market:** Absorption rate 4-6 months, prices stable, DOM near historical average.
- **Buyer's Market:** Absorption rate > 6 months, prices flat or declining, DOM above historical average, list-to-sale ratio < 96%.

**Display:**
- A visual indicator on every community, neighborhood, and city page: "Seller's Market" (green), "Balanced" (yellow), or "Buyer's Market" (red) with the absorption rate number.
- Brief AI-generated narrative: "Tetherow is currently a seller's market with just 2.3 months of inventory. Homes are selling in an average of 34 days, and sellers are receiving 99.2% of their asking price."
- This classification also appears in the trending system as part of the market temperature badge.

### Market Intelligence Tiles

A reusable "Market Intelligence Tile" component that can appear on any page. The tile is a compact, visually rich card showing key market data for a geographic area.

**Tile contents:**
- Area name (community, neighborhood, or city)
- Market condition badge (Seller's/Balanced/Buyer's Market)
- Median price with trend arrow
- Active listing count
- Average DOM
- Price trend mini-chart (sparkline showing 6-month trend)
- "View Full Report" link

**Where tiles appear:**
- **Homepage:** In the market snapshot section and as part of the community leaderboard.
- **Listing pages:** In the neighborhood section, showing the market intelligence for the listing's community.
- **Community pages:** Prominently near the top, showing the community's market condition.
- **City pages:** Market intelligence for the city, plus tiles for top communities within the city.
- **Neighborhood pages:** Market intelligence for the neighborhood plus tiles for communities within.
- **Search results:** A collapsible "Market Conditions" panel at the top of results showing intelligence for the searched area.
- **Feed mode:** Market intelligence tiles appear periodically in the feed (every 10-15 listings) as "cards" interspersed with listing cards. Example: "🔥 Tetherow is a seller's market right now. 2.3 months of inventory."
- **Email campaigns:** Market intelligence tiles are included in saved search digest emails and market report emails.
- **Social sharing:** When sharing a community or city page, the market intelligence data is included in the generated social card.

### Real-Time Data Processing

After every sync run, the following chain executes to ensure all displayed data is current:

1. **Delta sync completes** → new/changed listings are in Supabase.
2. **Market stats computation** runs for all affected geographic areas → reporting_cache updated.
3. **Market condition classification** runs → buyer's/seller's market badges updated.
4. **Estimated values recalculated** for listings where new comps are available.
5. **Trending scores recomputed** based on fresh engagement + market data.
6. **Saved search matching** identifies new matches and triggers notifications.
7. **Sitemap regeneration** ensures search engines see the latest.

All of this happens automatically. The admin sees it in the job monitoring dashboard. The user sees perpetually fresh, accurate data.

---

## 51. Build Order (Fresh Start)

This is a greenfield project. Build features in this order. Each phase depends on the previous one.

### Phase 1: Foundation (Must complete before anything else)
1. Project scaffolding (Next.js + TypeScript + Tailwind + Supabase client)
2. Database schema — all migrations for core tables (properties, listings, status_history, price_history, listing_photos, listing_agents, communities, neighborhoods, cities)
3. Supabase Auth setup (Google OAuth, email/password)
4. Basic layout components (Header, Footer, Navigation)
5. Design system implementation (colors, typography, spacing, card component)
6. Environment variables configured in Vercel
7. Inngest setup and first test function
8. Sentry error monitoring integration

### Phase 2: Data Pipeline (The engine that powers everything)
9. Spark API client (authentication, request helpers, rate limit tracking)
10. Initial sync engine (full replication with checkpoint/resume)
11. Delta sync engine (smart lightweight sync for Active/Pending)
12. Auto-finalization pipeline for Closed listings
13. Photo sync and classification pipeline
14. Post-sync processing pipeline (all 8 processors from Section 7.10)
15. Database stored procedures (compute_market_stats, classify_market_condition, compute_cma)
16. Sync status dashboard in admin

### Phase 3: Core Public Pages
17. Listing detail page (full layout per Section 8, all 17 sections)
18. Search/filter/map experience (Section 17)
19. Homepage (Section 16, all 12 sections)
20. Community pages (standard + resort, Section 18)
21. City pages
22. Neighborhood pages

### Phase 4: User Experience
23. User registration and login flows (Section 23)
24. User dashboard (saved homes, saved searches, recently viewed, preferences)
25. Saved search matching and notification delivery
26. Personalization layer (Section 34)
27. CMA display and download workflow (Section 28.3)

### Phase 5: Broker & Admin
28. Admin backend (Section 31 — navigation, CRUD, roles)
29. Broker landing pages (Section 19 — full lead-gen layout)
30. Broker-listing association
31. FUB integration (all events from Section 28.1)
32. Email template library and editor (Section 30 of email sections)
33. Brokerage configuration (branding, legal, social)

### Phase 6: Reporting & Analytics
34. Reporting engine (Section 32 — city market reports, CMA generation)
35. GA4/GTM implementation (Section 30 — all custom events)
36. Meta Pixel + CAPI
37. Admin analytics dashboard (GA4 Data API integration)
38. AI Analytics Agent

### Phase 7: Content & SEO
39. Blog engine (Section 14)
40. AI content generation for communities, cities, neighborhoods
41. SEO implementation (structured data, sitemaps, meta tags)
42. Content engine and social publishing

### Phase 8: Polish & Launch
43. About, Contact, Legal pages (Section 46)
44. Accessibility audit (WCAG 2.1 AA)
45. Performance optimization (Core Web Vitals targets)
46. PWA configuration
47. Cookie consent and privacy compliance
48. Error states, empty states, loading states
49. Mobile UX polish
50. Production launch

### Phase 9: Post-Launch Enhancements
51. Open house features
52. Home comparison tool
53. Broker tools (presentations, QR codes)
54. AI video pipeline (Luma/Runway)
55. Review aggregation (Google Business, Yelp)
56. Print/PDF export

---

## 52. Open Questions & Decisions Needed

### Resolved

- ✅ Tech stack: Next.js + Supabase Pro + Google Maps + FUB + Resend + XAI + Luma/Runway.
- ✅ AI provider: X AI (Grok) as primary for all AI features.
- ✅ AI agent: Fully autonomous with full codebase access.
- ✅ Broker-facing comms through FUB. User-facing through Resend.
- ✅ Multi-tenant DEFERRED. Building standalone site for Ryan Realty first. Architecture kept clean for future multi-tenancy addition (no hardcoded data in components — all brokerage identity from config). Separate Supabase databases per brokerage is the planned future architecture but is NOT built now.
- ✅ White-label / sellable product.
- ✅ Deployment on Vercel.
- ✅ Google Maps only (Mapbox deprecated).
- ✅ Supabase Pro plan.
- ✅ IDX compliance reviewed.
- ✅ Video URLs in standard URL format.
- ✅ Estimated value shows public number only, CMA methodology behind the scenes.
- ✅ No property claim feature.
- ✅ No broker limit per tenant.
- ✅ Blog section with AI blog engine (draft with one-click publish).
- ✅ URL structure follows SEO best practices (geographic, clean, keyword-rich).
- ✅ Community boundaries from Google Places with KML import fallback.
- ✅ Listings with no photos excluded from display.
- ✅ PWA (not native app).
- ✅ Enhanced listing pages via ARYEO integration (paste download URL in admin).
- ✅ Broker-uploaded video and branded content supported.
- ✅ Broker review aggregation via API auto-sync (Yelp, Google Business). Zillow and Realtor.com review API sync is DEFERRED (API terms uncertain).
- ✅ Broker-listing association by Oregon license number / MLS ID.
- ✅ Google Business Profile integration for local SEO and review sync.
- ✅ Success metrics: continuous improvement monitored by AI agent.
- ✅ Site elements (non-listing) use Unsplash or AI for imagery when no original exists.
- ✅ Rental estimates deferred for future implementation (RentCast identified as best option when ready).
- ✅ 10-year price performance graph shows property history overlaid on community trend.
- ✅ Listing page includes: recently sold nearby, avg DOM for community, price/sqft vs community average.
- ✅ Monthly payment calculator uses current national rates, 20% default down, expands on click with full breakdown and editable inputs.
- ✅ Universal Card Design System enforced across all pages (listing, community, city, neighborhood, broker cards all consistent).
- ✅ Oregon Data Share compliance language required on every listing page.
- ✅ Every page must have 500+ words of unique content (AI fills gaps to prevent thin content for SEO).
- ✅ Full bot crawlability required. SSR/SSG ensures all content in HTML on first load. Dynamic sitemap covers all pages.
- ✅ Buyer preferences include credit score.
- ✅ Comprehensive event tracking on every interactive element site-wide via dataLayer to GTM.
- ✅ Call tracking via FUB phone numbers (no separate call tracking service needed).
- ✅ Authentication checks FUB on login to bridge existing leads to new website accounts.
- ✅ Apple and Facebook login to be added alongside existing Google OAuth.
- ✅ Seller Experience / "What's My Home Worth" funnel fully defined (ungated estimate, gated detail, CTA to broker).
- ✅ Home comparison tool (side-by-side, 2-4 homes, shareable).
- ✅ Open houses (dedicated page, listing integration, RSVP, reminders).
- ✅ Broker tools: listing presentation generator, QR codes, Just Listed/Just Sold campaigns.
- ✅ Broker performance dashboard with leaderboard and individual drill-down.
- ✅ Print/PDF export for listings, reports, and comparisons.
- ✅ Notification preference management (per-category toggles, CAN-SPAM compliant).
- ✅ Accessibility: ADA / WCAG 2.1 AA compliance required site-wide.
- ✅ UX standards: skeleton screens, custom error pages, empty states, offline handling.
- ✅ Email deliverability: SPF, DKIM, DMARC required per tenant sending domain.
- ✅ Reporting: scheduled reports, expired listing reports, price reduction reports, broker leaderboard, lead source attribution, response time tracking, multi-format export.
- ✅ Admin: audit trail for all actions, broker onboarding wizard, 301 redirect management.
- ✅ SEO: robots.txt strategy, crawl budget management, sitemap index, session recording via Clarity/Hotjar, offline conversion tracking.
- ✅ Engagement Intelligence and Trending System: site-wide badges (hot, trending, new, price drop, viewing count), community temperature indicators, community leaderboard, automatic threshold-based assignment.
- ✅ Community pages fully specified top-to-bottom (14 sections, comparable detail to listing pages).
- ✅ City pages fully specified top-to-bottom (12 sections).
- ✅ Neighborhood pages fully specified.
- ✅ Homepage fully specified top-to-bottom (12 sections) with trending leaderboard as engagement hook.
- ✅ Search results page fully specified (split/grid/list/feed views, filter panel, infinite scroll, no-results state).
- ✅ "People also viewed" section on listing pages based on co-viewing patterns.
- ✅ Every page is a destination with substantial unique content. No stubs.
- ✅ Design principle: never build bare minimum. Always research best-in-class and exceed it.
- ✅ GA4 Data API service account: store `GA4_SERVICE_ACCOUNT_JSON` (stringified JSON) in env vars. Create in Google Cloud Console > IAM > Service Accounts, grant Viewer on the GA4 property. **Resolved — see Section 4 env vars.**
- ✅ AI chat branding configurable per site in admin (name and personality).
- ✅ Google Maps cost management: cache map renders, only load live once per page, use static images where interactive not needed.
- ✅ Walk Score API: applied for access.
- ✅ SchoolDigger replaces GreatSchools (much cheaper, 2,000 free calls/month).
- ✅ API cost budget: target under $300/month total for all third-party APIs.
- ✅ Listing broker and brokerage data already in Supabase from Spark API.
- ✅ ODS logo and attribution required on every MLS data page (logo from oregondatashare.com/datafeeds, text from ODS Rules Sections 5-3/5-4).
- ✅ US only for now. Internationalization deferred.
- ✅ Multi-tenant deferred. Building standalone site for Ryan Realty first.
- ✅ Not currently running Meta/Facebook ads, but site will be fully wired for ad creation from content (Meta Pixel, CAPI, and Marketing API ready).
- ✅ Launch strategy: get into production ASAP, push daily updates, iterate continuously.
- ✅ Call tracking via FUB phone numbers. No separate service needed.
- ✅ SchoolDigger authenticated via GitHub. Account ready.
- ✅ Google Business ownership transferred. Waiting a few days before creating API access.
- ✅ Meta Ad Account ID added to env vars.
- ✅ Comprehensive SEO strategy: automated internal linking via entity recognition, breadcrumbs with BreadcrumbList schema on every page, FAQ schema on community/city pages, image SEO (descriptive alt text, filenames, srcset), page speed budgets per page type.
- ✅ Sitemaps: sitemap index with separate sitemaps per content type, submitted to Search Console.
- ✅ Robots.txt strategy defined. Crawl budget management for 500K+ pages.
- ✅ Neighborhood data: Google Places nearby amenities (free with existing API key) + US Census demographics (free, no key needed).
- ✅ Missing pages defined: About, Contact, Privacy Policy, Terms of Service, Cookie Policy, DMCA Policy, Accessibility Statement, HTML Sitemap, custom 404.
- ✅ JSON-LD structured data comprehensive: RealEstateListing, Person, LocalBusiness, Article, FAQPage, BreadcrumbList, SearchResultsPage, Event (open houses), Product (for price rich snippets).
- ✅ HowLoud/Soundscore and Risk Factor deferred (can add later if budget allows).
- ✅ Broker CRM view in admin mirrors FUB assigned contacts with combined website + FUB activity timeline.
- ✅ Broker saved search email campaigns with rich formatted emails, FUB tracking on every link, event reporting back to FUB (opens, clicks, bounces).
- ✅ Email any page from the website (listing, community, report, blog) with rich HTML preview and FUB tracking integration.
- ✅ FUB Email Marketing Integration API architecture defined (create campaign > send via Resend > report events back to FUB).
- ✅ Email Template Library: 10 pre-built branded templates (single listing, multi-listing digest, just listed, just sold, open house, market report, valuation, shared collection, welcome, price drop).
- ✅ Email Template Editor in admin: template selector, listing picker, personal message, live preview (desktop/mobile), recipient selector from FUB contacts, schedule send, test send, save as draft.
- ✅ Admin Share-to-Lead flow: brokers browsing the site see "Share with My Lead" option on every shareable page, with lead selector, template choice, and FUB-tracked send.
- ✅ Analytics Dashboard in admin fully specified: KPI cards, traffic chart, top content tables, lead funnel, broker summary, activity feed, AI insights panel, sync widget, email campaign stats.
- ✅ Media Library in admin fully specified: grid view, multi-file upload, Unsplash browser, AI image generation, image details/usage tracking, bulk ops, KML upload, orphan detection.
- ✅ Broker Social Media Account Settings in admin: all platforms configurable (Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Pinterest), OAuth connection for Facebook/Instagram direct posting, default hashtags per platform.
- ✅ Broker Social Sharing System: auto-generated branded images (multi-aspect-ratio), AI-generated platform-specific captions, OAuth direct-post for Meta, Web Share API for mobile, copy-to-clipboard for desktop, all shares tracked.
- ✅ Every shareable content type has platform-specific auto-generated share content (listing, community, blog, report, just listed, just sold, open house, valuation teaser).
- ✅ Broker landing page fully specified as lead generation page (12 sections top-to-bottom, hero with split layout, lead capture CTA above fold, stats, listings, reviews, video, blog posts, communities served, second CTA at bottom, all editable in admin with drag-and-drop reorder).
- ✅ User dashboard fully specified (sidebar navigation with 10 sections, dashboard home screen with welcome header, notification center, saved homes with collections, saved searches with notification controls, recently viewed, AI recommendations, market updates, buyer preferences).
- ✅ Admin backend navigation fully specified (sidebar with 9 top-level items and sub-items covering listings, communities, people, content, email, reports, media, settings).
- ✅ Blog experience fully specified (index page with featured post hero, category filter, post grid, sidebar with popular/recent/categories/subscribe; individual post pages with 13 sections; category pages, tag pages, and author pages for SEO).
- ✅ AI content strategy defined per page type: listing (500+ words), resort community (1,000+ words), standard subdivision (300-500 words), city (500-800 words), neighborhood (300-500 words), blog (800-1,500 words). Tone defined: direct, conversational, authentic.
- ✅ LLM/AI discoverability: llms.txt file, deep structured data, FAQ schema, content depth and authority strategy.
- ✅ Personalization fully specified: per-page-type personalization behavior defined for homepage, search, listing, community, and broker pages. Anonymous visitor personalization via cookie. Progressive engagement across 1st, 2nd, 3rd+ visits.
- ✅ Database schema reference: all key tables defined (properties, listings, status/price history, photos, agents, geo hierarchy, engagement, trending, valuations, comps, reporting_cache, broker_stats, users, saved listings/searches, shared collections, FUB cache, email campaigns, AI content, agent insights, third-party caches, reviews). PostGIS for geographic queries.
- ✅ Background jobs inventory: 17 jobs defined with triggers, frequencies, dependencies, outputs, error handling, retry strategy, and admin monitoring dashboard.
- ✅ CMA on-demand engine: Supabase stored procedure, PostGIS radius queries, sub-200ms from cache. Full CMA report generation for any address as branded PDF, shareable as gated link (lead capture).
- ✅ Video hero on homepage (slow-motion drone footage, not static image). Resort community heroes must be video when possible.
- ✅ Live activity ticker on homepage showing anonymized real-time events.
- ✅ Listing cards have video hover-preview (Netflix thumbnail effect). AI-generated Ken Burns micro-videos for listings without professional video.
- ✅ Sticky engagement bar on listing pages (compact CTA bar fixed at top on scroll).
- ✅ Micro-interaction animations on like/save buttons (heart-fill, bookmark-fill).
- ✅ "Did you know?" callout boxes in listing descriptions with AI-generated area facts.
- ✅ "X people viewing right now" live indicator on listing pages.
- ✅ "New since last visit" badges on cards for returning visitors.
- ✅ "Viewed" indicator on cards for logged-in users showing already-seen listings.
- ✅ Community leaderboard cards have looping background video clips.
- ✅ Resort community pages expanded to 8 specific AI-generated content sections (history, lifestyle, amenities showcase, membership, rental restrictions, four seasons, proximity, community comparison) plus video hero. 1,500-2,500 words per resort page.
- ✅ Neighborhood pages expanded to 12 specific sections (hero, overview, market snapshot, communities within, active listings, recently sold, map, schools/amenities, demographics, FAQ, nearby neighborhoods, blog/CTA).
- ✅ Additional report types: CMA reports (branded PDF, gated share link), community/neighborhood reports (one-page shareable), broker monthly recap (auto-generated, emailed), expired listing prospecting report, absorption rate report, price reduction report, listing engagement report.
- ✅ Job monitoring dashboard in admin (Settings > Background Jobs).
- ✅ Authentication UX fully specified: sign up (social + email), sign in, forgot password/reset, account settings (change password, connected accounts, delete account), session management.
- ✅ Fair Housing compliance: Equal Housing logo on every page and email, Fair Housing statement, no discriminatory language in AI content, no discriminatory search filters, advertising compliance.
- ✅ Oregon Real Estate Law: OREA licensing requirements, agency disclosure disclaimer, lead-based paint auto-note for pre-1978 homes, property disclosure references in seller content.
- ✅ Legal pages: Privacy Policy (CCPA + Oregon Consumer Privacy Act), Terms of Service, Cookie Policy, DMCA Policy, Fair Housing Statement, Accessibility Statement. AI drafts with legal review required.
- ✅ Brokerage Configuration in admin: full identity (legal name, licenses, address, phone), branding (logos, colors, fonts, tagline), legal content, social media links, email branding (sender domain, from name, header/footer).
- ✅ Broker Email Signatures: auto-generated from profile data, includes headshot, contact, designations, license, social icons, Equal Housing logo. Appears on every email.
- ✅ AI Email Composition Assistant: "Write with AI" in email editor with tone presets (Professional, Friendly, Concise, Enthusiastic, etc) and content presets (introduce listings, follow up, market update, etc). AI generates body and subject line suggestions.
- ✅ Market Intelligence System: buyer's vs seller's market determination using absorption rate, DOM, list-to-sale ratio, price trends. Configurable thresholds. AI-generated narrative per area.
- ✅ Market Intelligence Tiles: reusable compact cards showing market data, appearing on homepage, listing pages, community/city/neighborhood pages, search results, feed mode (interspersed every 10-15 cards), emails, and social shares.
- ✅ Real-time data processing chain after every sync (market stats > market classification > estimated values > trending scores > saved search matching > sitemap regen).
- ✅ Reporting engine fully specified with 8 subsections (32.1-32.8). City market reports match/exceed Beacon Report baseline with 8 chart types: median price trend, number of sales, DOM, months of inventory, price per sqft, conventional vs cash split, sales vs listings by price bracket, KPI summary cards.
- ✅ Reports configurable by time period (smart presets: this week, 7 days, 30 days, quarter, 6 months, 12 months, 2/3/5/10 years, all data, custom range).
- ✅ Reports configurable by geographic scope (multi-select cities, communities, neighborhoods).
- ✅ Multi-area comparison reports (side-by-side cities or communities).
- ✅ One-click CMA generation from admin: broker clicks "Generate CMA" on any listing, system runs CMA engine, generates full branded report with cover page, subject summary, 6-10 comps with photos and adjustments, comp map, market context charts, methodology narrative, broker signature. Preview, download PDF, email (FUB-tracked), shareable gated link, customizable before send.
- ✅ CMA can include market report sections (attach city/community market data to the CMA).
- ✅ Report generator in admin with 9 report types, geographic/time/property-type filters, instant generation, and 7 action options (PDF, share link, social card, email, schedule, blog post, attach to CMA).
- ✅ All charts use consistent brand design, responsive, accessible (alt text + data tables), SSR with static fallback for bots.
- ✅ Community/neighborhood reports use quarterly data for smaller markets with lower transaction volume.
- ✅ Reporting covers ALL Spark API cities/communities (not limited to Beacon Report subset). Every city, community, and neighborhood with MLS data gets auto-generated reports.
- ✅ FUB Events API complete inventory: 20+ distinct event types defined with exact payloads. Covers Registration, Property/Seller/General Inquiry, Property Viewed/Saved/Liked/Shared/Compared, Property Search, Saved Search Created, Community/City/Neighborhood/Blog Viewed, CMA Downloaded/Shared, Market Report Viewed/Downloaded, Return Visit, Collection Shared, AI Chat, Tour Requested, Call Initiated, Email events.
- ✅ Geolocation tracking: browser geolocation API with permission prompt, IP fallback, stored in FUB custom fields. Local vs out-of-area detection for relocation lead tagging.
- ✅ CMA download on listing pages: "Download Full Value Report" CTA below estimated value section. Pre-generated PDF cached in Supabase Storage. One-click for signed-in users, auth gate for anonymous. Broker alert within 60 seconds. Full lead workflow defined.
- ✅ CMA display design fully specified: 4-page layout (Summary with 3-second view, Comparable Sales with adjustment details, Market Context with 4 mini-charts, Comp Map + Methodology). Clean, scannable design. Both in-browser preview and PDF export.
- ✅ Lead scoring system: 18 actions with point values (configurable), 4 score tiers (cold/warm/hot/very hot), score decay (20%/week inactivity).
- ✅ 7 lead conversion workflows defined: Silent Browser, CMA Downloader, Active Saver, Price Watcher, Seller Curious, Relocation Lead, Ghosted Lead. Each with trigger conditions, actions, and follow-up sequences.
- ✅ 16 FUB custom fields defined for website intelligence (lead_score, browsing_location, is_local, preferred_communities, preferred_price_range, buyer_or_seller, cma_downloads, etc).
- ✅ CTAs and conversion points specified per page type. Exit intent popup. AI chat broker suggestion. Search result registration prompt after 5+ views.
- ✅ GA4/GTM architecture fully specified (Section 30 rebuilt into 12 subsections).
- ✅ GA4 custom event taxonomy: ~30 events across 4 categories (Lead Generation as GA4 conversions, Property Engagement, Search & Discovery, Engagement & UX). Each event has defined trigger, key parameters, and conversion status. Follows GA4 naming conventions.
- ✅ GA4 custom dimensions (7 event-scoped: listing_id, community, city, page_type, lead_type, share_method, cta_location; 4 user-scoped: user_type, is_local, preferred_community, lead_score_tier) and custom metrics (listings_viewed, listings_saved per session).
- ✅ GTM container structure defined: tag groups (Google Tag, GA4 Events, Meta Pixel, Clarity, Google Ads), trigger types (page view, custom events, scroll depth, form submission, click, timer, element visibility), variable types (dataLayer, cookie, URL, custom JS).
- ✅ Data layer implementation with `trackEvent` utility function and code example.
- ✅ GA4 Data API integration into admin dashboard: real-time panel (active users, events firing now), daily/weekly/monthly summary (sessions, top listings, top communities, traffic sources, conversion funnel, device/geo breakdown), listing-specific analytics, SEO dashboard from Search Console API.
- ✅ AI Analytics Agent: daily background job that pulls GA4 + Search Console + Supabase data, analyzes for patterns (high-traffic low-conversion pages, trending communities, CTA effectiveness, mobile UX issues), generates plain-language insights, stores in agent_insights table, presents in admin "AI Insights" panel.
- ✅ Meta Pixel + CAPI: ViewContent, Search, AddToWishlist, Lead, CompleteRegistration events mirrored. Server-side CAPI with event_id deduplication.
- ✅ 5 pre-built GA4 Exploration reports for non-technical users: Listing Performance, Lead Funnel, Community Popularity, Traffic Sources → Leads, Content Performance.
- ✅ Microsoft Clarity via GTM for heatmaps and session recordings.
- ✅ **Appendix A: Spark API Field Mapping** — Complete verified field mapping from actual Spark API export (8,065 fields analyzed). 121 IDX-available Residential fields identified with exact Spark field names. 13 critical non-IDX fields identified (Lat/Long, DOM, OriginalListPrice, agent license/email). All field names corrected in schema (BathsFull not BathroomsFull, ListAgentName not ListAgentFullName, etc). Central Oregon-specific fields documented (View types: Cascade Mountains/Golf Course/Lake/River, WaterfrontYN, IrrigationWaterRightsYN, HorseYN, SeniorCommunityYN). 8 property types documented. VOWAutomatedValuationDisplayYN flag identified (must check before showing CMA).
- ✅ **Appendix B: ARYEO Integration** — Verified URL structure from actual download center link. Pattern: `https://{photographer-subdomain}.aryeo.com/listings/{uuid}/download-center`. Full scraping workflow defined. Photographer subdomain handling (per-listing, not global). Admin interface for paste-and-import.
- ✅ **Appendix C: Remaining Gaps** — 9 explicit gaps documented for the coding agent to verify during implementation (auth flow, photo endpoint, pagination, existing schema, existing code conventions, ODS attribution text, FUB account config, VOW AVM flag, non-IDX access level).
- ✅ **Greenfield Project Directive** — Explicit instructions that this is a brand-new project built from scratch. Agent builds everything per this specification.
- ✅ **UI/UX Design System (Research-Backed)** — Comprehensive design system grounded in behavioral psychology and conversion science, not guesswork. Covers: color system (6 defined colors with usage rules, isolation effect for CTAs, max 3-4 colors per screen), typography (heading/body/mono fonts, font size scale from H1 48px to caption 12px, price display rules), spacing system (4px base grid, 11 defined spacing values from 4px to 96px, whitespace-as-comprehension research), touch targets (44px desktop / 48px mobile minimums, 8px gap between targets), visual hierarchy (F-pattern for listing pages, Z-pattern for landing pages, 3-second rule), card design (12px radius, shadow values, hover elevation, transition timing), form optimization (max 4 fields for lead capture, float labels, inline validation, value-focused submit copy), page performance targets (LCP <2.5s, FID <100ms, CLS <0.1, skeleton screens), social proof placement, progressive disclosure rules, responsive breakpoints (4 tiers), animation timing and easing (150-500ms ranges, ease-out entrances, no gratuitous motion), and accessibility (WCAG 2.1 AA with AAA targets for key elements).
- ✅ **Data Sync Engine completely rebuilt (Section 7)** with 13 subsections verified against actual Spark API documentation. Covers: API access configuration (two endpoints — standard vs replication, auth via Bearer token, rate limits 1,500/4,000 requests per 5-min window), initial historical sync (exact GET request with $top=1000 and $count=true, pagination via @odata.nextLink preferred over $skip, $expand for media/rooms/units, $select for performance, custom fields via _expand=CustomFields), checkpoint system (full SQL schema for sync_checkpoints table, resume from next_url, error logging per record, never stop entire sync for one bad record), per-listing processing (8 steps: property upsert/dedup, listing upsert by ListingKey, status change detection, price change detection, photo processing with classification pipeline, virtual tours/videos, agent/office extraction with broker matching, school data from IDX fields), delta sync (TWO timestamps for polling window to avoid caching issues, every 2-5 min via cron), stale data purge (daily comparison of API active keys vs Supabase active keys), Member and Office replication (daily), media sync options (expand in Property request or fetch separately if timeout), listing lifecycle state machine (Active/Pending/Closed/Final/Withdrawn/Expired with bounce-back), post-sync processing chain (market stats → saved search matching → CMA recomputation → trending scores → sitemap regen in parallel where possible), sync status dashboard (all fields specified), rate limit management (90% threshold sleep, 429 handling, budget calculation), and error handling table (7 error types with specific handling strategies).
- ✅ **v21 Audit: 28 issues identified and fixed.** 8 critical (greenfield directive, Inngest confirmed, Supabase Storage confirmed, Sentry added, connection pooling specified, Vercel timeout workarounds documented, Section 33 redirected to 7.10, Section 51 replaced with Build Order). 4 structural (cross-references added for duplicated topics). 7 missing items added (deployment pipeline, testing strategy with Vitest + Playwright, database migration strategy via Supabase CLI, rate limiting via Upstash, caching strategy with Next.js ISR, remote agent communication with 3 methods, Supabase Realtime configuration). AI Video Pipeline clearly marked DEFERRED. Build Order defines 9 phases and 56 sequential build steps for greenfield project.

### Still Open

- ✅ AI chat branding: name is **"Ask Ryan"** at launch (configurable in `settings` table for future multi-tenant use). Resolved — see Section 11.2.
- ⚠️ Zillow/Realtor.com API terms for review syndication (Matt investigating).
- ⚠️ Google Business Profile API access (submit application at console.cloud.google.com, awaiting approval).
- ⚠️ Yelp Fusion API account (sign up at yelp.com/developers, straightforward).
- ⚠️ SchoolDigger API account (sign up at developer.schooldigger.com).
- ⚠️ Walk Score API access (applied, awaiting approval).
- ⚠️ Oregon Data Share exact attribution text (pull verbatim from ODS/COAR agreement, Sections 5-3 and 5-4 of ODS Rules and Regulations. Download ODS logo from oregondatashare.com/datafeeds).
- ✅ Meta Ad Account ID: `META_AD_ACCOUNT_ID` added to env vars in Section 4 (Content Engine & Social Publishing block). Resolved.

### Deferred (Revisit Later)

- Zillow and Realtor.com review API syndication (API terms uncertain; Matt investigating).
- Multi-tenant / white-label architecture (build standalone first, add tenancy later).
- Internationalization framework (US only for now).
- Rental estimates (RentCast identified as best option when ready).
- Multi-tenant onboarding automation.
- AI Video Pipeline via Luma/Runway (defer implementation; professional video from ARYEO and MLS video URLs provide sufficient video content for launch. Add AI-generated video post-launch).
- Direct OAuth social posting to Facebook/Instagram (Meta app review takes weeks; start with "generate image + copy caption" approach, add direct posting later).
- Review syndication from Zillow/Realtor.com (API terms uncertain; start with Google Business and Yelp reviews, add others once terms confirmed).
- HowLoud/Soundscore noise data (add when budget allows).
- Risk Factor flood/fire/heat data (add when budget allows).

---

## APPENDIX A: Spark API Field Mapping (Verified from Export)

This appendix contains the actual Spark API field names from the Cascades East MLS data subscription. The coding agent MUST use these exact field names when building the sync engine and database schema. Do not guess field names.

### A.1 Data Access Tiers

The Spark API has two access levels. Some fields are available in the IDX payload (standard feed), while others require non-IDX API calls (higher permission level).

**IDX-available fields (121 for Residential):** These come in the standard IDX data feed. No special permissions needed beyond the base Spark API subscription.

**Non-IDX fields (need separate API call):** These critical fields are NOT in the IDX payload and must be fetched via a separate non-IDX API endpoint or higher-permission call:
- `Latitude`, `Longitude` — Required for maps and CMA radius queries. Must geocode from address if API doesn't provide.
- `DaysOnMarket`, `CumulativeDaysOnMarket` — DOM display. If unavailable, compute from `ListingContractDate` vs `StatusChangeTimestamp`.
- `OriginalListPrice` — Needed for price change history and list-to-sale ratio.
- `OriginalEntryTimestamp` — When the listing first entered the MLS.
- `ListAgentEmail`, `ListAgentStateLicense`, `ListOfficePhone` — Agent contact details for broker matching.
- `BuyerAgentStateLicense` — For tracking buyer's agents.
- `TaxYear` — Associates tax amount with a year.
- `WaterfrontFeatures` — Detailed waterfront description.
- `BuildingAreaTotal` — Total building area including non-living spaces.

**Important:** If non-IDX API access is not available for some fields, the system must gracefully degrade. DOM can be computed. Lat/long can be geocoded. Agent license can be manually entered in admin.

### A.2 Core Listing Fields (Exact Spark API Names)

**Identification:**
- `ListingId` — MLS number (string). Primary identifier displayed to users.
- `ListingKey` — Spark system key. Internal use only.
- `OriginatingSystemKey`, `OriginatingSystemName` — Source system identifiers.
- `SourceSystemKey`, `SourceSystemName` — Alternative source identifiers.

**Status:**
- `StandardStatus` — RESO standard status values (Active, Pending, Closed, etc). Use this for display.
- `MlsStatus` — MLS-specific status. May have more granular values.
- `StatusChangeTimestamp` — When the status last changed.
- `ListingContractDate` — Date the listing agreement was signed (effectively the list date).
- `OnMarketDate` — Date the listing went on market (may differ from contract date).
- `CloseDate` — Date the sale closed (only for closed/sold listings).
- `PriceChangeTimestamp` — When price last changed.

**Pricing:**
- `ListPrice` — Current asking price.
- `OriginalListPrice` — Original asking price when first listed (non-IDX).
- `ClosePrice` — Final sale price (only for closed/sold listings).

**Property Details:**
- `PropertyType` — Internal type code.
- `PropertyTypeLabel` — Human-readable type (RESO: PropertyType).
- `PropertySubType` — Sub-classification (RESO: PropertySubType).
- `BedsTotal` — Total bedrooms (RESO: BedroomsTotal).
- `BathsFull` — Full bathrooms (RESO: BathroomsFull). **Note: Field is `BathsFull`, not `BathroomsFull`.**
- `BathsHalf` — Half bathrooms (RESO: BathroomsHalf). **Note: Field is `BathsHalf`, not `BathroomsHalf`.**
- `BathroomsTotalInteger` — Total bathroom count as integer.
- `LivingArea` — Living area in sqft (RESO: LivingArea).
- `BuildingAreaTotal` — Total building area (non-IDX).
- `LotSizeAcres` — Lot size in acres.
- `LotSizeSquareFeet` — Lot size in sqft.
- `LotSizeArea` — Lot size (may be in various units, check `LotSizeUnits`).
- `LotSizeUnits` — Unit of measurement for LotSizeArea.
- `YearBuilt` — Year the home was built.
- `Levels` — Number of levels/stories.
- `GarageSpaces` — Number of garage spaces.
- `AttachedGarageYN` — Is the garage attached?
- `NewConstructionYN` — Is this new construction?

**Address:**
- `StreetNumber` — House number.
- `StreetName` — Street name.
- `StreetSuffix` — St, Ave, Dr, etc.
- `StreetDirPrefix`, `StreetDirSuffix` — N, S, E, W directional.
- `UnitNumber` — Unit/apt number.
- `UnparsedAddress` — Full address string.
- `City` — City name. **This is how we determine geographic hierarchy.**
- `StateOrProvince` — State (always "OR" for our data).
- `PostalCode`, `PostalCodePlus4` — Zip code.
- `CountyOrParish` — County name.
- `SubdivisionName` — Subdivision/community name. **This is how we map listings to communities.**
- `Latitude`, `Longitude` — Coordinates (non-IDX). Essential for maps and CMA.
- `ParcelNumber` — Tax parcel ID.

**Description & Remarks:**
- `PublicRemarks` — Public listing description (displayed to all users).
- `Directions` — Driving directions.

**Features:**
- `ArchitecturalStyle` — Home style.
- `ConstructionMaterials` — Building materials.
- `Roof` — Roof type.
- `FoundationDetails` — Foundation type.
- `Flooring` — Flooring types.
- `Heating`, `HeatingYN` — Heating system.
- `Cooling`, `CoolingYN` — Cooling system.
- `FireplaceFeatures`, `FireplaceYN` — Fireplace details.
- `InteriorFeatures` — Interior features list.
- `ExteriorFeatures` — Exterior features list.
- `KitchenAppliances` — Appliances (RESO: Appliances).
- `PatioAndPorchFeatures` — Patio/porch details.
- `ParkingFeatures` — Parking details.
- `LotFeatures` — Lot characteristics.
- `PoolFeatures` — Pool details.
- `View` — View type (mountains, golf course, lake, river, etc). **Very important for Central Oregon.**
- `WaterFrontYN` — Is the property waterfront?
- `WaterfrontFeatures` — Waterfront details (non-IDX).
- `WaterSource` — Water supply type (well, municipal, etc).
- `Sewer` — Sewer type (septic, municipal, etc).
- `WindowFeatures` — Window details.
- `AccessibilityFeatures` — ADA accessibility features.
- `SecurityFeatures` — Security system details (in non-IDX CustomFields).
- `SeniorCommunityYN` — Is this a 55+ community?

**HOA:**
- `AssociationYN` — Is there an HOA?
- `AssociationFee` — HOA fee amount.
- `AssociationFeeFrequency` — Monthly, quarterly, annual.
- `AssociationAmenities` — HOA amenities list.

**Tax:**
- `TaxAmount` — Annual property tax (RESO: TaxAnnualAmount).
- `TaxYear` — Tax year for the amount (non-IDX).

**Schools (IDX-available — from MLS data):**
- `ElementarySchool` — Assigned elementary school.
- `MiddleOrJuniorSchool` — Assigned middle school.
- `HighSchool` — Assigned high school.

**Media:**
- `PhotosCount` — Number of photos.
- `PhotosChangeTimestamp` — When photos were last updated.
- `VirtualTourURLUnbranded` — Virtual tour URL (unbranded version for IDX display).

**Agent & Office (Listing Side):**
- `ListAgentName` — Full name (RESO: ListAgentFullName).
- `ListAgentFirstName`, `ListAgentLastName` — Name parts.
- `ListAgentMlsId` — Agent's MLS ID. **Used for broker-listing association.**
- `ListAgentStateLicense` — Oregon license number (non-IDX). **Used for broker matching.**
- `ListAgentEmail` — Email (non-IDX).
- `ListOfficeName` — Brokerage name.
- `ListOfficeMlsId` — Brokerage MLS ID.
- `ListOfficePhone` — Brokerage phone (non-IDX).
- Co-list agent fields mirror list agent fields with `CoList` prefix.

**Agent & Office (Buyer Side — populated on closed listings):**
- `BuyerAgentName`, `BuyerAgentFirstName`, `BuyerAgentLastName`, `BuyerAgentMlsId`.
- `BuyerOfficeName`, `BuyerOfficeMlsId`.
- Co-buyer agent fields mirror with `CoBuyer` prefix.

**Timestamps:**
- `ModificationTimestamp` — Last modified. **Used for delta sync (only fetch records modified after last sync).**
- `ListingUpdateTimestamp` — Alternative modification timestamp (also IDX-available, maps to RESO ModificationTimestamp).
- `OriginalEntryTimestamp` — First entered MLS (non-IDX).

**IDX Display Control:**
- `PermitInternetYN` — Is internet display permitted?
- `VOWAddressDisplayYN` — Can address be displayed on VOW?
- `VOWAutomatedValuationDisplayYN` — Can automated valuations (our CMA) be displayed? **Must respect this flag. If false, do NOT show our estimated value for this listing.**
- `VOWConsumerCommentYN` — Can consumer comments be shown?

### A.3 Central Oregon-Specific Fields (Non-IDX, CustomFields Group)

These fields are particularly relevant for Central Oregon real estate and may appear as CustomFields in the Spark API:

- `View` — Types include: Cascade Mountains, Golf Course, Lake, Mountain(s), River. **Display prominently on listing page.**
- `WaterFrontYN` + `WaterfrontFeatures` — Lake Front, Riverfront, Waterfront.
- `IrrigationWaterRightsYN`, `IrrigationWaterRightsAcres`, `IrrigationSource` — Important for rural/farm properties.
- `HorseYN` — Horse property designation.
- `SeniorCommunityYN` — 55+ communities.
- `PoolFeatures` — Pool, Indoor Pool, Pool Cover, Pool Sweep, Pool/Spa Combo.
- `Sewer` options include: Septic Tank, Septic Needed — relevant for rural properties.
- `WaterSource` options include: Well, Shared Well, On Site Well — relevant for rural properties.
- Golf Course association fields.

### A.4 Property Types Available

| Property Type | Total Fields | IDX Fields | Notes |
|---|---|---|---|
| Residential | 1,090 | 121 | Primary focus. SFR, condos, townhomes. |
| Land | 855 | 96 | Vacant lots and land. |
| Farm | 1,181 | 118 | Agricultural properties. Includes irrigation/water rights. |
| Mobile Home | 1,022 | 117 | Manufactured homes. |
| Residential Income | 1,101 | 114 | Multi-family investment. |
| Commercial Sale | 1,176 | 102 | Commercial properties. |
| Commercial Lease | 1,158 | 102 | Commercial leases. |
| Business Opportunity | 482 | 73 | Businesses for sale. |

**Phase 1 focus:** Residential only (matching Beacon Report scope — SFR, excluding condos, manufactured, acreage per standard market reporting). Expand to Land, Farm, and other types in Phase 2.

### A.5 Database Schema Corrections

Based on the actual Spark API field names, the following corrections apply to the database schema in Section 6:

- `listings.beds` → Store as `beds_total` (from `BedsTotal`)
- `listings.baths_full` → Store as `baths_full` (from `BathsFull`, NOT `BathroomsFull`)
- `listings.baths_half` → Store as `baths_half` (from `BathsHalf`, NOT `BathroomsHalf`)
- `listings.baths_total` → Store as `baths_total_integer` (from `BathroomsTotalInteger`)
- `listings.sqft` → Store as `living_area` (from `LivingArea`)
- `listings.lot_sqft` → Store as `lot_size_sqft` (from `LotSizeSquareFeet`)
- `listings.lot_acres` → Store as `lot_size_acres` (from `LotSizeAcres`)
- `listings.subdivision_name` → Store as `subdivision_name` (from `SubdivisionName`) — this is the community link
- `listings.mls_number` → Store as `listing_id` (from `ListingId`)
- `listings.listing_key` → Store as `listing_key` (from `ListingKey`) — Spark internal ID
- `listings.status` → Store as `standard_status` (from `StandardStatus`)
- `listings.list_agent_mls_id` → From `ListAgentMlsId` — broker matching key
- `listings.list_agent_name` → From `ListAgentName`
- `listings.list_office_name` → From `ListOfficeName`
- `listings.modification_timestamp` → From `ModificationTimestamp` — delta sync key
- `listings.virtual_tour_url` → From `VirtualTourURLUnbranded`
- `listings.vow_avm_display_yn` → From `VOWAutomatedValuationDisplayYN` — must check before showing CMA
- Store ALL remaining Spark fields in `listings.raw_data` JSONB column

---

## APPENDIX B: ARYEO Integration (Verified URL Structure)

### B.1 ARYEO Download Center URL Pattern

Based on the actual ARYEO URL provided:

**Actual URL (after tracking redirect):**
`https://framed-visuals.aryeo.com/listings/{uuid}/download-center`

**Components:**
- **Photographer subdomain:** `framed-visuals` (this is the photographer's ARYEO account name — may vary per photographer)
- **Domain:** `aryeo.com`
- **Path:** `/listings/{uuid}/download-center`
- **UUID:** ARYEO's internal listing UUID (e.g., `019c5420-0ea8-7168-b42a-007a50cd4cc8`). This is NOT the MLS ID.

### B.2 ARYEO Scraping Workflow

When a broker pastes an ARYEO download center URL in the admin backend:

1. **Parse the URL** to extract the photographer subdomain and listing UUID.
2. **Fetch the download center page** (server-side, via `fetch` in a Next.js API route).
3. **Parse the HTML** to extract all media links. The download center typically contains:
   - High-resolution photos (exterior, interior, aerial/drone).
   - Floor plans (if ordered).
   - Virtual tour links.
   - Video files or links.
   - 3D tour links (Matterport, etc).
4. **Download and store** all media in Supabase Storage, organized by listing.
5. **Associate media with the listing** in the `listing_photos` and `listing_videos` tables.
6. **Mark photos as ARYEO-sourced** (flag: `source = 'aryeo'`) to differentiate from MLS photos.
7. **ARYEO photos take priority** over MLS photos in display order (better quality).

### B.3 Admin Interface for ARYEO

In the admin backend, under the listing enhancement view:
- **"ARYEO Media" section** with a URL input field.
- Broker pastes the download center URL.
- "Import Media" button triggers the scraping workflow.
- Progress indicator shows download status.
- After import: grid of all imported media with drag-to-reorder, delete, set-as-hero options.
- Admin can re-import (re-scrape) if the photographer adds new media.

### B.4 Photographer Subdomain Handling

The subdomain (`framed-visuals` in the example) identifies which photographer produced the media. Store this in the listing enhancement record so the system knows which photographer's ARYEO account to reference. Different listings may use different photographers, so the subdomain is per-listing, not global.

---

## APPENDIX C: Remaining Gaps & Assumptions

These items could not be verified without additional access. The coding agent should flag these during implementation for manual verification.

1. **Spark API authentication flow** — Assumed OAuth2 or API key based. Need to confirm exact auth endpoint, token refresh, and rate limits from Spark API docs.
2. **Spark API photo endpoint** — Photos are typically accessed via a separate `/listings/{id}/photos` endpoint. The exact URL pattern needs verification.
3. **Spark API pagination** — Assumed cursor-based or offset pagination. Need to confirm for the initial 500K+ listing load.
4. **Existing Supabase schema** — Priorities 1-6 are implemented. The actual table names and column names in the existing database may differ from this spec. The coding agent should inspect the existing schema before creating new tables.
5. **Existing codebase conventions** — File structure, component patterns, naming conventions, import patterns need to be inspected by the coding agent.
6. **Oregon Data Share exact attribution text** — Referenced Sections 5-3 and 5-4 but have not seen the verbatim text. Must be pulled from the ODS Rules and Regulations document and placed exactly as required.
7. **FUB account configuration** — Current custom fields, action plans, round-robin rules, and lead sources in Matt's FUB account need to be inventoried before implementation to avoid conflicts.
8. **VOWAutomatedValuationDisplayYN** — This Spark API field controls whether automated valuations can be shown for a listing. Our CMA/estimated value feature MUST respect this flag. If a listing has this set to false, we cannot show our estimated value for it.
9. **Non-IDX API access level** — 13 critical fields (Lat/Long, DOM, OriginalListPrice, agent emails/licenses) require non-IDX API access. Need to confirm our Spark API subscription level includes these.

---

*This document is the single source of truth. Update as decisions are made. When feeding sections to an AI coding agent, always include Section 4 (env vars), Appendix A (field mapping), and the relevant feature section. Build fast. Ship daily. Get into production ASAP and iterate.*
