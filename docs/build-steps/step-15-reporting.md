# Build Step 15: Market Reporting Engine

Scope: Reporting engine, market stats pre-computation, charts, city/period reports, broker performance.

Build the complete reporting system:

## TASK 1: Market Stats Computation (Inngest Function)
Create inngest/functions/computeMarketStats.ts:
- Inngest function id: "reporting/compute-market-stats"
- Triggered: after every delta sync that includes closings, and on a daily cron at 2 AM
- For each geographic entity (each city, each community with 5+ listings):
  - Compute and store in reporting_cache:
    - Median list price (active listings)
    - Median sold price (last 1/3/6/12 months)
    - Average price per sqft
    - Active listing count
    - New listings this month
    - Closed sales count (per month, last 12 months)
    - Average days on market
    - Median days on market
    - Months of inventory (active count / monthly sales rate)
    - List-to-sold price ratio (average close_price / list_price)
    - Price change frequency (% of listings with price drops)
    - Price brackets: count of listings in $0-$300K, $300-500K, $500-750K, $750K-1M, $1M-1.5M, $1.5M+
    - Conventional vs cash sales split (if data available)
    - Month-over-month and year-over-year changes for key metrics
  - Store with period_type ('monthly', 'quarterly', 'yearly') and period dates
- Use Supabase stored procedures via supabase.rpc() for heavy aggregations

## TASK 2: Market Condition Classifier
Create src/lib/market-condition.ts:
- Function: classifyMarketCondition(metrics) that returns 'sellers' | 'buyers' | 'balanced'
- Logic:
  - Months of inventory < 3 AND avg DOM < 30 AND list-to-sold > 0.98 → Seller's Market
  - Months of inventory > 6 AND avg DOM > 60 AND list-to-sold < 0.95 → Buyer's Market
  - Otherwise → Balanced Market
- Return condition with supporting data points

## TASK 3: Public Reports Page
Create src/app/(public)/reports/page.tsx as a SERVER component:
- SEO metadata: title "Central Oregon Real Estate Market Reports | Ryan Realty"
- Heading: "Market Reports"
- Area selector: dropdown or tabs for cities and major communities
- Default view: Bend market overview

Create the dynamic report page (e.g. `app/reports/[slug]/[geoName]/page.tsx`):
- Dynamic route: `/reports/city/bend`, `/reports/community/tetherow`, etc. (slug = report type; geoName = area)
- SEO metadata: title "[GeoName] Real Estate Market Report | Ryan Realty"
- Fetch reporting_cache for the selected area and time period

## TASK 4: Report Chart Components
Create src/components/reports/ directory:

MedianPriceChart.tsx:
- Line chart (Recharts) showing monthly median price over selected period
- Dual lines: median list price and median sold price
- Y-axis: dollar formatted. X-axis: month labels.
- Tooltip with exact values on hover
- Responsive

SalesVolumeChart.tsx:
- Bar chart showing monthly closed sales count
- Stacked or grouped by price bracket if data available
- Color-coded bars

DaysOnMarketChart.tsx:
- Line chart showing average and median DOM trend
- Reference line at 30 days (market benchmark)

InventoryChart.tsx:
- Area chart showing months of inventory over time
- Color zones: green (seller's, <3), yellow (balanced, 3-6), red (buyer's, >6)

PricePerSqftChart.tsx:
- Line chart showing $/sqft trend

PriceBracketChart.tsx:
- Horizontal bar chart showing listing count by price bracket
- Side-by-side: active listings vs sold (last 6 months)

ListToSoldChart.tsx:
- Line chart showing list-to-sold price ratio trend
- Reference line at 100%

KPICards.tsx:
- 4-6 stat cards in a responsive row
- Each card: metric name, large number, trend arrow (up green / down red) with percentage change vs previous period
- Animated count-up on scroll into view

## TASK 5: Report Page Assembly
The report page should include in order:
1. Area selector and time period selector (Last 3 months, 6 months, 1 year, 2 years, 5 years)
2. Market condition badge: "Seller's Market" / "Buyer's Market" / "Balanced" with explanation
3. KPICards row
4. MedianPriceChart
5. SalesVolumeChart
6. DaysOnMarketChart
7. InventoryChart
8. PricePerSqftChart
9. PriceBracketChart
10. ListToSoldChart
11. "Download as PDF" button (calls /api/pdf/report)
12. "Create Blog Post from This Report" button (admin only, per Section 32.8)
13. CTA: "What's Your Home Worth?" linking to CMA / contact form

## TASK 6: Multi-Area Comparison
Create src/components/reports/AreaComparison.tsx:
- Select 2-4 areas to compare side by side
- KPI comparison table: rows are metrics, columns are areas
- Overlay charts: multiple lines on the same chart for median price, DOM, etc
- Highlight best/worst in each metric

## TASK 7: Admin Report Generation
Create src/app/(admin)/reports/market/page.tsx:
- Report generator interface:
  - Select report type: City Market Report, Community Report, Custom Area Report
  - Select area(s)
  - Select time period
  - Generate button: computes fresh stats and displays the report
  - Download PDF button
  - "Create Blog Post" button: AI generates a narrative from the data using brand tone, opens in blog editor
  - "Email Report" button: opens email compose with report data pre-loaded
  - Schedule recurring reports: weekly/monthly auto-generation

## TASK 8: Broker Performance Reports
Create src/app/(admin)/reports/brokers/page.tsx:
- Leaderboard: brokers ranked by total volume, transaction count, avg sale price
- Time period selector
- Individual broker drill-down: click broker to see their stats over time
- Charts: transaction volume per month, average sale price trend
- Data from broker_stats table (computed by Inngest function)

Create inngest/functions/computeBrokerStats.ts:
- Inngest function id: "reporting/compute-broker-stats"
- Daily cron: compute each broker's performance metrics from their matched listings
- Store in broker_stats table

Register all new Inngest functions in inngest/functions/index.ts.

All charts must be SSR-compatible: render static on server for bots/SEO, hydrate interactively on client. Use Recharts with ResponsiveContainer.

TypeScript strict. No any types. Use design system components. Follow brand colors for all charts (navy primary, accent highlights, cream backgrounds).
