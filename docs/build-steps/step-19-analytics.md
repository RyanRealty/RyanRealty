# Build Step 19: Analytics (GA4, GTM, Meta Pixel)

Scope: Tracking, analytics, cookie policy, GA4/GTM/Meta Pixel, data layer events.

## TASK 1: GTM Setup
Update src/app/layout.tsx:
- Add GTM script in <head>: the standard GTM snippet using NEXT_PUBLIC_GTM_CONTAINER_ID
- Add GTM noscript iframe in <body>
- Only render if the env var exists (don't break dev without GTM)

## TASK 2: DataLayer Event Typing
Update src/lib/tracking.ts:
- Define all ~30 custom events from Section 30.3 as a TypeScript union type
- Categories: Discovery (view_listing, search, view_community, view_city, view_broker), Engagement (save_listing, share_listing, compare_listing, calculator_interact, play_video, scroll_depth), Conversion (generate_lead, tour_requested, call_initiated, cma_downloaded, sign_up, open_house_rsvp, contact_form_submit), Content (view_blog, newsletter_signup, report_downloaded)
- Each event has typed params (listing_id, community, city, page_type, lead_type, share_method, cta_location, etc)
- Function: trackEvent pushes to window.dataLayer with the event name and typed params
- Function: trackPageView pushes page_view with page_type and context

## TASK 3: Meta Pixel Integration
Create src/lib/meta-pixel.ts:
- Initialize Meta Pixel using NEXT_PUBLIC_META_PIXEL_ID
- Standard events: PageView (on every page), ViewContent (listing view), Search (search), Lead (form submit), AddToWishlist (save listing), Schedule (tour request)
- Custom events: CMADownload, OpenHouseRSVP, ComparisonView

Create src/components/tracking/MetaPixel.tsx (client component):
- Loads the Meta Pixel script
- Fires fbq('track', 'PageView') on mount
- Rendered in root layout

## TASK 4: Meta CAPI (Server-Side)
Create src/lib/meta-capi.ts:
- Server-side event sending to Meta Conversions API
- Function: sendServerEvent(eventName, userData, customData)
- Sends to: https://graph.facebook.com/v18.0/{PIXEL_ID}/events
- Uses META_CAPI_ACCESS_TOKEN
- Includes event_id for deduplication with browser pixel
- Called from API routes on key conversions: lead generation, CMA download, tour request

## TASK 5: GA4 Data API Integration (Admin)
Create src/lib/ga4-data-api.ts:
- Server-side only, uses service account credentials
- Function: runGA4Report(dimensions, metrics, dateRange) wrapping the GA4 Data API
- Function: runGA4RealtimeReport() for live visitor data
- Used by admin dashboard to pull analytics data

Update admin dashboard (src/app/(admin)/page.tsx):
- Real-time panel: active users now, active by page type, top events firing
- Pull from GA4 Data API, cache with 60-second TTL

## TASK 6: Cookie Consent Banner
Create src/components/tracking/CookieConsent.tsx (client component):
- On first visit: show bottom banner "We use cookies to improve your experience and analyze site traffic."
- Two buttons: "Accept All" and "Manage Preferences"
- "Manage Preferences" opens modal with toggles: Essential (always on), Analytics (GA4), Marketing (Meta Pixel)
- Store consent in cookie (1-year expiry)
- If analytics not consented: don't load GTM or Meta Pixel
- If marketing not consented: don't load Meta Pixel but allow GTM (for GA4 only)
- Styled to match brand, not intrusive
- CCPA compliance: include "Do Not Sell My Personal Information" link for California users

## TASK 7: AI Analytics Agent (Inngest Function)
Create inngest/functions/aiAnalyticsAgent.ts:
- Inngest function id: "analytics/ai-insights"
- Daily cron at 6 AM
- Step 1: Pull GA4 data via Data API (traffic, conversions, top pages, funnels)
- Step 2: Pull internal data from Supabase (listing engagement, lead scores, email performance)
- Step 3: Send to AI (X AI / Grok) with prompt: "Analyze this real estate website's daily performance data. Identify: pages with high traffic but low conversion (optimization opportunities), listings getting views but no saves (pricing/photo issues), trending communities, lead quality trends, and any anomalies. Output 3-5 actionable insights in plain language."
- Step 4: Store insights in agent_insights table with priority (high/medium/low)
- Step 5: High-priority insights appear on admin dashboard

TypeScript strict. No any types.
