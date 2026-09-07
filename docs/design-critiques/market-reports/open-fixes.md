# Open fixes — Market reports IA (ryan-realty.com)
Updated: 2026-09-06 (Public Patch Tip Ready)

Owner direction: market report pages are confusing — organize them.
Handoff: Public Patch, 2026-09-06. Market Reports bot shots + ranked gaps fold here when they land.
Base tip: `1907fdef` (CTA tip already on main). Do not push — Cos pushes when Ready.

| id | severity | finding | status | opened | ticket |
|----|----------|---------|--------|--------|--------|
| M1 | blocker | Buyers cannot tell hub vs region vs city vs published reports | landed 2026-09-06 | 2026-09-06 | |
| M2 | blocker | Market nav labels (“overview” / “reports”) collide | landed 2026-09-06 | 2026-09-06 | |
| M3 | worth fixing | Closing Quiets dump Homes doors mixed with report doors | landed 2026-09-06 | 2026-09-06 | |
| M4 | worth fixing | `/housing-market/reports` breadcrumb skipped Housing market parent | landed 2026-09-06 | 2026-09-06 | |
| M5 | worth fixing | Activity as a peer Market menu item (inventory folds it into hub) | landed 2026-09-06 | 2026-09-06 | |

Hierarchy now (one MarketPulse / Oregon Data Share source; no invented stats):
1. `/housing-market` — live hub
2. `/housing-market/[city]` — city housing market
3. `/housing-market/central-oregon` — region report
4. `/months-of-supply` — definition
5. `/how-we-get-our-numbers` — method
6. `/housing-market/history` — closed sales explorer
7. `/housing-market/reports` — published weekly/sales

Shared map: `lib/market/report-doors.ts` (nav + Quiet doors + “Where you are”).
