# Build Step 18: FUB Lead Scoring & Behavioral Intelligence

Scope: Lead generation, lead scoring, CRM & behavioral intelligence, FUB workflows.

Build the complete lead intelligence system:

## TASK 1: FUB Events API — Complete Implementation
Update src/lib/fub.ts with the full event inventory:

Registration events:
- Registration: on account creation. Include name, email, phone, registration method, UTM params.
- General Inquiry: on any contact form submission. Include message, page URL, context.

Property events:
- Property Viewed: batched — collect views for 5 minutes per user, then send one event with all viewed listing URLs. Use an in-memory queue that flushes every 5 minutes via an Inngest function.
- Property Saved: immediate. Include listing URL, price, address, community.
- Property Shared: immediate. Include listing URL, share platform.
- Property Unsaved: immediate.

High-intent events (send within 60 seconds, trigger broker alert):
- CMA Downloaded: immediate. Include property address, estimated value, comp count. Tag: "cma-downloader".
- Tour Requested: immediate. Include listing URL, preferred date/time. Tag: "tour-request".
- Open House RSVP: immediate. Include listing URL, event date. Tag: "open-house-rsvp".

Engagement events:
- Saved Search Created: immediate. Include search filters, notification preference.
- Comparison Created: immediate. Include all listing URLs being compared.
- Return Visit: when a known user returns after 7+ days of inactivity. Tag: "return-visitor".

Create src/app/api/fub/batch-views/route.ts:
- Called by Inngest function every 5 minutes
- Flushes accumulated property views per user to FUB
- Groups views by user, sends one event per user with all listing URLs

## TASK 2: FUB Custom Fields
Create a setup script or documentation at docs/FUB_CUSTOM_FIELDS.md listing all 16 custom fields to create in FUB:
- buyer_budget_min, buyer_budget_max (number)
- preferred_communities (text)
- preferred_beds, preferred_baths (number)
- move_timeline (text: ASAP, 1-3mo, 3-6mo, 6-12mo, Just Browsing)
- lead_score (number)
- lead_tier (text: cold, warm, hot, very_hot)
- last_active_date (date)
- total_listings_viewed (number)
- total_listings_saved (number)
- cma_downloads (number)
- registration_source (text)
- preferred_property_type (text)
- is_seller_curious (boolean)
- engagement_streak_days (number)

When pushing events to FUB, include relevant custom field updates in the person object.

## TASK 3: Lead Scoring Engine
Create src/lib/lead-scoring.ts:
- Function: computeLeadScore(userId: string) that calculates a score based on activity:

Point values:
| Action | Points |
|--------|--------|
| Account creation | 10 |
| Property view | 1 |
| Property save | 5 |
| Saved search created | 10 |
| CMA downloaded | 25 |
| Tour requested | 30 |
| Open house RSVP | 20 |
| Contact form submitted | 15 |
| Comparison created | 10 |
| Return visit (after 7+ days) | 15 |
| 5+ views in one session | 5 (bonus) |
| Viewed same listing 3+ times | 10 (bonus) |
| Saved 5+ listings | 10 (bonus) |
| Price drop email opened | 3 |
| Price drop email clicked | 5 |
| Time on site > 5 min | 3 |
| Time on site > 15 min | 5 (bonus) |

- Weekly decay: all points decrease by 20% each week to keep scores fresh
- Tiers: Cold (0-20), Warm (21-50), Hot (51-100), Very Hot (101+)
- Store current score and tier in profiles table and push to FUB custom fields

## TASK 4: Lead Score Computation (Inngest Function)
Create inngest/functions/computeLeadScores.ts:
- Inngest function id: "leads/compute-scores"
- Triggered: daily at 3 AM
- For each user with any activity in the last 30 days:
  - Query user_activities
  - Apply point values and decay
  - Update profiles.lead_score and profiles.lead_tier
  - If tier changed: push updated tier to FUB custom fields
  - If tier crossed into Hot or Very Hot: create FUB task for assigned broker

## TASK 5: Lead Conversion Workflows
Create inngest/functions/leadWorkflows.ts with these Inngest functions:

"leads/silent-browser-to-registered":
- Triggered when an anonymous visitor with 10+ page views creates an account
- Push all prior activity to FUB retroactively
- Tag: "high-engagement-new-lead"
- Alert broker

"leads/cma-downloader-followup":
- Triggered 24 hours after CMA download if no broker contact has occurred
- Create FUB task: "Follow up on CMA download for [address]"

"leads/active-saver-detection":
- Triggered when a user saves 5+ listings in one session
- Push to FUB with tag "active-saver"
- Include list of saved communities and price range

"leads/price-watcher-detection":
- Triggered when a user views the same listing 3+ times
- Push to FUB with tag "price-watcher"
- Include listing details

"leads/seller-curious-detection":
- Triggered when a user visits /sell page or downloads CMA for a property in their area
- Push to FUB with tag "seller-curious"
- Update is_seller_curious custom field

"leads/ghosted-lead-reengagement":
- Triggered when a previously active lead (Hot/Very Hot) has no activity for 14+ days
- Create FUB task: "Re-engage [name] — no activity for 14 days"
- Optionally send a "We miss you" email with new listings matching their preferences

## TASK 6: Activity Tracking Middleware
Create src/lib/activity-tracker.ts:
- Server-side function called on key API routes to log to user_activities
- Captures: user_id (or visitor_cookie_id for anonymous), activity_type, entity_type, entity_id, metadata (page, referrer, UTM params, device)
- Efficient: bulk insert, non-blocking

## TASK 7: Anonymous Visitor Tracking
Create src/lib/visitor.ts:
- On first visit: generate a unique visitor cookie (UUID stored in HTTP-only cookie, 1-year expiry)
- All activity tracked against this cookie ID in user_activities
- When visitor creates an account: merge all anonymous activity into their user profile
- This enables the "Silent Browser" workflow — you can see what they did before signing up

## TASK 8: Admin Lead Analytics
Create src/app/(admin)/reports/leads/page.tsx:
- Lead funnel visualization: Visitors → Registered → Active → Hot → Converted (contacted broker)
- Lead sources: breakdown of where leads come from (organic, direct, social, email, paid)
- Lead scoring distribution: chart showing how many leads in each tier
- Top high-intent actions this week: CMA downloads, tour requests, RSVPs
- Response time metrics: average time from lead creation to first broker contact (requires FUB data)

Register all new Inngest functions in inngest/functions/index.ts.

TypeScript strict. No any types.
