# Build Step 10: Broker Landing Pages

Scope: Broker landing pages, broker–listing association, broker reviews, design system, tracking, FUB integration.

Build the complete broker system:

## TASK 1: Broker Index Page
Create src/app/(public)/agents/page.tsx as a SERVER component:
- Fetch all active brokers from Supabase with stats:
  - Active listing count (matched by license/MLS ID from listing_agents)
  - Total sold count (last 24 months)
  - Total sold volume (last 24 months)
  - Average review rating (from reviews table)
  - Review count
- SEO metadata: title "Our Agents | Ryan Realty — Central Oregon Real Estate"
- JSON-LD: CollectionPage schema
- Display as a grid of broker cards (3 columns desktop, 2 tablet, 1 mobile)

## TASK 2: Broker Card Component
Create src/components/broker/BrokerCard.tsx:
- Professional headshot (circular crop, placeholder avatar if none)
- Full name (bold)
- Title / designations
- Star rating with review count
- Stats row: X Active Listings | X Sold (24mo) | $X Volume
- Specialties as tag pills (first 3)
- "View Profile" button
- Phone number (click to call on mobile)
- Hover: card elevates
- Link to /agents/[slug]

## TASK 3: Broker Detail Page
Create src/app/(public)/agents/[slug]/page.tsx as a SERVER component:
- Fetch broker by slug (create slug from name or use a slug field) with all related data:
  - Broker profile (bio, headshot, specialties, designations, social links, etc)
  - Active listings (matched via license number / MLS ID against listing_agents)
  - Sold listings (last 24 months)
  - Performance stats (total volume, avg price, avg DOM for their listings)
  - Reviews from all platforms (reviews table where broker_id matches)
  - Broker uploaded photos and videos (from Supabase Storage)
- If broker not found, return notFound()
- SEO metadata: title "[Broker Name] — Real Estate Agent | Ryan Realty, [City], Oregon", description with specialties and transaction count
- JSON-LD: RealEstateAgent schema with name, image, telephone, areaServed, review rating

## TASK 4: Broker Hero
Create src/components/broker/BrokerHero.tsx:
- Clean layout, not a giant photo hero like listing pages
- Left side: large professional headshot (square, rounded corners)
- Right side: name (H1), title/designations, tagline
- Star rating with review count
- Contact buttons: "Call [FirstName]" (phone link), "Email [FirstName]" (opens contact form), "Schedule Consultation" (primary CTA)
- Social media icons row (Instagram, Facebook, LinkedIn, YouTube, TikTok — only show if URL exists)
- Breadcrumb: Home > Agents > [Broker Name]

## TASK 5: Broker Bio Section
Create src/components/broker/BrokerBio.tsx:
- "About [FirstName]" heading
- Full bio text (rich content, proper paragraphs)
- If bio is long, truncate with "Read More"
- Specialties as tag pills (full list)
- Service areas: linked to community pages
- Years of experience
- License number (small text, Oregon compliance)

## TASK 6: Broker Stats Dashboard
Create src/components/broker/BrokerStats.tsx:
- 4 KPI cards: Total Transactions (24mo), Total Volume (24mo), Average Sale Price, Average Days on Market
- These are computed from their sold listings in the database
- Clean, professional design — this builds trust with potential clients

## TASK 7: Broker Active Listings
Create src/components/broker/BrokerListings.tsx:
- Section heading: "[FirstName]'s Active Listings" with count
- Grid of ListingCard components
- If no active listings: "No active listings right now. Contact [FirstName] to learn about upcoming opportunities."

## TASK 8: Broker Sold History
Create src/components/broker/BrokerSoldHistory.tsx:
- Section heading: "Recent Sales" with count
- Grid of ListingCard components showing sold price and close date
- Limited to last 12, "View All" expands or links to filtered search
- This is social proof — shows the broker closes deals

## TASK 9: Broker Reviews
Create src/components/broker/BrokerReviews.tsx:
- Section heading: "Client Reviews" with aggregate rating and total count
- Aggregate rating: large star display with number (e.g., "4.9 out of 5 — 47 reviews")
- Source breakdown: "32 from Zillow, 10 from Google, 5 from Yelp" (with platform icons)
- Individual reviews displayed as cards:
  - Star rating
  - Review text (truncated with "Read More" if long)
  - Reviewer name
  - Date
  - Source platform icon/badge
- Sort: newest first (default), highest rated, lowest rated
- Paginate if more than 10 reviews
- If no reviews: hide section entirely

## TASK 10: Broker Media Gallery
Create src/components/broker/BrokerGallery.tsx:
- Section heading: "Photos & Videos"
- Grid of additional broker photos (lifestyle, events, community involvement)
- Video thumbnails with play button — click opens video player modal
- Only shows if broker has uploaded additional media beyond their headshot
- If no additional media: hide section

## TASK 11: Broker Contact Form
Create src/components/broker/BrokerContactForm.tsx:
- Section with navy background
- "Get in Touch with [FirstName]"
- Form fields: Name, Email, Phone (optional), Message (pre-filled: "I'd like to learn more about Central Oregon real estate.")
- "How can [FirstName] help?" dropdown: Buying, Selling, Both, Just Exploring, Relocation
- Submit button (accent CTA)
- On submit:
  - Push to FUB as General Inquiry with broker assignment context
  - Track contact_agent event with broker_id
  - Show success message: "Message sent! [FirstName] will be in touch shortly."
  - Create/update notification_queue for broker alert

## TASK 12: Broker Share Feature
Create src/components/broker/BrokerShare.tsx:
- "Share [FirstName]'s Profile" button
- Uses the same share system from Section 27
- OG image for broker pages: headshot, name, star rating, transaction count, brokerage logo

## TASK 13: Broker Tracking
- Track broker_view event on page load with broker name, listing count, review count
- Track contact_agent, call_initiated, email_agent events
- Track scroll depth
- Push broker page view to FUB (helps track which agents leads are interested in)

Assemble broker detail page:
1. BrokerHero
2. BrokerBio
3. BrokerStats
4. BrokerListings
5. BrokerSoldHistory
6. BrokerReviews
7. BrokerGallery (conditional)
8. BrokerContactForm
9. BrokerShare

Create loading.tsx and error.tsx for both routes.

TypeScript strict. No any types. Use design system components. Follow brand colors exactly.
