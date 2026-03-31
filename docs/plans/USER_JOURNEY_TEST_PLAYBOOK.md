# User Journey Test Playbook

**Purpose**: Step-by-step instructions for an AI agent (or human tester) to execute every user journey on the live site and document pass/fail results.

**Live Site**: https://ryanrealty.vercel.app
**Last Updated**: 2026-03-31

---

## How to Use This Document

1. **Execute each test in order**. Some later tests depend on earlier ones.
2. **For each test**: follow the exact steps, check every expected result, and record PASS/FAIL.
3. **If a test fails**: document what actually happened vs what was expected. Include the URL, any error messages, and a screenshot if possible.
4. **Record results** in the Results Template at the bottom of this document.

### Environment Requirements
- A modern web browser (Chrome recommended, 1440×900 desktop viewport)
- For mobile tests: use Chrome DevTools device emulation (iPhone 14, 375×812)
- No browser extensions that block JavaScript or modify page content
- Clear cookies/localStorage before starting (fresh anonymous session)

### Test Accounts
- **Admin**: matt@ryan-realty.com (superuser role)
- **E2E Test User**: e2etest@ryanrealty.com (email login)
- **Regular User**: Sign up with any Google account via OAuth

### Key Test Data
- **City with listings**: Bend (1,016 active listings)
- **Sample listing key**: `20260206202531872348000000` (897K, Upper Terrace, Bend)
- **High-value listing**: `20230918124152407797000000` ($16.8M, Bend)
- **Subdivision with listings**: Pronghorn, Upper Terrace, Discovery West Phase 4
- **Broker slugs**: matthew-ryan, paul-stevenson, rebecca-peterson
- **Market report slugs**: weekly-2026-03-22, weekly-2026-03-08

---

## SECTION A: Anonymous Visitor Tests (20 tests)

### TEST UJ-001: Land on Homepage from Google

**Setup**: Clear all cookies and localStorage. Start with a fresh browser session.

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/`
2. Wait for the page to fully load

**Check each item** (PASS/FAIL):
- [ ] Page loads without errors (no blank page, no error message)
- [ ] Load time is under 5 seconds (check browser Network tab → DOMContentLoaded)
- [ ] Title bar shows "Ryan Realty" and "Central Oregon"
- [ ] Hero section is visible with heading "Find Your Home in Central Oregon"
- [ ] Search bar is visible with placeholder text mentioning city/community/address
- [ ] Search button is visible and clickable
- [ ] Navigation bar shows: Home, Home Valuation, Buyers, Sellers, About, Reports
- [ ] "Log In" button is visible in the top-right area
- [ ] **NO sign-in modal appears** on first visit (modal should only appear after 3+ page views)
- [ ] Scroll down: "Work with Central Oregon's top team" section is visible with team photo and testimonial
- [ ] Scroll down: "Latest activity" section shows listing activity cards
- [ ] Scroll down: "Discover by lifestyle" section has links (Waterfront, Golf course, etc.)
- [ ] Scroll down: "Browse by price range" section has links (Under $500K, Under $750K, etc.)
- [ ] Scroll down: "Housing Market Report" section is visible
- [ ] Scroll down: "Popular cities" section shows city cards
- [ ] Scroll to bottom: Footer is visible with Buy, Sell, Company, Resources columns
- [ ] Footer shows contact info: address (115 NW Oregon Ave), phone (541-213-6706), email
- [ ] Right-click → View Page Source → search for `og:url`: value starts with `https://` (not `http://`)
- [ ] Right-click → View Page Source → search for `canonical`: value starts with `https://`
- [ ] Right-click → View Page Source → search for `application/ld+json`: JSON-LD blocks present

**Document any failures**: _______________

---

### TEST UJ-002: Search by City Name

**Steps**:
1. From the homepage, click on the search bar
2. Type "Bend"
3. Wait 1-2 seconds for autocomplete suggestions to appear
4. Look for a dropdown with city suggestions
5. Click on "Bend" in the suggestions (or press Enter)
6. You should be redirected to `/homes-for-sale/bend`

**Check each item**:
- [ ] Search bar accepts text input
- [ ] Autocomplete dropdown appears when typing (may take 1-2 seconds)
- [ ] Dropdown includes "Bend" as an option
- [ ] Clicking a suggestion navigates to the search page
- [ ] URL is `https://ryanrealty.vercel.app/homes-for-sale/bend`
- [ ] Page title contains "Bend" and "Homes for Sale"
- [ ] Listing count is displayed (should be ~1,000+ active listings)
- [ ] Filter bar is visible with: Min price, Max price, Beds, Baths, Sq ft, Property type, Status, Sort by
- [ ] "Apply" button is visible next to filters
- [ ] Listing cards are visible below the filter bar (at least 6-9 cards)
- [ ] Each listing card shows: photo, price, address, beds/baths/sqft, status badge
- [ ] "View on map" link is visible near the page heading

**Document any failures**: _______________

---

### TEST UJ-003: Apply Filters to Search

**Precondition**: On the Bend search page (`/homes-for-sale/bend`)

**Steps**:
1. In the "Min price" field, type `300000`
2. In the "Max price" field, type `500000`
3. In the "Beds" dropdown, select `3+`
4. In the "Baths" dropdown, select `2+`
5. Click "Apply" button

**Check each item**:
- [ ] Results update (listing count changes from ~1,000 to a smaller number)
- [ ] All visible listing prices are between $300,000 and $500,000
- [ ] All visible listings have 3+ bedrooms
- [ ] URL updates with filter parameters (e.g., `?minPrice=300000&maxPrice=500000&beds=3&baths=2`)
- [ ] Copy the URL, open in a new tab → same filters applied (URL is shareable)
- [ ] Click "More filters" button → additional filter options appear (year built, lot size, etc.)
- [ ] Change "Beds" back to "Any", click "Apply" → results increase

**Document any failures**: _______________

---

### TEST UJ-004: Sort Search Results

**Precondition**: On the Bend search page

**Steps**:
1. Find the "Sort by" dropdown in the filter bar
2. Change from "Newest first" to "Price: high to low"
3. Click "Apply"

**Check each item**:
- [ ] "Sort by" dropdown is visible with a default value of "Newest first"
- [ ] Dropdown has 8 options: Newest, Oldest, Price low→high, Price high→low, Price/sqft low→high, Price/sqft high→low, Year newest, Year oldest
- [ ] After applying "Price: high to low", the first listing has the highest price
- [ ] URL includes `sort=price_desc`
- [ ] Changing sort to "Newest first" and applying → listings reorder

**Document any failures**: _______________

---

### TEST UJ-005: View Map and Toggle Map/List View

**Precondition**: On the Bend search page

**Steps**:
1. Scroll down past listings to find the embedded map
2. Look for the map showing Bend, Oregon area
3. Click "View on map" link in the page heading area
4. If map view opens, look for listing pins/markers

**Check each item**:
- [ ] Embedded map is visible on the search page (below the listing grid)
- [ ] Map shows the Bend, Oregon area
- [ ] "View on map" link exists in the page heading
- [ ] Clicking "View on map" opens a full map view (URL changes to include `view=map`)
- [ ] In map view: listing pins/clusters are visible on the map
- [ ] In map view: clicking a pin shows a listing info popup with photo, price, address
- [ ] Can switch back to list view

**Document any failures**: _______________

---

### TEST UJ-006: Draw Polygon on Map to Search

**Precondition**: In map view (`/homes-for-sale/bend?view=map`)

**Steps**:
1. In the full map view, look for drawing tools
2. If available, click the draw tool
3. Draw a polygon around a neighborhood
4. Check if results filter to listings inside the polygon

**Check each item**:
- [ ] Map view loads with listing pins
- [ ] Drawing tool is available (may be a button or icon)
- [ ] Can draw a polygon on the map
- [ ] Results filter to only listings inside the polygon
- [ ] Can clear/redo the drawing

**Note**: This feature may not be implemented. Document what you find.

**Document any failures**: _______________

---

### TEST UJ-007: View Listing Detail Page

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/homes-for-sale/bend`
2. Click on any listing card
3. Wait for the listing detail page to load

**Check each item**:
- [ ] Page loads without errors
- [ ] Large photo is visible at the top (hero photo)
- [ ] Photo thumbnail strip is visible below the hero
- [ ] Price is displayed prominently (e.g., "$897,000")
- [ ] Address is displayed (should be an `<h1>` tag — right-click → Inspect to verify)
- [ ] Key facts are visible: beds, baths, sqft
- [ ] "Active" status badge is shown
- [ ] Estimated monthly payment is shown (e.g., "Est. $4,775/mo")
- [ ] Scroll down: "Key facts" section with lot size, property type, year built, MLS number
- [ ] Scroll down: "Demand indicators" section with view/save/like counts
- [ ] Scroll down: Property description text
- [ ] Scroll down: "Property details" section with detailed attributes
- [ ] Scroll down: "Estimated Monthly Payment" calculator
- [ ] Scroll down: Agent attribution card (listing agent name + office)
- [ ] Scroll down: Map showing property location
- [ ] Scroll down: Similar listings section
- [ ] "Save" button visible (heart icon)
- [ ] "Share" button visible
- [ ] "Schedule tour" button visible

**Document any failures**: _______________

---

### TEST UJ-008: Browse Photo Gallery

**Precondition**: On a listing detail page with photos

**Steps**:
1. Click the main/hero photo at the top of the listing page
2. A lightbox/fullscreen gallery should open
3. Click the right arrow to go to the next photo
4. Click the left arrow to go to the previous photo
5. Note the photo counter (e.g., "3 of 25")
6. Press the Escape key
7. On mobile: try swiping left/right

**Check each item**:
- [ ] Clicking the hero photo opens a lightbox/fullscreen view
- [ ] Multiple photos are available to browse
- [ ] Right arrow navigates to next photo
- [ ] Left arrow navigates to previous photo
- [ ] Photo counter shows current position (e.g., "3 of 25")
- [ ] Pressing Escape closes the lightbox
- [ ] After closing, you're back on the listing page

**Document any failures**: _______________

---

### TEST UJ-009: Try to Save a Listing (Anonymous)

**Precondition**: NOT signed in (anonymous visitor). On a listing detail page.

**Steps**:
1. Click the "Save" button (heart icon) on a listing detail page
2. Observe what happens

**Check each item**:
- [ ] Save button is visible and clickable
- [ ] Clicking Save shows a sign-in prompt or redirects to login
- [ ] Sign-in prompt has Google, Apple, Facebook options
- [ ] Sign-in prompt has "Maybe later" option
- [ ] No error message shown

**Document any failures**: _______________

---

### TEST UJ-010: Share a Listing

**Precondition**: On a listing detail page

**Steps**:
1. Click the "Share" button
2. A share menu/dialog appears
3. Click "Copy Link"
4. Check clipboard for the URL
5. Note other share options available

**Check each item**:
- [ ] Share button is visible and clickable
- [ ] Share menu opens with multiple options
- [ ] "Copy Link" option exists and copies URL to clipboard
- [ ] "Email" option exists
- [ ] "Text" or "SMS" option exists
- [ ] "WhatsApp" option exists
- [ ] Toast/notification confirms when link is copied

**Document any failures**: _______________

---

### TEST UJ-011: Contact Agent from Listing

**Precondition**: On a listing detail page

**Steps**:
1. Find the "Schedule tour" button (in the sticky bar near the top)
2. Click it
3. You should be taken to `/contact?listing=LISTING_KEY&reason=tour`
4. Fill out the contact form:
   - Name: "Test User"
   - Email: "test-uj011@example.com"
   - Phone: "555-0011"
   - Check the message field — it should be pre-filled with listing reference
5. Do NOT submit (unless you want to test the full flow)

**Check each item**:
- [ ] "Schedule tour" button is visible on the listing page
- [ ] Clicking it navigates to the contact page
- [ ] Contact page URL includes `listing=` and `reason=tour` parameters
- [ ] Message field is pre-filled with text mentioning the listing (e.g., "I'd like to schedule a showing for listing...")
- [ ] "How can we help?" dropdown is set to "Buying" (because reason=tour)
- [ ] Name, email, phone, message fields are all present
- [ ] Submit button says "Send message"

**Also test the "Ask a question" flow**:
1. Go back to the listing detail page
2. Find "Ask a question" link (in the agent card section)
3. Click it → should navigate to `/contact?listing=LISTING_KEY&reason=inquiry`
4. Message should be pre-filled with "I have a question about listing..."

**Document any failures**: _______________

---

### TEST UJ-012: Browse Team Page

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/team`
2. Wait for the page to load

**Check each item**:
- [ ] Page loads with a heading about the team
- [ ] Three broker cards are visible:
  - [ ] Matt Ryan — Owner & Principal Broker
  - [ ] Paul Stevenson — Broker
  - [ ] Rebecca Ryser Peterson — Broker
- [ ] Each card has a photo
- [ ] Each card has a name and title
- [ ] Each card links to a profile page
3. Click on Matt Ryan's card → navigate to `/team/matthew-ryan`
- [ ] Profile page loads with Matt's bio (multiple paragraphs)
- [ ] Contact info is visible (email, phone)
- [ ] "Schedule tour" or contact CTA is visible
- [ ] "Back to team" or breadcrumb navigation works
4. Navigate to `/team/paul-stevenson` — verify Paul's profile loads
5. Navigate to `/team/rebecca-peterson` — verify Rebecca's profile loads

**Document any failures**: _______________

---

### TEST UJ-013: Use Home Valuation Tool

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/sell/valuation`

**Check each item**:
- [ ] Page loads with title "Home Valuation"
- [ ] Address input field is visible
- [ ] Submit/CTA button is visible (e.g., "Get Your Free Estimate" or similar)
- [ ] Form validates — try submitting empty → error message
- [ ] Enter a test address: "123 Main St, Bend, OR 97701"
- [ ] Submit the form
- [ ] Success message or confirmation is shown (or lead capture confirmation)

**Document any failures**: _______________

---

### TEST UJ-014: Browse Market Reports

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/housing-market`
2. Look for city cards/links

**Check each item**:
- [ ] Page loads with "Housing Market" heading
- [ ] City cards or links are visible (Bend, Redmond, etc.)
3. Click on "Bend" (or navigate to `/housing-market/bend`)
- [ ] City market report page loads
- [ ] "Median" price or "median" text is present
- [ ] "Days on market" or "DOM" is mentioned
- [ ] A chart or graph is visible (price trend)
- [ ] Market health indicator or score is present
- [ ] Statistics are non-zero (not "0" or "N/A" for everything)
4. Navigate to `https://ryanrealty.vercel.app/housing-market/reports/weekly-2026-03-22`
- [ ] Weekly market report loads with data

**Document any failures**: _______________

---

### TEST UJ-015: Read a Guide

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/guides`

**Check each item**:
- [ ] Page loads with "Guides" or similar heading
- [ ] Either: guide articles are listed with links, OR a meaningful empty state is shown
- [ ] If guides are listed: click one → full article loads with content
- [ ] If no guides: page should not show an error or blank content

**Known issue**: The `guides` database table may not exist yet. The page should gracefully show generated content from market stats.

**Document any failures**: _______________

---

### TEST UJ-016: Browse Open Houses

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/open-houses`

**Check each item**:
- [ ] Page loads with "Open Houses" heading
- [ ] Either: open house listings are shown with dates/times, OR a meaningful empty state is shown
- [ ] If listings exist: dates are in the future, times are formatted correctly
- [ ] City filter is available
2. Navigate to `https://ryanrealty.vercel.app/open-houses/bend`
- [ ] Page loads (may show empty state if no open houses in Bend)

**Known issue**: The `open_houses` table currently has 0 rows. This is expected if no open house data is flowing from MLS.

**Document any failures**: _______________

---

### TEST UJ-017: Use Mortgage Calculator

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/tools/mortgage-calculator`

**Check each item**:
- [ ] Page loads with "Mortgage Calculator" heading
- [ ] Input controls are visible for: home price, down payment, interest rate, loan term
- [ ] Controls may be sliders or text inputs
- [ ] Default values are pre-filled (reasonable numbers)
- [ ] Monthly payment breakdown is displayed
- [ ] Adjust the home price → payment updates
- [ ] Breakdown shows: principal & interest, property tax, insurance

**Document any failures**: _______________

---

### TEST UJ-018: View Community Page

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/homes-for-sale/bend/pronghorn`

**Check each item**:
- [ ] Page loads with heading mentioning "Pronghorn"
- [ ] Community-specific listings are shown (listing cards)
- [ ] Listing count is shown
- [ ] Community description or about section is present
- [ ] Market stats or quick facts for the community
- [ ] Nearby communities links (if applicable)
- [ ] Filters are available to refine within the community

**Try another community**: Navigate to `/homes-for-sale/bend/discovery-west-phase-4`
- [ ] Different community loads with different listings

**Document any failures**: _______________

---

### TEST UJ-019: Navigate Between Pages

**Steps**: Visit each URL and verify it loads (HTTP 200, no error page).

| # | URL | Expected Title Contains | PASS/FAIL |
|---|-----|------------------------|-----------|
| 1 | `/` | Ryan Realty | |
| 2 | `/about` | About | |
| 3 | `/team` | Team | |
| 4 | `/homes-for-sale` | Homes for Sale | |
| 5 | `/homes-for-sale/bend` | Bend | |
| 6 | `/housing-market` | Housing Market | |
| 7 | `/housing-market/bend` | Bend | |
| 8 | `/contact` | Contact | |
| 9 | `/sell` | Sell | |
| 10 | `/sell/valuation` | Valuation | |
| 11 | `/buy` | Buy | |
| 12 | `/guides` | Guides | |
| 13 | `/open-houses` | Open Houses | |
| 14 | `/tools/mortgage-calculator` | Mortgage | |
| 15 | `/communities` | Communities | |
| 16 | `/blog` | Blog | |
| 17 | `/privacy` | Privacy | |
| 18 | `/terms` | Terms | |
| 19 | `/login` | (login page) | |
| 20 | `/team/matthew-ryan` | Matt Ryan | |

**Additional checks**:
- [ ] Browser back button works correctly between pages
- [ ] No flash of unstyled content during navigation
- [ ] Active/current page is indicated in the navigation

**Document any failures**: _______________

---

### TEST UJ-020: Mobile Experience

**Setup**: Use Chrome DevTools → Toggle device toolbar → Select "iPhone 14" (375×812) or set custom viewport to 375×812.

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/`

**Check each item**:
- [ ] No horizontal scrollbar appears
- [ ] Page does not scroll horizontally (try scrolling left/right)
- [ ] Hamburger menu icon (☰) is visible in the top-right
- [ ] Tapping hamburger opens a slide-out menu with navigation links
- [ ] Menu can be closed by tapping X or outside the menu
- [ ] Search bar is usable on mobile
- [ ] Hero text is readable without zooming
2. Navigate to `/homes-for-sale/bend`
- [ ] No horizontal overflow
- [ ] Listing cards stack in a single column
- [ ] Filters are accessible (may be in a collapsible panel)
- [ ] Listing photos are full-width
3. Navigate to a listing detail page
- [ ] Photo gallery works with touch (swipe to navigate)
- [ ] Price, address, and key facts are readable
- [ ] All sections stack properly (no side-by-side layout breaking)
- [ ] Contact/Schedule buttons are full-width and tappable
- [ ] All touch targets are at least 44×44px (buttons, links)
4. Navigate to `/contact`
- [ ] Contact form is usable on mobile
- [ ] Inputs are full-width
- [ ] Keyboard doesn't obscure the form

**Document any failures**: _______________

---

## SECTION B: Signed-In User Tests (9 tests)

### Setup for Section B
Sign in using one of these methods:
- Click "Log In" → sign in with Google OAuth
- Navigate to `/login` → sign in with the test account

After signing in, verify: header shows your avatar/name instead of "Log In" button.

---

### TEST UJ-030: Sign In with Google

**Steps**:
1. Click "Log In" in the header
2. Click "Continue with Google" on the login page
3. Complete the Google OAuth flow
4. You should be redirected back to the site

**Check each item**:
- [ ] Google OAuth dialog appears
- [ ] After authorizing, you're redirected back to Ryan Realty
- [ ] Header shows your avatar or initial instead of "Log In"
- [ ] Clicking your avatar shows a dropdown menu
- [ ] Dropdown shows: Saved Homes, Saved Searches, Profile, Sign Out (or similar)

**Document any failures**: _______________

---

### TEST UJ-031: Save a Listing

**Precondition**: Signed in

**Steps**:
1. Navigate to `/homes-for-sale/bend`
2. Click on any listing card to open the detail page
3. Click the "Save" button (heart icon)
4. Note the listing address/key
5. Navigate to `/account/saved-homes`

**Check each item**:
- [ ] Save button changes state when clicked (e.g., filled heart, color change)
- [ ] A toast/notification confirms the save
- [ ] Navigate to `/account/saved-homes`
- [ ] The saved listing appears in the list with photo, price, address
6. Go back to the saved listing detail page
- [ ] Save button shows "saved" state (filled heart)
7. Click the Save button again (unsave)
- [ ] Button reverts to unsaved state
- [ ] Go to `/account/saved-homes` → listing is no longer there

**Document any failures**: _______________

---

### TEST UJ-032: Save a Search

**Precondition**: Signed in

**Steps**:
1. Navigate to `/homes-for-sale/bend`
2. Apply some filters: set min price to $300,000, beds to 3+
3. Click "Apply"
4. Look for a "Save Search" button (should be near the filter bar)
5. Click it
6. A confirmation should appear
7. Navigate to `/account/saved-searches`

**Check each item**:
- [ ] "Save Search" button is visible on the search page (for signed-in users)
- [ ] Clicking it saves the search with current filters
- [ ] Confirmation toast/message appears
- [ ] `/account/saved-searches` page loads
- [ ] Saved search is listed with filter criteria description
- [ ] Clicking the saved search returns to the search page with same filters applied
- [ ] Can delete a saved search

**Document any failures**: _______________

---

### TEST UJ-033: Email Alerts for Saved Search

**Note**: This test requires `RESEND_API_KEY` to be configured. If not configured, document that email delivery cannot be verified.

**Check each item**:
- [ ] After saving a search, there's an option to enable email alerts
- [ ] The cron endpoint exists: `GET /api/cron/saved-search-alerts` (returns 401 Unauthorized, which is correct — it's protected)

**Document any failures**: _______________

---

### TEST UJ-034: View Browsing History

**Precondition**: Signed in. View 3 different listing detail pages first.

**Steps**:
1. Visit listing 1: click any listing from `/homes-for-sale/bend`
2. Visit listing 2: go back, click a different listing
3. Visit listing 3: go back, click another listing
4. Navigate to `/account/history` or `/dashboard/history`

**Check each item**:
- [ ] History page loads
- [ ] Shows the 3 listings you just viewed
- [ ] Most recent listing is at the top
- [ ] Each entry shows: photo, price, address
- [ ] Clicking an entry navigates to the listing detail page

**Document any failures**: _______________

---

### TEST UJ-035: Set Buying Preferences

**Precondition**: Signed in

**Steps**:
1. Navigate to `/account/buying-preferences`

**Check each item**:
- [ ] Page loads with a preferences form
- [ ] Fields for: price range, preferred cities, property types, beds/baths
- [ ] Can set preferences and save
- [ ] After saving, preferences persist on page reload
- [ ] Down payment %, interest rate, loan term fields may be present

**Document any failures**: _______________

---

### TEST UJ-036: Edit Profile

**Precondition**: Signed in

**Steps**:
1. Navigate to `/account/profile`

**Check each item**:
- [ ] Page loads with current user info (name, email)
- [ ] Avatar is displayed (if using Google OAuth, Google avatar should show)
- [ ] Name field is editable
- [ ] Can save changes
- [ ] Changes persist after page reload

**Document any failures**: _______________

---

### TEST UJ-037: Share a Listing via All Channels

**Precondition**: Signed in. On a listing detail page.

**Steps**: Same as UJ-010, but also verify:
- [ ] All share channels work for signed-in users
- [ ] Share count increments after sharing

**Document any failures**: _______________

---

### TEST UJ-038: Export Personal Data

**Precondition**: Signed in

**Steps**:
1. Navigate to `/account/settings` or `/account/profile`
2. Look for an "Export My Data" button or link

**Check each item**:
- [ ] Export button/link is visible
- [ ] Clicking it triggers a download or displays data
- [ ] Exported data includes: saved listings, saved searches, listing views, buying preferences
- [ ] Data format is readable (JSON or similar)

**Document any failures**: _______________

---

## SECTION C: Admin Tests (7 tests)

### Setup for Section C
Sign in as matt@ryan-realty.com (superuser).
Navigate to `/admin` to access the admin panel.

---

### TEST UJ-050: Admin Login

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/admin`

**Check each item**:
- [ ] If not signed in: redirected to admin login page
- [ ] Sign in with admin account (matt@ryan-realty.com)
- [ ] Admin dashboard loads
- [ ] Dashboard shows system health information or overview
- [ ] Non-admin users who try to access `/admin` are shown "Access Denied"

**Document any failures**: _______________

---

### TEST UJ-051: View Sync Status

**Steps**:
1. Navigate to `/admin/sync`

**Check each item**:
- [ ] Sync page loads
- [ ] Shows last sync time and date
- [ ] Shows sync status (success/error)
- [ ] Shows listing count (how many listings were synced)
- [ ] "Trigger Sync" button or similar is visible
- [ ] Sync history table shows past runs

**Document any failures**: _______________

---

### TEST UJ-052: Manage Brokers

**Steps**:
1. Navigate to `/admin/brokers`

**Check each item**:
- [ ] Broker list loads with 3 brokers
- [ ] Each broker shows: name, title, email, active status
- [ ] Click "Edit" on a broker → edit form loads
- [ ] Fields include: name, title, bio, photo, email, phone, specialties
- [ ] Make a small edit (e.g., change a specialty), save
- [ ] Visit the public broker profile (`/team/matthew-ryan`) → change is reflected

**⚠️ Revert any changes after testing.**

**Document any failures**: _______________

---

### TEST UJ-053: Create and Publish a Guide

**Steps**:
1. Navigate to `/admin/guides`

**Check each item**:
- [ ] Guide management page loads
- [ ] "New Guide" or "Create" button is visible
- [ ] Can create a new guide with: title, slug, category, content
- [ ] Can save as draft
- [ ] Can publish the guide
- [ ] Published guide is accessible at `/guides/[slug]`

**Known issue**: The `guides` database table may not exist. If creation fails with a database error, document: "FAIL — guides table not created in database."

**Document any failures**: _______________

---

### TEST UJ-054: View Lead Dashboard

**Steps**:
1. Navigate to `/admin` (main admin page)

**Check each item**:
- [ ] Dashboard has a leads/inquiries section
- [ ] Shows lead count (may be 0 if no inquiries yet)
- [ ] Lead source breakdown visible (if data exists)
- [ ] Can click into individual leads to see details

**Document any failures**: _______________

---

### TEST UJ-055: Manage Site Content

**Steps**:
1. Navigate to `/admin/site-pages`

**Check each item**:
- [ ] Site pages editor loads
- [ ] Can view/edit page content (e.g., About page, Contact page)
- [ ] Changes save successfully
- [ ] Changes reflect on the public page

**Document any failures**: _______________

---

### TEST UJ-056: View Analytics Dashboard

**Steps**:
1. Navigate to the admin dashboard area
2. Look for GA4 analytics or traffic metrics

**Check each item**:
- [ ] Analytics section is visible
- [ ] If GA4 is configured: traffic data is displayed
- [ ] If GA4 is NOT configured: a clear "Configure GA4" message is shown (not a blank section)

**Known issue**: `GOOGLE_GA4_PROPERTY_ID` may not be set. Document what you see.

**Document any failures**: _______________

---

## SECTION D: SEO & Crawler Tests (5 tests)

### TEST UJ-070: Validate Sitemap

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/sitemap.xml`

**Check each item**:
- [ ] Returns valid XML (browser renders it as XML, not a blank page)
- [ ] Contains `<url>` entries
- [ ] All `<loc>` values start with `https://` (NOT `http://`)
- [ ] No duplicate `<loc>` entries (spot check: search for any URL that appears twice)
- [ ] Click 3 random URLs from the sitemap → they all return 200 (not 404)
- [ ] Sitemap contains listing detail URLs (e.g., `/homes-for-sale/bend/...`)
- [ ] Sitemap contains city pages (e.g., `/homes-for-sale/bend`)
- [ ] Sitemap contains team pages (e.g., `/team/matthew-ryan`)

**Document any failures**: _______________

---

### TEST UJ-071: Verify Meta Tags on Every Page Type

For each page, check: title (>10 chars), meta description (>50 chars), og:title, og:image, canonical starts with `https://`.

| # | URL | Title OK | Desc OK | OG OK | Canonical https | PASS/FAIL |
|---|-----|----------|---------|-------|-----------------|-----------|
| 1 | `/` | | | | | |
| 2 | `/homes-for-sale/bend` | | | | | |
| 3 | `/listing/20260206202531872348000000` | | | | | |
| 4 | `/team` | | | | | |
| 5 | `/team/matthew-ryan` | | | | | |
| 6 | `/about` | | | | | |
| 7 | `/housing-market` | | | | | |
| 8 | `/housing-market/bend` | | | | | |
| 9 | `/contact` | | | | | |
| 10 | `/guides` | | | | | |
| 11 | `/sell/valuation` | | | | | |
| 12 | `/tools/mortgage-calculator` | | | | | |

**How to check**: Right-click → View Page Source → search for `<title>`, `<meta name="description"`, `og:title`, `og:image`, `rel="canonical"`.

**Document any failures**: _______________

---

### TEST UJ-072: Validate Structured Data (JSON-LD)

**Steps**:
1. Navigate to a listing detail page (e.g., `/listing/20260206202531872348000000`)
2. Right-click → View Page Source
3. Search for `application/ld+json`

**Check each item**:
- [ ] At least 2 JSON-LD blocks are present
- [ ] One block has `"@type": "SingleFamilyResidence"` or similar
- [ ] One block has `"@type": "Product"` with price
- [ ] One block has `"@type": "BreadcrumbList"`
- [ ] All URLs in JSON-LD start with `https://`
- [ ] Price matches the displayed price
- [ ] Address matches the displayed address

**Bonus**: Paste the page URL into https://search.google.com/test/rich-results to validate structured data.

**Document any failures**: _______________

---

### TEST UJ-073: AI Crawler Access

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/robots.txt`

**Check each item**:
- [ ] robots.txt loads
- [ ] `User-Agent: GPTBot` has `Allow: /`
- [ ] `User-Agent: PerplexityBot` has `Allow: /`
- [ ] `User-Agent: ClaudeBot` has `Allow: /`
- [ ] `User-Agent: Google-Extended` has `Allow: /`
- [ ] `User-Agent: Googlebot` has `Allow: /`
- [ ] `/admin/`, `/dashboard/`, `/account/`, `/api/` are disallowed for `*`
- [ ] Sitemap URL is listed and starts with `https://`

**Document any failures**: _______________

---

### TEST UJ-074: Page Performance (Core Web Vitals)

**Steps**:
1. Open Chrome DevTools → Lighthouse tab
2. Run Lighthouse on `https://ryanrealty.vercel.app/` (Mobile, Performance)
3. Run Lighthouse on `/homes-for-sale/bend` (Mobile, Performance)
4. Run Lighthouse on a listing detail page (Mobile, Performance)

**Check each item**:
- [ ] Homepage Performance score > 60
- [ ] Homepage LCP < 4.0s
- [ ] Homepage CLS < 0.25
- [ ] Search page Performance score > 50
- [ ] Listing detail Performance score > 50
- [ ] SEO score > 80 on all pages
- [ ] Accessibility score > 80 on all pages

**Record scores**:
| Page | Performance | LCP | CLS | SEO | A11y |
|------|-------------|-----|-----|-----|------|
| Homepage | | | | | |
| Search | | | | | |
| Listing | | | | | |

**Document any failures**: _______________

---

## SECTION E: System & Data Flow Tests (5 tests)

These tests verify data flows and system processes. Some require database access or API calls.

### TEST UJ-080: Listing Sync Pipeline

**Steps** (requires database access or admin panel):
1. Navigate to `/admin/sync`
2. Check the last sync timestamp

**Check each item**:
- [ ] Last sync timestamp is visible
- [ ] Sync has run within the last 24 hours (if cron is active)
- [ ] Total listing count in the system is > 0
- [ ] Active listings count is reasonable (500+ for Central Oregon)
- [ ] Sync history shows past successful runs

**Database verification** (if you have access):
```sql
-- Check sync history
SELECT * FROM sync_history ORDER BY created_at DESC LIMIT 5;
-- Expect: recent runs with listings_upserted > 0

-- Check active listing count
SELECT COUNT(*) FROM listings WHERE "StandardStatus" ILIKE '%Active%';
-- Expect: 6,000+
```

**Document any failures**: _______________

---

### TEST UJ-081: Saved Search Alert Pipeline

**Check each item**:
- [ ] Cron endpoint exists: `GET https://ryanrealty.vercel.app/api/cron/saved-search-alerts` → returns 401 (correct, it's auth-protected)
- [ ] The action code exists at `/workspace/app/actions/saved-search-alerts.ts`
- [ ] If `RESEND_API_KEY` is configured: save a search, wait for cron, check email
- [ ] If `RESEND_API_KEY` is NOT configured: document "email delivery cannot be tested — RESEND_API_KEY not set"

**Document any failures**: _______________

---

### TEST UJ-082: Market Report Generation

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/housing-market/reports/weekly-2026-03-22`

**Check each item**:
- [ ] Market report page loads
- [ ] Contains real data (not placeholder text)
- [ ] Shows statistics for the reporting period
- [ ] Narrative text reads naturally
- [ ] Charts or visualizations present

**Also check**: `GET https://ryanrealty.vercel.app/api/cron/market-report` → returns 401 (auth-protected, correct)

**Document any failures**: _______________

---

### TEST UJ-083: Optimization Health Check

**Check each item**:
- [ ] Cron endpoint exists: `GET https://ryanrealty.vercel.app/api/cron/optimization-loop` → returns 401
- [ ] Admin panel shows optimization status (if implemented)

**Document any failures**: _______________

---

### TEST UJ-084: Lead Capture → CRM Pipeline

**Steps**:
1. Navigate to `https://ryanrealty.vercel.app/contact`
2. Fill out the contact form with test data:
   - Name: "Test Lead UJ084"
   - Email: "testlead-uj084@example.com"
   - Phone: "555-0084"
   - How can we help?: "Buying"
   - Message: "This is a test submission for UJ-084 verification"
3. Click "Send message"

**Check each item**:
- [ ] Form submits successfully
- [ ] Success message is displayed ("Thanks for reaching out")
- [ ] **Database check**: query `listing_inquiries` table for the test email — should be stored (only if submitted from a listing context with `?listing=` param)
- [ ] **CRM check**: if `FOLLOWUPBOSS_API_KEY` is configured, check FUB for the lead

**From listing context**:
1. Navigate to any listing detail page
2. Click "Schedule tour" → go to contact form
3. Submit with test data
4. Check `listing_inquiries` table — should have a row with `listing_key` populated

**Document any failures**: _______________

---

## Results Template

Copy this template and fill in results:

```
# User Journey Test Results
Date: _______________
Tester: _______________
Site URL: https://ryanrealty.vercel.app
Browser: _______________
Viewport: _______________

## Summary
Total Tests: 46
Passed: ___
Failed: ___
Blocked: ___
Not Applicable: ___

## Section A: Anonymous Visitor
| ID | Test Name | Result | Notes |
|----|-----------|--------|-------|
| UJ-001 | Homepage | | |
| UJ-002 | Search by City | | |
| UJ-003 | Apply Filters | | |
| UJ-004 | Sort Results | | |
| UJ-005 | Map View | | |
| UJ-006 | Draw Polygon | | |
| UJ-007 | Listing Detail | | |
| UJ-008 | Photo Gallery | | |
| UJ-009 | Save (anon) | | |
| UJ-010 | Share Listing | | |
| UJ-011 | Contact Agent | | |
| UJ-012 | Team Page | | |
| UJ-013 | Home Valuation | | |
| UJ-014 | Market Reports | | |
| UJ-015 | Guides | | |
| UJ-016 | Open Houses | | |
| UJ-017 | Mortgage Calculator | | |
| UJ-018 | Community Page | | |
| UJ-019 | Navigate Pages | | |
| UJ-020 | Mobile Experience | | |

## Section B: Signed-In User
| ID | Test Name | Result | Notes |
|----|-----------|--------|-------|
| UJ-030 | Sign In | | |
| UJ-031 | Save Listing | | |
| UJ-032 | Save Search | | |
| UJ-033 | Email Alerts | | |
| UJ-034 | Browsing History | | |
| UJ-035 | Buying Preferences | | |
| UJ-036 | Edit Profile | | |
| UJ-037 | Share All Channels | | |
| UJ-038 | Export Data | | |

## Section C: Admin
| ID | Test Name | Result | Notes |
|----|-----------|--------|-------|
| UJ-050 | Admin Login | | |
| UJ-051 | Sync Status | | |
| UJ-052 | Manage Brokers | | |
| UJ-053 | Create Guide | | |
| UJ-054 | Lead Dashboard | | |
| UJ-055 | Site Content | | |
| UJ-056 | Analytics | | |

## Section D: SEO & Crawler
| ID | Test Name | Result | Notes |
|----|-----------|--------|-------|
| UJ-070 | Sitemap | | |
| UJ-071 | Meta Tags | | |
| UJ-072 | Structured Data | | |
| UJ-073 | AI Crawlers | | |
| UJ-074 | Performance | | |

## Section E: System
| ID | Test Name | Result | Notes |
|----|-----------|--------|-------|
| UJ-080 | Listing Sync | | |
| UJ-081 | Search Alerts | | |
| UJ-082 | Market Report | | |
| UJ-083 | Optimization | | |
| UJ-084 | Lead → CRM | | |

## Failure Details
(For each failed test, document):
- Test ID:
- Expected behavior:
- Actual behavior:
- URL where failure occurred:
- Screenshot (if applicable):
- Error messages (if any):
- Browser console errors (if any):
```
