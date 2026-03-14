# Build Step 17: Open Houses, Home Comparison & Video Feed

Scope: Open houses, home comparison tool, video & media strategy.

## PART A: OPEN HOUSES

### TASK 1: Open Houses Page
Create src/app/(public)/open-houses/page.tsx as a SERVER component:
- Fetch open_houses where event_date >= today, joined with listings
- SEO metadata: title "Open Houses in Bend, Oregon — This Weekend & Upcoming | Ryan Realty"
- JSON-LD: Event schema for each open house
- Default view: "This Weekend" (upcoming Saturday and Sunday)
- Filters: date range picker, community (multi-select), city, price range, beds, baths
- Three view modes:
  - Map view: Google Map with pins for each open house, pin label shows time window
  - List view: listing cards with prominent open house date/time badge, sorted by date then time
  - Calendar view: week or month calendar with open houses as events, click event to see listing
- Track open_house_page_view event

### TASK 2: ICS Calendar File Generator
Create src/lib/ics.ts:
- Function: generateICS(event: { title, description, location, startDate, endDate, url })
- Returns a valid .ics file string
- Title: "Open House at [address]"
- Location: full address
- Description: listing URL + host agent name
- Includes 1-hour-before reminder (VALARM)

Create src/app/api/calendar/route.ts:
- GET with params: listingKey, openHouseId
- Returns .ics file with Content-Type: text/calendar and Content-Disposition: attachment

### TASK 3: Open House RSVP
Create src/app/api/open-houses/rsvp/route.ts:
- POST body: { openHouseId, listingId }
- Requires authentication
- Creates record in open_house_rsvps table (create migration if needed: id, open_house_id, user_id, created_at)
- Increments rsvp_count on open_houses record
- Queues Resend reminders: 24 hours before AND 1 hour before (notification_queue entries)
- Pushes open_house_rsvp event to FUB (high-intent lead)
- Track open_house_rsvp event to dataLayer

## PART B: HOME COMPARISON TOOL

### TASK 4: Comparison Tray
Create src/components/comparison/ComparisonTray.tsx (client component):
- Sticky bar at bottom of viewport, only visible when 1+ homes are in the tray
- Shows thumbnails of selected homes (max 4), count badge
- "Compare Now" button (accent CTA)
- Remove button (X) on each thumbnail
- State managed via React context (ComparisonContext)
- Persisted to localStorage for non-authenticated users, Supabase for authenticated
- If user tries to add 5th home: toast "Remove one to add another. Maximum 4."
- Animate in/out when homes are added/removed

Create src/contexts/ComparisonContext.tsx:
- Provides: comparisonItems (listing IDs), addToComparison, removeFromComparison, clearComparison, isInComparison
- Wraps the app in the root layout

### TASK 5: Comparison Page
Create src/app/(public)/compare/page.tsx:
- URL driven: /compare?ids=key1,key2,key3
- Fetch all listings by IDs with full data
- If fewer than 2 valid IDs: redirect to /search
- SEO: noindex (comparison pages are personalized, not for SEO)

Layout:
- Header row: hero photo per home in columns (2, 3, or 4 columns)
- Below each photo: address, price (large), remove button
- Comparison rows (vertical scroll), each row comparing one attribute:
  - Price, Price/sqft, Beds, Baths, Sqft, Lot size, Year built, HOA, Property taxes, Est monthly payment, DOM, Community, Garage spaces, Status
  - Best value in each row: subtle green background
  - Equal values: no highlight
- Map section below: all compared homes as numbered pins
- CTA per column: Contact Agent, Schedule Tour, Save, Share
- "Share This Comparison" button: copies URL, OG image shows all homes
- "Download as PDF" button: calls /api/pdf/comparison
- Track view_comparison event, push comparison context to FUB

### TASK 6: Compare Button Integration
Update ListingCard.tsx and ListingActions.tsx:
- Add "Compare" button (small icon) that calls addToComparison from context
- If already in comparison: show "In Comparison" state with checkmark
- Track compare_listing event

## PART C: VIDEO FEED

### TASK 7: Video Feed Page
Create src/app/(public)/videos/page.tsx:
- Fetch listings that have virtual_tour_url or listing_videos entries
- SEO metadata: title "Video Tours — Central Oregon Homes | Ryan Realty"

Desktop layout:
- Grid of video thumbnails (3 columns)
- Each thumbnail: listing hero photo with play button overlay, price/address overlay at bottom
- Click: opens video in lightbox modal with listing details alongside
- Filter: community, city, price range, sort (newest, most viewed)

Mobile layout:
- Full-screen vertical scroll (TikTok/Reels style)
- Each video fills the viewport
- Autoplay (muted) when scrolled into view, pause when scrolled out (Intersection Observer)
- Tap to unmute/mute toggle
- Overlay at bottom: price, address, beds/baths/sqft
- Right side buttons: like/save, share, contact agent, "View Listing" (navigates to detail page)
- Swipe up for next video

### TASK 8: Video Player Component
Create src/components/video/VideoPlayer.tsx (client component):
- Accepts: videoUrl (string), type ('youtube' | 'vimeo' | 'matterport' | 'direct')
- YouTube: render lite-youtube-embed (lazy iframe, click to load)
- Vimeo: render lite-vimeo-embed
- Matterport: render iframe with matterport embed URL
- Direct MP4: render HTML5 <video> with playsinline, controls, poster image
- Track play_video event with listing_id, video_source, video_duration

### TASK 9: Video Card Hover Preview
Update ListingCard.tsx:
- If listing has video, on mouseenter (desktop): crossfade from static photo to a silent looping video preview (3-5 seconds)
- Use a hidden <video muted autoplay loop playsinline> element
- Intersection Observer to autoplay on mobile scroll-into-view
- Crossfade: 200ms opacity transition
- On mouseleave: crossfade back to static photo

TypeScript strict. No any types. Use design system components. Follow brand colors.
