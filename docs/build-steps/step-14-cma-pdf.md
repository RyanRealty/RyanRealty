# Build Step 14: CMA Engine & PDF Generation

Scope: CMA engine, CMA as lead magnet, print & PDF export (listing, CMA, report, comparison), design system.

Build the complete CMA and PDF system:

## TASK 1: CMA Computation Engine
Create src/lib/cma.ts:
- Function: computeCMA(propertyId: string) that runs the full CMA computation:
  - Step 1: Fetch the subject property (address, beds, baths, sqft, lot, year built, community, lat/lng)
  - Step 2: Find comparable sales using PostGIS radius search:
    - Query: closed listings within 1 mile radius (using ST_DWithin on geography column)
    - Filters: closed within last 6 months, same property type, beds within ±1, sqft within ±25%, year built within ±15 years
    - If fewer than 3 comps found: expand to 2 miles and/or 12 months
    - If still fewer than 3: expand to same community regardless of distance
    - Maximum 10 comps, ordered by similarity score
  - Step 3: Calculate adjustments per comp:
    - Sqft difference: $[price_per_sqft] × difference
    - Bed difference: $15,000 per bedroom
    - Bath difference: $10,000 per bathroom
    - Age difference: $2,000 per year
    - Lot size difference: $5,000 per 0.25 acre
    - Garage: $15,000 per space
    - Pool: $20,000 if present/absent
    - Adjusted sale price = comp_sold_price + adjustments
  - Step 4: Calculate estimated value:
    - Weighted average of adjusted comp prices (weight by similarity score and recency)
    - Value range: low (10th percentile of adjusted prices) to high (90th percentile)
    - Confidence: High (5+ comps, tight range), Medium (3-4 comps), Low (fewer than 3)
  - Step 5: Store result in valuations table with all comp details in valuation_comps
  - Step 6: Check VOWAutomatedValuationDisplayYN on the listing. If false, store the valuation but mark it as restricted (do not show to public)
  - Return: { estimatedValue, valueLow, valueHigh, confidence, comps, methodology }

## TASK 2: CMA Pre-computation (Inngest Function)
Create inngest/functions/precomputeCMA.ts:
- Inngest function id: "cma/precompute-all"
- Triggered: after initial sync completes, and after each delta sync that includes new closings
- For each active listing: run computeCMA if no valuation exists or if existing valuation is older than 24 hours
- Process in batches of 50 to avoid overwhelming the database
- Log results: X valuations computed, X skipped (VOW restricted), X failed (insufficient comps)

## TASK 3: CMA PDF Generation
Create src/lib/pdf/cma-pdf.tsx using @react-pdf/renderer:
- 4-page branded PDF:

Page 1 — Summary:
- Ryan Realty logo and header (navy bar)
- Property address (large)
- Hero photo
- "Estimated Market Value: $XXX,XXX"
- Value range: "$XXX,XXX — $XXX,XXX"
- Confidence indicator
- Key property stats: beds, baths, sqft, lot, year built
- Date generated
- Agent info (if available)

Page 2 — Comparable Sales:
- "Comparable Sales Analysis" heading
- Table or card layout for each comp (up to 6):
  - Address, sold price, sold date, beds/baths/sqft, lot
  - Distance from subject
  - Adjustments breakdown (line items)
  - Adjusted sale price
- Map showing subject property and all comps as numbered pins

Page 3 — Market Context:
- 4 mini charts:
  - Median price trend (community, 12 months)
  - Days on market trend
  - Active inventory count
  - Sales volume
- Market condition summary: "Seller's Market / Buyer's Market / Balanced"
- Price per sqft for the area

Page 4 — Map & Methodology:
- Google Static Maps image showing subject + comp locations
- Methodology explanation (how adjustments work, data sources)
- Disclaimer: "This is an estimate and not a formal appraisal"
- Agent contact info with headshot
- Ryan Realty branding, Equal Housing logo
- MLS attribution and ODS compliance text

## TASK 4: CMA API Routes
Create src/app/api/cma/[propertyId]/route.ts:
- GET: return cached CMA data as JSON (for displaying on listing page)
- If no cached CMA exists, compute on the fly

Create src/app/api/pdf/cma/route.ts:
- POST body: { propertyId: string }
- Generates CMA PDF using @react-pdf/renderer
- Returns PDF binary with Content-Type: application/pdf
- Track cma_downloaded event
- Push high-intent lead event to FUB (broker alert within 60 seconds)
- Requires authentication (this is a gated lead magnet)

## TASK 5: Listing PDF Generation
Create src/lib/pdf/listing-pdf.tsx using @react-pdf/renderer:
- 3-page branded listing sheet per Section 41:

Page 1:
- Branded header (logo, navy bar)
- Hero photo (full width, 40% of page)
- Address, city, state, zip
- Price (large, bold)
- Stats row: beds, baths, sqft, lot, year built, garage
- Status and DOM, MLS number

Page 2:
- 4-6 photos in 2x2 or 2x3 grid
- Property description (truncated to fit)
- Key features (2 columns): heating, cooling, flooring, appliances, exterior

Page 3:
- Monthly payment estimate breakdown
- Map image (Google Static Maps API)
- Schools list (if available)
- Footer: agent info, headshot, phone, email, license
- Equal Housing logo, MLS attribution, ODS compliance
- QR code linking to online listing page (use a QR library like 'qrcode')
- "Generated on [date] from ryan-realty.com"

Create src/app/api/pdf/listing/route.ts:
- POST body: { listingId: string }
- Generates listing PDF
- Returns PDF binary
- Track listing_pdf_downloaded event

## TASK 6: Market Report PDF
Create src/lib/pdf/report-pdf.tsx using @react-pdf/renderer:
- Branded header
- Report title: "[Community/City] Market Report — [Month Year]"
- KPI cards: median price, active listings, DOM, sales count
- Charts rendered as static images (pre-render Recharts to PNG on server)
- Data tables for detailed metrics
- Agent/brokerage branding footer
- 2-4 pages depending on data

Create src/app/api/pdf/report/route.ts:
- POST body: { reportType: string, geoName: string, period: string }
- Returns PDF binary
- Track report_downloaded event

## TASK 7: Comparison PDF
Create src/lib/pdf/comparison-pdf.tsx using @react-pdf/renderer:
- Side-by-side columns (2-4 homes)
- Hero photo per home
- All comparison metrics from Section 37
- Map showing all homes
- Branded header/footer

Create src/app/api/pdf/comparison/route.ts:
- POST body: { listingIds: string[] }
- Returns PDF binary

## TASK 8: CMA Display on Listing Page
Create src/components/listing/ListingValuation.tsx:
- Only renders if valuation exists AND vow_avm_display_yn is true
- "Estimated Value" section on listing detail page
- Value displayed large with range below
- Confidence indicator (High/Medium/Low with color)
- "Download Full Value Report" button (accent CTA)
  - Requires authentication (opens auth modal if not logged in)
  - After auth: triggers PDF download
  - Pushes CMA download event to FUB as HIGH INTENT lead
  - Broker gets alert within 60 seconds
- Comp summary: "Based on [X] comparable sales within [X] miles"
- Link to methodology explanation

Register any new Inngest functions in inngest/functions/index.ts.

TypeScript strict. No any types. Use design system components.
