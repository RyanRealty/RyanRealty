# P1 Route + Section Crawl

**Completed:** 2026-08-11 14:27 UTC

## Page ledger

- **Total public routes inventoried:** 131
- **Unaudited / inventory_partial (awaiting P2 scores):** 131
- **With section stacks attached (key templates):** 16

### By priority
- **P0:** 13
- **P1:** 53
- **P2:** 31
- **P3:** 34

### By template
- `account`: 28
- `geo`: 22
- `market`: 16
- `hub`: 9
- `lp`: 9
- `other`: 8
- `content`: 7
- `brokerage`: 6
- `legal`: 6
- `tool`: 4
- `search`: 4
- `listing`: 3
- `sell`: 3
- `buy-hub`: 2
- `deliverable`: 2
- `home`: 1
- `contact`: 1

### By design register (heuristic)
- `kb`: 59
- `legacy`: 28
- `hybrid`: 21
- `lp`: 9
- `unknown`: 8
- `legal-minimal`: 6

### P0 money paths
- `/` · home · sections_attached=12 · status=inventory_partial
- `/about` · brokerage · sections_attached=9 · status=inventory_partial
- `/buy` · buy-hub · sections_attached=3 · status=inventory_partial
- `/homes-for-sale` · search · sections_attached=3 · status=inventory_partial
- `/homes-for-sale/[...slug]` · search · sections_attached=0 · status=unaudited
- `/listing/[listingKey]` · listing · sections_attached=7 · status=inventory_partial
- `/listing/by-address/[...slug]` · listing · sections_attached=0 · status=unaudited
- `/listing/by-key/[listingKey]` · listing · sections_attached=0 · status=unaudited
- `/search` · search · sections_attached=3 · status=inventory_partial
- `/search/[...slug]` · search · sections_attached=0 · status=unaudited
- `/sell` · sell · sections_attached=7 · status=inventory_partial
- `/sell/[intent]` · sell · sections_attached=0 · status=unaudited
- `/sell/valuation` · sell · sections_attached=4 · status=inventory_partial

### Canonical URL notes
- Public search URL is **`/homes-for-sale`** (rewrite → `app/search/page.tsx`). `/search` 301s to `/homes-for-sale`.
- Listing detail lives under `/listing/*` and SEO paths under `/homes-for-sale/...` rewrites.
- `account/*` (28 routes) listed at P3 — product chrome, not primary marketing reimagine, but not invisible.

## Section ledger

- **Raw component rows (code crawl):** 406
- **Canonical audit queue (deduped):** 111
- **KB modules on disk:** 30

### Canonical patterns by job (seed)
- listing discovery: 26
- unclassified — needs P2 job assignment: 14
- search / refine: 13
- market data: 9
- spatial discovery: 8
- global chrome navigation: 7
- brokerage people: 6
- buyer capture (alerts): 5
- orient + primary CTA: 5
- geo discovery: 4
- conversion CTA: 3
- seller capture / value: 3
- global chrome footer: 2
- infra (not content): 2
- orientation / SEO: 1
- trust / social proof: 1
- live market pulse / social proof motion: 1
- objection handling: 1

### Homepage section stack (from `app/page.tsx`)
1. `KbHero`
2. `KbExploreTowns`
3. `KbCommunities`
4. `KbFeatured`
5. `KbCommunityAlerts`
6. `KbListingMap`
7. `KbTicker`
8. `KbSell`
9. `KbTestimonials`
10. `KbTeam`
11. `KbMarketHud`
12. `KbFooter`

### Sell section stack
1. `KbBreadcrumb`
2. `KbHero`
3. `SellerLPForm`
4. `SellProof`
5. `KbTestimonials`
6. `FAQBlock`
7. `KbFooter`

## P1 exit criteria

| Criterion | Status |
|---|---|
| Every public page.tsx (excl admin/api) listed | PASS (131 routes incl aliases) |
| Canonical /homes-for-sale present | PASS |
| Section catalog seeded | PASS (canonical queue ready for P2) |
| Competitive scores / dispositions | NOT YET — P2 |
| Journey timed audits | NOT YET — P2 |

## Next

**P2:** Drain PAGE_LEDGER + SECTION_LEDGER_CANONICAL — production screenshots 390+1280, competitor matrix, scores, disposition. Parallel journey A/B/C timed audits.

