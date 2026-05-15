# AgentFire menu audit + improvement proposal

**Date:** 2026-05-15
**Trigger:** Matt — "if I'm on my mobile, I can't get to the blog, and a lot of other items aren't correct. I can't get to everything."

## Current state

### WordPress menus in `wp-admin/nav-menus.php` (7 total)

| ID | Name | Status | Items |
|---|---|---|---|
| 66 | **Nav 2.0** | **active main desktop nav** | 10 |
| 49 | About Mega Menu | desktop flyout | 4 |
| 47 | Buyer Mega Menu | desktop flyout | 4 |
| 48 | Seller Mega Menu | desktop flyout | 4 |
| 36 | Footer Sitemap | footer | 15 |
| 35 | Nav | legacy / unused | — |
| 34 | Temporarily Header Menu | legacy / unused | — |

### Desktop main nav (Nav 2.0) — what visitors see in the top bar

1. PROPERTIES → `/properties/`
2. AREA GUIDES → `/explore/`
3. CLIENT SUCCESS → `/testimonials/`
4. **SERVICES** → `#` (no destination — dead tap on touch devices)
   - RELOCATION
   - BUY A HOME
   - SELL YOUR HOME
   - VALUE MY HOME
5. WHY CHOOSE US → `/about-us/`
6. Blog → `/blog/`

### Mobile menu (drawer ID `mm-2144`) — what the hamburger actually exposes

1. BUY WITH US → `/buyers/`
2. FEATURED LISTINGS → `/featured-listings/`
3. HOME SEARCH → `/properties/`
4. AREA GUIDES → `/explore/`
5. SELL WITH US → `/sellers/`
6. OUR PLAN → `/seller-plans-new/`
7. HOME VALUATION → `/free-home-valuation/`
8. OUR HOMES → `/featured-listings/` ← **duplicate destination with #2**
9. MEET OUR TEAM → `/about-us/`
10. JOIN OUR TEAM → `/join-us/`
11. READ OUR REVIEWS → `/testimonials/`
12. READ OUR BLOG → `/blog/`
13. info@ryan-realty.com (mailto)
14. 541-213-6706 (tel)

### Footer (Menu 36) — has 15 items, including ones NOT in main nav

- Past Sales
- VIP Home Search
- Mortgage Calculator
- Giving Back
- Relocation
- Contact

### Legacy mobile drawer (`mm-1874`, no longer triggered)

Contains the items missing from `mm-2144` (Relocation, Mortgage Calculator, Past Sales, Giving Back, Contact, social links, Google review). Someone built a richer drawer once and the current site no longer routes to it.

## Issues found

| # | severity | issue |
|---|---|---|
| 1 | **HIGH** | `SERVICES` has `href="#"` — on touch devices a tap does nothing. Desktop hover triggers the dropdown but mobile/tablet users hit a dead link. |
| 2 | **HIGH** | Mobile menu has no top-level grouping. 12 items in a flat list with no visual hierarchy. Hard to scan. Blog is at position 12. |
| 3 | **HIGH** | Mobile menu missing **Contact** page (only mailto/tel as plain text). |
| 4 | **HIGH** | Mobile menu missing **Relocation** (only on desktop SERVICES dropdown). |
| 5 | MED | Mobile menu missing **Mortgage Calculator**, **Past Sales**, **Giving Back** — these exist as pages and are in the footer but no mobile path. |
| 6 | MED | "OUR HOMES" (mobile item #8) and "FEATURED LISTINGS" (mobile item #2) both point at `/featured-listings/`. Duplicate destination is confusing. |
| 7 | MED | Naming inconsistency: desktop says "Blog", mobile says "READ OUR BLOG". Same with "Testimonials" vs "READ OUR REVIEWS", "About Us" vs "WHY CHOOSE US" / "MEET OUR TEAM". |
| 8 | MED | Mobile menu has no clear **Home** link. Once you're inside a page, returning to the homepage requires the logo tap (which works but isn't obvious to all users). |
| 9 | MED | No path to **individual neighborhood pages** (Tree Farm, Valhalla Heights, etc.) from any menu — only via `/explore/` → search. |
| 10 | MED | No **Market Reports** entry anywhere, despite being a major SEO target. |
| 11 | LOW | Two unused legacy menus (Nav, Temporarily Header Menu) still in `wp-admin`. |
| 12 | LOW | `mm-1874` legacy mobile menu still in DOM but never shown. Cruft. |

## Proposal: Mobile menu restructure (drawer `mm-2144`)

Add visual section headings + reorder by user intent. Add the missing items (Relocation, Contact, Mortgage Calculator, etc.). Reduce duplication.

```
HOME

I'M LOOKING TO BUY
  Search homes
  Featured listings
  Relocating to Bend
  Mortgage calculator
  Get notified of new listings

I'M LOOKING TO SELL
  Our seller plan
  Free home valuation
  Our recent sales
  Why list with us

EXPLORE THE AREA
  Bend
  Redmond
  Sisters
  La Pine
  Sunriver
  Terrebonne
  Tumalo
  All Deschutes County

ABOUT RYAN REALTY
  Meet our team
  Read our reviews
  Join our team
  Giving back

STAY CONNECTED
  Read the blog
  Market reports
  Contact us

  541-213-6706
  info@ryan-realty.com
```

This puts the BLOG inside the "STAY CONNECTED" section near the bottom with the contact info — a natural place for it, and clearly visible without scrolling past 12 unlabeled items.

## Proposal: Desktop main nav (Nav 2.0)

Reduce SERVICES dead-link, add a real homepage link, and surface Market Reports.

| Current | Proposed |
|---|---|
| PROPERTIES | PROPERTIES (`/properties/`) |
| AREA GUIDES | EXPLORE BEND (`/explore/`) |
| CLIENT SUCCESS | — |
| SERVICES (dead link) → 4 children | **BUYERS** (`/buyers/`) → 5 children: Search, Featured, Relocation, Mortgage calc, Get alerts |
| WHY CHOOSE US | **SELLERS** (`/sellers/`) → 4 children: Our plan, Free valuation, Past sales, Why list with us |
| Blog | **MARKET** (`/market/`) → Reports, Stats, Blog |
| | **ABOUT** (`/about-us/`) → Team, Reviews, Giving back, Join us |

Total: 7 top-level items, each with a real destination (so taps work on touch), and a flyout with subitems. Pushes the cluttered SERVICES dropdown into properly named BUYERS/SELLERS sections.

The current "WHY CHOOSE US" terminology is overloaded — it links to /about-us/ but users don't necessarily associate "why choose us" with "about us." Renaming to ABOUT clarifies.

The new "MARKET" section gives the blog a logical home alongside market reports and stats, which:
- Surfaces market reports prominently
- Gives the blog a permanent destination in main nav (you mentioned the blog being hard to find)
- Improves SEO by clustering related market-content pages

## Proposal: Footer

Trim Footer Sitemap (currently 15 items, all unlinked in admin so they're using auto-resolved permalinks). Keep but reorganize as 3-column grid:

```
COMPANY              BUYERS                SELLERS
About                Search homes          Our plan
Meet our team        Featured listings     Free valuation
Join us              Relocation            Past sales
Giving back          Mortgage calculator   Recent transactions
Contact              VIP home search

EXPLORE              CONNECT
Bend                 Read the blog
Redmond              Market reports
Sisters              Read reviews
La Pine              Facebook · Instagram · YouTube
Sunriver
Terrebonne
Tumalo

Ryan Realty LLC · Oregon Principal Broker #201206613 · 541.213.6706 · info@ryan-realty.com · Equal Housing Opportunity
```

## Proposal: Cleanup

Remove the legacy menus:
- Menu 35 ("Nav") — replaced by Nav 2.0
- Menu 34 ("Temporarily Header Menu") — name says it all

Hide or delete the legacy `mm-1874` mobile drawer in the AgentFire theme so it doesn't ship in the page DOM.

## Implementation order

1. **Today** — fix the highest-impact bugs:
   - Add Contact link to mobile menu
   - Add Relocation link to mobile menu
   - Fix SERVICES dead-link (give it `/services/` or `/buyers/` as fallback)
   - Remove the duplicate "OUR HOMES" mobile item (or rename to distinguish from FEATURED LISTINGS)

2. **This week** — restructure:
   - Build the new mobile menu groupings (BUY / SELL / EXPLORE / ABOUT / CONNECT)
   - Add Market Reports + Mortgage Calculator + Past Sales + Giving Back to mobile drawer
   - Rename mobile menu items to match desktop (Blog vs READ OUR BLOG)

3. **Next week** — desktop restructure:
   - Rename CLIENT SUCCESS → CLIENT REVIEWS or fold into ABOUT
   - Replace SERVICES dropdown with proper BUYERS / SELLERS / MARKET / ABOUT structure
   - Add Market Reports as a top-level menu item

4. **Backlog** — cleanup:
   - Delete legacy menus 34, 35
   - Delete `mm-1874` from theme
   - Ensure every page in the footer also has a path through the main menu

## Notes on AgentFire menu mechanics

- Mega menus in Spark theme aren't standard `wp_nav_menu` outputs — they're attached to top-level Nav 2.0 items via shortcodes or CSS classes.
- The mobile drawer is built from one of the mega-menu shortcodes (currently `mm-2144`), not from Nav 2.0 directly. That's why the desktop and mobile menus diverge.
- To change mobile menu content, you either (a) edit whichever mega menu feeds `mm-2144`, or (b) reconfigure the mobile drawer in AgentFire theme settings to read from a different menu.
- The AgentFire support team can make these changes if we send them a clear "before / after" spec — this document is structured to be that spec.

## Source data

All findings traced via Chrome MCP + `wp-admin/nav-menus.php` inspection on 2026-05-15. No assumptions — every link in this audit was read directly off the page DOM with the current mobile viewport (390×844) rendering.
