# Questions for Matt — 11 forks that actually change what gets built

---

## A. Sequencing and scope

### A1. What is the win condition for the next 30 days?

Three tracks compete for the same identity and CRM plumbing, and only one can be first:

1. **Fix what is live and wrong.** Roughly a dozen defects that are shipping today: closed-sale price bands bucketed by list price in admin reports and CSV exports, three nav links labeled "Sold homes" that render active inventory, a buyer landing page promising matches in 30 minutes that enrolls nobody, broker CRM scoping that fails open so an unmapped broker sees the whole company's book, and a sitemap emitting a URL pattern that resolves to hollow pages.
2. **Ship the West Side loop end to end.** Known homeowner sees the ad, clicks, gets resolved to their CRM record, behavior is tracked, a CMA goes out, engagement lands on the contact timeline, and you can see the whole chain in one report.
3. **Build the recruiting toolkit.** Per-broker scoping, per-broker marketing self-service, branded deliverables that carry the right agent's name and phone.

**Why it matters:** all three touch `visitor_sessions`, the person-identity resolver, and the send layer. Doing them concurrently means rewriting the same joins three times.

**What changes:** track 1 is roughly 3 days and produces no new capability. Track 2 is 2 to 3 weeks and is the only one that produces revenue evidence. Track 3 is 4 to 6 weeks and is worth little without track 2's evidence to show a recruit.

**Recommendation:** track 1 first because several items are license-adjacent and cheap, then track 2. Recruiting last, because the pitch is "we market for you" and right now you cannot prove that with a number. Track 2 produces the proof.

---

### A2. What is a scheduled loop allowed to do without you in the session?

Your stated goal is continuous autonomous improvement across every domain. Your own hard rule is draft-first, commit-last: nothing ships until you personally see and approve it. Those two are in direct tension and the tension is why the loops have been dark. The scheduling mechanism works fine (two scheduled tasks fired within the last hour). Nobody pointed it at the loops because nobody decided what an unattended loop is permitted to do.

**Why it matters:** this is the single decision that determines whether "run continuously" is buildable at all.

**What changes:**
- **Tightest:** loops diagnose and report only. You get a morning list. Cheap, and roughly what you have now.
- **Middle:** loops diagnose, build the fix, run the full gate chain, and park a reviewable draft in a queue. You approve in batches. This is a real build: a review queue, per-loop heartbeat, and a diff surface.
- **Loosest:** loops autonomously commit and push a defined class of change (dead-code removal, gate additions, test fixes, non-user-facing refactors) and only queue user-facing surfaces for review.

**Recommendation:** the loosest option, scoped by surface rather than by confidence. Auto-ship anything that touches no public pixel and no client-facing text: gates, dead code, DAL consolidation, test coverage, cron registration. Queue everything that renders to a client or publishes a number. That keeps your §0 and draft-first rules fully intact where they matter and stops you being the bottleneck on janitorial work. It also needs a heartbeat table first, otherwise a loop that errors silently is exactly as invisible as one that never ran.

---

## B. Business and compliance

### B2. Prospecting universe: what are the real limits?

Expired detection is hard-capped at six cities (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine) and listings over $500,000. FSBO inherited the same $500,000 floor with no separate decision recorded.

**Why it matters:** FSBO sellers skew materially below $500K. The floor may be discarding most of the FSBO market, and nobody chose that.

**What changes:** the floor and the city list drive Apify scrape volume, BatchData skip-trace spend, CRM row growth, and how many first-touch texts a broker has to work per week. Dropping the FSBO floor to $350K plausibly doubles or triples volume.

**Recommendation:** keep $500K for expireds since that was a deliberate call, drop FSBO to $350K, hold both at the six cities until you have evidence a broker can actually work the current volume. Expanding geography before the worklist is being worked just grows a backlog.

---

### B2. Ten years of historical market reports: how far back, and whose methodology?

The stats cache does not reach back ten years, and CLAUDE.md forbids aggregating raw listings for market reports. Publishing 2015 to 2019 numbers means blessing a computation method for periods the current cache never covered. Those numbers carry your license.

**Why it matters:** this is the difference between an M-sized backfill and an XL project with a §0 exposure attached to every archived page, permanently.

**What changes:** if you want the full ten years, we backfill the cache with a versioned methodology, label every archive page with the method and computation date, and accept that some early periods may not have enough clean closed data to publish. If five years is enough, the existing cache path mostly covers it and the work drops to building the dated archive routes.

**Recommendation:** backfill using the exact current methodology (SFR only, `PropertyType='A'`), register it as a distinct methodology version, and go back as far as the raw closed data supports cleanly. Stamp every archive page with the method version and computation date. If a period cannot be computed honestly, it does not ship. My guess is that lands you somewhere between 7 and 10 years, and I would rather find the real floor than promise ten and fudge the tail.

---

### B3. Does your IDX/MLS agreement permit public display of individual sold and closed listings?

Aggregate closed statistics are already published across the site. Individual sold listing pages are a different permission in most MLS IDX agreements, and I cannot find the agreement in the repo.

**Why it matters:** three shipped nav surfaces currently promise "Sold homes" and silently render active inventory. I need to know whether to build the real thing or pull the links.

**What changes:** if permitted, a sold/closed facet becomes a real indexable path segment, feeds the sitemap, unlocks per-listing sold history on detail pages, and gives the CMA and market-report products a public evidence surface. That is a substantial SEO and content asset. If not permitted, sold data stays broker-only and I pull the three misleading links this week.

**Recommendation:** I am pulling the three "Sold homes" links immediately either way, since they currently lie. Send me the IDX agreement or the answer and I will build the facet if it clears.

---

### B4. How much autonomy does a recruited broker get?

Two linked supervision decisions, both yours as principal broker:

1. **Publishing.** Can Paul or Rebecca launch their own ads and social posts under the Ryan Realty brand with their own attribution, or does everything render through you for approval?
2. **Client email.** Their client email already syncs into the CRM timeline, so you can read it. Nothing scans it. Do you want active content monitoring (fair housing, advertising disclosure, keyword flags, with alerts to you), or is read-on-demand acceptable?

**Why it matters:** the recruiting pitch is marketing self-service. Full self-service means a per-broker publishing identity, per-broker OAuth, and per-broker attribution, which is an XL build and a supervision exposure. Approval-gated means a single queue and a much smaller build.

**What changes:** answer 1 determines whether we build a second publishing identity at all. Answer 2 determines whether we build a scanner now or leave the substrate in place and build it later.

**Recommendation:** approval-gated publishing for now, with per-broker attribution links (that page already exists and is switched off behind a superuser-only capability, so it is a one-line unlock). Skip active email monitoring at three brokers, since you can still read everything. Build it before broker number four, not after, because at six you cannot read and at that point it is a scanner on already-synced data rather than a new integration.

---

## C. Product behavior

### C1. Brand voice: replace the banned-word list, or layer Orwell on top of it?

You said you do not need a banned-word list. The entire enforcement substrate is a banned-word list, duplicated across twelve places in executable code, with the baseline ratcheted to zero tolerance. Four of the six Orwell rules cannot be regex-detected.

**Why it matters:** removing the list does not degrade enforcement gradually, it removes it in one commit. And retiring the canonical voice doc breaks a gate across all 24 producer files.

**What changes:** replacing means every draft goes through a non-deterministic LLM review that costs tokens, adds latency, and cannot be a commit-time gate. Layering keeps a deterministic floor and adds LLM judgment on top for the rules a regex cannot reach.

**Recommendation:** layer. Collapse the twelve copies to one generated source (they have already drifted, and one of them currently hard-fails any generated brief containing the word "about"). Keep the deterministic list as the floor, since it catches "stunning" and "nestled" for free at zero cost. Add an Orwell-rules LLM pass as an advisory reviewer on long-form only, reporting violations plus a suggested rewrite with a fact-preservation check. Do not make it a commit blocker. Your objection was to the list being the *ceiling* of the voice standard, and layering fixes that without removing the floor.

---

### C2. Out-of-area MLS coverage: referral capture, or full page build?

Today an out-of-area visitor gets a hand-written 404 that reads "That place is not in our Central Oregon coverage" and sends them to the search page. You asked for coverage of all MLS subdivisions including cities outside the service area, for referral-fee capture.

**Why it matters:** the spread is a one-day change versus thousands of new pages, and building pages for markets you do not work carries a real thin-content and topical-dilution risk against the Central Oregon authority you have been building.

**What changes:** referral capture is a handful of pages and a lead route. Full coverage means the geo archetype, the sitemap, and the market-data pipeline all have to handle geographies with no cached stats.

**Recommendation:** one referral-capture page per out-of-area city, not per subdivision. Honest copy: you do not work Burns, you will connect them with someone who does, here is the referral arrangement. A few dozen pages, measurable. Expand to subdivision depth only if referrals actually close. The current 404 is the single cheapest fix in this entire audit and it is currently a dead end on a lead surface.

---

### C3. The proactive price-opinion offer: automatic send, or broker prompt?

You asked for "I saw you were looking at this home, want our opinion on price?" All the parts exist and are disconnected: saved homes are captured, engagement scoring runs, the BPO builder works, and the tracked send rail works.

**Why it matters:** an automated email that says "we saw you looking at this house" reads as surveillance. The same sentence from a broker who chose to send it reads as service. This is a brand decision, not an engineering one, and it sits right against your "never pander" rule.

**What changes:** auto-send means a trigger, a cron, a consent gate, and a suppression check on a lead who never asked to hear from you. Broker prompt means a queue item on the dashboard and a one-tap send.

**Recommendation:** broker prompt. It is a smaller build, keeps a human in the loop on the exact message that could read as creepy, and it feeds the "who needs me right now" queue you asked for on the broker landing view. Revisit auto-send only if the manual version converts and volume outgrows the brokers.

---

## D. Budget and external dependencies

### D1. What is the monthly ceiling for automation spend, and what gets cut first when it binds?

Three live cost centers: Apify scraping (FSBO plus expired detection, which has silently gone dark on a spend cap before with no alarm), BatchData skip trace (per-lookup, scales directly with B1's price floor), and LLM calls (adversarial audits, voice grading, AI reply drafting, producer runs).

**Why it matters:** the build differs at each tier. Under roughly $100/month you run single-source Zillow daily and skip LLM grading in CI. At $300 to $500 you can add a second FSBO source, run scrapes more often, and grade every draft. Above that you can run adversarial audits across every loop.

**What changes:** the number determines source count, scrape cadence, and whether LLM review is per-commit or per-draft.

**Recommendation:** name a number. I would propose roughly $250/month split across the three, with a hard zero-result alarm on every scraper (the current failure mode is indistinguishable from an empty market, which is how the pipelines went dark unnoticed) and a cost ledger per pipeline so you can see what each lead actually costs.

---

### D2. What is the monthly Facebook ad spend you are actually planning?

The playbook specifies a three-campaign CBO architecture. That is wrong below roughly $1,500/month, because splitting a small budget across three campaigns starves each ad set below Meta's learning threshold and you never exit learning.

**Why it matters:** spend level changes the campaign structure, not just the pace.

**What changes:** under $1,000/month it is one campaign, one or two ad sets, and creative rotation is the only lever. At $2,000 or more the three-campaign structure earns its keep and the qualified-lead conversion signal becomes worth optimizing toward.

**Recommendation:** start at one campaign regardless of the number, with the West Side audience as inclusion and an exclusion audience so you stop paying to reacquire people already in the CRM. There is currently no exclusion audience in the repo at all, because the script that built it was deleted, which means prospecting spend can be served to your existing book with nothing preventing it. Rewrite the playbook to match the real spend rather than aspirational spend.

---

# DECISIONS I AM MAKING WITHOUT ASKING

Veto any of these in one pass.

## Live defects I am fixing without discussion

- **Closed-sale price bands** computed from `ListPrice` in `get_beacon_price_bands`, with a property-type filter that matches nothing. Porting the 2026-06-26 fix already applied to `get_beacon_metrics`. This is a live §0 violation in admin reports and CSV exports.
- **Broker CRM scoping fails open.** An unmapped broker email currently returns the whole company's clients and tasks. Changing to fail closed, and moving broker identity out of the three hardcoded email maps into the brokers table.
- **The "Sold homes" links** in the footer, mega-menu, and `/sold` redirect all render active inventory. Pulling them until B3 is answered.
- **`/lp/buyer-listing-alerts`** promises matches within 30 minutes and enrolls nobody. Wiring it to the existing alert creation path using criteria the form already collects.
- **Sitemap** emits `/cities/{city}/{sub}`, which does not resolve, while the working route `/communities/{city}-{sub}` is never emitted. Swapping it, extending the middleware hard-404 guard to two-segment paths, and adding `/subdivisions`.
- **Visitor identity id-space mismatch.** Session reads join on the dead FUB id while writes use the native CRM id, so every contact created since the June cutover shows an empty behavior panel. Migrating all readers to `crm_person_id`.
- **Scroll and section tracking** is dropped on roughly 60 page families by three stacked bugs (missing consent field, wrong payload key, unmapped section). Fixing all three.
- **Search and CTA events** are scored but never emitted, and the page categorizer still matches routes that permanently redirect. Emitting them, and scoring search-surface views as buyer intent at 3 points.
- **Email click URLs** are captured and then explicitly filtered out of the CRM timeline. Rendering them, with URL to listing-key normalization.
- **Duplicate listing JSON-LD.** Every listing page emits two `SingleFamilyResidence` and two `BreadcrumbList` nodes. Removing one emitter.
- **`CardActionBar` never renders the like control**, so the like feature is unreachable everywhere while like counts are still shown to signed-out visitors. Restoring it.
- **`robots.txt` allows Bytespider while middleware 403s it.** Making robots match middleware (block). Adding Perplexity-User, YouBot, meta-externalagent, and Amazonbot to the good-bot bypass so the geo screen stops rejecting them.
- **FSBO listings are never marked gone.** The off-market compliance guard is a permanently false branch, so a sold FSBO stays solicitable forever. Marking gone after two consecutive missed scrapes, not one, to avoid flapping on Apify failures.

## Architecture I am consolidating

- **One canonical send wrapper** covering suppression, attribution, and event recording, with the raw email function made private to it. Nine send paths currently opt in by hand and most opt out of measurement.
- **Keep CMA and BPO on Gmail** as primary transport, since a personal document should come from a person. Adding a bounce-mailbox watch so bounce suppression works, rather than moving them to Resend for observability.
- **One shared model-routing module.** Haiku for bulk classification, Sonnet for producer execution and adversarial audit, Opus for broker-facing drafting. The discipline already exists as five hardcoded constants in five files.
- **One geo page archetype** replacing four hand-maintained section lists.
- **One shared filter-builder** across public search, broker create, and broker edit. There are three different filter vocabularies today, and the richest one is only reachable from an edit dialog on a different page than every create surface.
- **Blog canonical is Supabase**, not AgentFire WordPress. Retiring the WordPress producer path. Also fixing the admin blog list, which does not select `status`, so 28 quarantined posts are invisible and unmanageable.
- **Blog to geo linking** gets a real foreign key. Today it sorts rather than filters and caps eligibility at the 24 newest posts, so unrelated posts render as "related" on city pages.
- **West Side audience** folds into the governed daily sync by passing the tag the people are already stamped with. Retiring the hand-run script that pushes live with a hand-copied suppression list.
- **Loop heartbeat table before any scheduler.** Non-negotiable ordering.

## Things I am deleting rather than maintaining

Dead listing JSON-LD component, the entire dead homepage actions file, the orphaned FSBO dashboard stack (a working SMS sender with weaker compliance guards than the live one, one import away from being re-wired), the legacy CMA delivery module with no suppression check, the semantic search route and action (no UI, no embedding pipeline, live public endpoint burning OpenAI calls), and the unregistered optimization-loop chain. Plus the stale docs that reference deleted scripts and the decommissioned CRM.

## Gates I am adding

Per this repo's own "enforcement over audits" rule, every recurring class gets a gate rather than more prose: every cron route must be registered in `vercel.json`; every allowed event type must have a producer; every page with metadata must emit an OG image; no doc may reference a script path or env var that does not exist; no exported server action may have zero importers; and a runtime AEO smoke check, since both current AEO gates only read source text and would pass a page that renders nothing.

## Product defaults

- **Hide-a-home** is a global per-user block list that also filters alerts, not a one-time dismiss.
- **Expired and FSBO** get production email sending. Everything except the guarded send action is already built.
- **Contact-less prospects** get a placeholder lead tagged `no-contact` so the address stays on a worklist instead of vanishing. Today no CRM row is created at all.
- **Expired auto-enroll stays paused.** The manual Automations toggle already covers the optional ask you made.
- **Broker links page and a scoped marketing launchpad** get unlocked for broker-role users, scoped to their own rows. Both exist and are switched off.
- **Meta qualified-lead CAPI gets turned on.** Fully wired, free, one env var, currently dry-running on every stage change.
- **AI reply drafting** gets desktop parity and auto-preloads on inbound reply. It exists today only in the mobile inbox and only on tap.
- **The broker landing view becomes the priority queue**, with KPIs and recent activity demoted. Ranking: unread inbound human reply first, then showing or appointment requests, then paused automations awaiting approval, then overdue tasks. Recent-activity-by-recency is not priority and comes out of the top slot.

## Process defaults

- **G45 producer freeze:** I am treating orchestration, infrastructure, and repairs to already-registered producers as maintenance, which the freeze permits. No new REGISTRY rows, no new content crons. If getting the ten posts that unfreeze it becomes worth doing, I will ask first.
- **Draft-first still governs everything.** Nothing I build commits or publishes client-facing content without your sign-off, including anything a scheduled loop produces.
- **Title-company West Side dataset** is treated as a frozen one-time list. I will build a staleness report against it and ask before assuming a refresh is available or worth buying.
- **Every stat that reaches a public surface** ships with a one-line verification trace, including backfilled historical reports.