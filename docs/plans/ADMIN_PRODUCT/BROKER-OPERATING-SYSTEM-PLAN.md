# Broker Operating System — plan of record

**Started:** 2026-08-12 (Grok, planning only — no product code this session)
**Status:** v0.5 plan. Not a lock. Matt adversarially reviews the prompt + this file.
**Home:** `docs/plans/ADMIN_PRODUCT/` (G44 covered by the ADMIN_PRODUCT package row)
**Jobs vs mechanics:** IA destinations and KEEP jobs still name the work. How we
currently do them is not sacred. See §Implementation amnesia.

This is the plan behind the broker OS prompt: copilot, known-seller streams,
buyer/newsletter, Closings/forms, public site, acquisition/truth, GBP + a
self-running social calendar, a broker home that looks finished, and a
designer's bar on everything we send.

---

## Implementation amnesia (Matt 2026-08-12 — outranks "we already have it")

Existing code and existing process **must not** keep us from the right thing.
The bar is efficient, smart, streamlined — a new broker plugs in and works.
If the current path is slower, dumber, or clunkier than the north star, it
goes, even if it is shipped, gated, or "dialed in."

- **Loyal to the job, not the machine.** "Respond to inbound," "value this
  home," "paper the deal," "curate the newsletter" stay. The current route,
  table, cron, template, and PDS *how* are a quarry.
- **Quarry, not museum.** Steal a chokepoint that is already right
  (suppression fail-closed, §0 numbers, draft-first, ESIGN seal). Cut
  everything that exists only because we built it.
- **"We already have X" is not a veto.** It is evidence. If X already *is*
  the simple machine, keep it. If X makes the broker tap twice, keep a
  fourth inbox, send a generic brochure, or hide the homes they browsed
  behind a panel nobody opens, replace it.
- **Still inviolable (not "existing code" — law and license):** draft-first
  to real people, suppression fail-closed, no invented numbers, no
  prior-agent blame, OREF blanks stay licensed, SkySlope is not the SoR.
- **Process/IA locks named the jobs and destinations.** They did not freeze
  the implementation. Design amnesia already said this for chrome. It now
  applies to workflows, data joins, and "don't rebuild" advice in v0.

---

## 0. Adversarial audit of the brief (before Matt audits the prompt)

The stacked prompts describe a whole brokerage OS. That is the right ambition.
It is the wrong shape for one agent session unless we sequence it. Findings:

| # | Attack | Why it matters | Disposition |
|---|---|---|---|
| A1 | **Prompt obesity.** Four iterations concatenated. An executing agent will skip the middle. | Constitution must fit one screen. Method lives here. | Split: short prompt → this file |
| A2 | **Four loops, one week.** Copilot + Closings + expired/FSBO + buyer/newsletter is a quarter, not a grind tick. | Sequence or nothing ships. | P1 = copilot queue + one seller packet + one buyer signal. Forms after. |
| A3 | **"Send them a CMA" for a buyer looking at a home.** Locked engine: CMA = sellers, BPO = buyers/offer, expired-audit = expired. A seller CMA on a listing a buyer is touring is the wrong artifact. | Silent override would fork the product. | **Matt decision D1** |
| A4 | **Newsletter is not the only buyer door.** Saved search, guest alerts, portal, listing inquiry, call/text, Meta already create buyer people. Building only newsletter orphans hotter signals. | Honor newsletter as the named capture. Do not delete the others. | Newsletter = curated edition + capture. Saved-search/portal = behavior SoR. Copilot reads both. |
| A5 | **Behavior events exist; the product does not.** `visitor_events` already records listing_view / search / scroll / click / save. A contact panel can summarize them. That is quarry, not the copilot loop. If the join, the FUB-id leftover, or the panel-nobody-opens is why Matt cannot say "who is looking at what" in one sentence, replace the machine. | "Already tracked" is not "already useful." | Keep event facts if they are true. Rebuild the product surface (queue sentence, identity stitch, one-yes send) without loyalty to the current panel or join. |
| A6 | **"Every scroll" will drown Today or feel like surveillance.** Matt's wake-ups are inbound-human (valuation, new lead, reply-on-thread). Hot-visitor was MERGE→broker-alert and was NOT in the wake list. | Unranked pings make the copilot unusable. | Rank: reply > looking-at-a-home (identified, repeated) > newsletter signup. Digest the rest. Honor GPC. |
| A7 | **"Blow them away" / "designer's eye" is untestable.** Brand-voice gates banned words, not beauty. | Taste arguments will stall every packet. | Deliverable litmus: named exemplars (Tumalo CMA, approved newsletter shell, list-kit). If it is not in that league, it does not send. |
| A8 | **Expired "how we will market THIS home" is not the generic services list.** `lib/cma/expired-audit.ts` layer 2 mirrors `/sell` "what every listing gets." List-kit is the real marketing machine. | C2 fails today by construction. | First packet = know-this-home (engine already has site intel) + this-home marketing plan (list-kit / sell plan, not a brochure). |
| A9 | **TC "use soon" vs zero production envelopes.** July 2026 audit: `tc_envelopes` 0, `tc_principal_reviews` 0, no UI to create a deal, `/admin/deals` list reads stale SkySlope snapshot. Foundation is real. Daily use is not. | More schema is not the bottleneck. | First Closings slice: create-deal in UI + one licensed form fill/send/file to a Matt-owned email. Re-count live before building. |
| A10 | **"Parallel" is undefined.** Could be TC_SYSTEM.md Phase 4 dual-file or a second vendor. | Wrong baseline. | **Matt decision D2** |
| A11 | **Speed vs beauty is not a conflict.** Litmus is kickoff speed (≤3 taps / ≤30s). Beauty is the artifact, draft-first. | Mixing them produces either slow kickoff or ugly PDFs. | Keep both. Copilot is fast. Packets are curated. |
| A12 | **Identity hole.** Behavior joins `visitor_sessions` via `crm_person_id` / `fub_person_id` / email / `rr_vid`. A newsletter subscribe that never identifies the browser leaves browse history anonymous. | Loop D fails without stitch. | Newsletter signup must identify the session the same way seller LP + saved-search already do. |
| A13 | **Worth-language vs SEO.** On-page CTA lock is "Value my home" / "Get my home's value." Search demand still uses "home worth." | Blunt rewrite of `<title>` can lose rankings. | CTA/headline/SMS = Value my home. Title/meta may keep demand language; call that out, do not silently smash SEO. |
| A14 | **Assigned broker.** Copilot and visitor-escalate still smell Matt-only. Q4 lock: own book default, Matt sees all. | New-broker onboard fails if every ping is Matt's. | Route by `assigned_broker`. |
| A15 | **A third public rebuild would kill the giant push.** Public Product OS is already at P9_ROLL: process/IA/visual locked 2026-08-11, v3 barrel shipped, `/housing-market` on v3, ratchet live. `experience-rollout` is superseded. | Starting "frontend UI wrap-up" as a new program repeats the last death (self-reported dones, competing destinations). | Loop E = grind that OS to zero legacy pages, then a standing refine forever. Do not invent OS #3. |
| A16 | **Two sessions, one north star.** Public grind and broker-OS grind can run in parallel if they do not share files. | Mixed commits (11F inbox vs public v3 vs this plan) strand work. | Public session owns `app/` public routes + `components/site/v3` + `docs/plans/PUBLIC_PRODUCT/`. Broker session owns admin + packets + TC + this file. Voice/beauty/valuation language is shared law. |
| A17 | **Ads now would fork the site.** Demand loop and LPs exist. Matt: do not spend a lot of time on ads right now. | A paid-creative grind will reopen old LPs and skip the spines. | Park ads. When they return, they hit Value my home / listing / newsletter — no new funnel. |
| A18 | **"Dialed" without a scoreboard is a slogan.** GSC ingest, site_signal, ci:ai-crawler-access, ci:ai-structured-data already exist. | Rebuilding analytics is bloat; leaving them unread is the real hole. | Giant review: every page/process scored on funnel + GSC/AI query tests. Steal working ingest. Replace dashboards nobody uses. |
| A19 | **The other process is already grinding Loop E.** Public Product OS is in-flight on this working tree (Places/Market family `_v3/` modules, migration-recipe, gate repairs). `state.json` / `work-queue.json` are stale (still say first Market attempt reverted). | Starting E1 here, polishing KB, or `git add -A` will strand or smash that session. | Loop E is owned by that session. Broker OS does not migrate public families. Trust git + uncommitted progress, not the stale queue. |
| A20 | **GBP + organic social were missing from v0.3.** Process exists (`content-approve` → approval-queue → `publisher-sweep` → `/api/social/publish`, plus local-seo / GBP playbook). Last census (2026-08-08): GBP/LI/X/YT OAuth expired; measured=0; ready backlog ~397 mostly not posts. | "Easy generate and post" is a product job, not a new stack. Paid ads stay parked. | Loop G. Production-ready = tokens live + one generate door + one yes + actually posts. Re-probe tokens before G1. |
| A21 | **"Automatically post on all channels" vs draft-first.** Silence is not approval. A first post that the broker never saw is a license and brand hole. | Fully silent posting would violate the inviolable list. | Calendar auto-builds. Copilot asks. Broker yes (week grant or per-item). Then it posts, times, and learns by itself. **D7**. |
| A22 | **"Optimal from what performs" cannot learn while measured=0.** `getFormatPerformance` already returns `best_hours` / `best_topics` / per-platform uplift from `content_performance`. Six rows, no status flip. | Building a new optimizer on empty data is theater. | Fix CAP-015 so the existing bias actually fires. Then the calendar uses it. |
| A23 | **Auth is brand-level, not per-broker.** One GBP row, one Meta page token. Paul/Rebecca cannot "enter their credentials" today. | New-broker onboard fails if only Matt's Google login works. | Settings: per-broker OAuth (`broker_id` on the auth row). GBP stays the brokerage profile (principal). **D8**. |
| A24 | **"Broker dashboard" as destination 12.** IA already locked 11 jobs. Today = what to do; Closings = deals; Reports = numbers; Settings = modify; Content = publish. A 12th home repeats the 160-route problem. | A new dashboard OS would fight the lock and the public session. | The broker home **is Today**, with four lanes (do / socials / deals / modify). Do not add a nav word. |
| A25 | **"Super awesome" vs locked ADMIN_UI.** Admin is a calm instrument (queues over dashboards; public navy/Amboqia blacklisted). Outbound posts and packets are the marketing surface. | Painting admin like the public site reopens P6. | Outbound must blow them away. Admin must look *finished* inside ADMIN_UI (no leftover islands, every screen leads with the next action). Reopen visual lock only if Matt says the instrument itself is wrong. |
| A26 | **Identical cross-post is not "optimized per channel."** Platform skills already ban watermarked/cross-posted Reels. "All channels" is not Threads/Nextdoor/Pinterest (parked) and not the same caption everywhere. | Spray-and-pray would tank reach and look cheap. | One idea → per-channel variants (length, format, hook). D6 still limits which channels are live. |

**Verdict:** The brief is right. The failure mode is either boiling the ocean
**or** protecting yesterday's code. Sequence the loops. Keep only the machines
that already *are* the simple path. Cut the rest.

---

## 1. North star (Matt, 2026-08-12 — do not drift)

### Loop A — Copilot (daily, phone)

"Tell me everyone I need to respond to." → Grok names the person, what they wrote or did, the one next action, the draft. Matt says yes. Grok does it. CRM records it.

### Loop B — Closings (soon-use)

SkySlope is the live file and the baseline (browser + API, read-only unless Matt names a mutation). In-house already has anticipate / envelope / seal / commissions / form blanks. Refine until a broker can pick a licensed form, fill it from the deal, send it, and file it. Easier than SkySlope. Brokers never build forms. New broker: access → own book → ground running.

### Loop C — Known sellers (weekly, guaranteed stream)

Expired and FSBO are people we know are selling. First **message** and first **deliverable** must blow them away: prove we know everything about **this** home, and show how we will **market this** home. Manual first touch. Never blame the prior agent. Never invent numbers.

### Loop D — Buyers (newsletter + site behavior)

Buyer leads come in when people sign up for the newsletter (named door). Newsletter is its own curated process — designer's eye, nothing ships that does not blow them away. In the back we see exactly what they looked at: homes, searches created, browse, scroll, clicks, learned-more. Copilot: "So-and-so is looking at this home." Matt: send a packet, or ask if they want one. Easy.

### Loop E — Public site (the face, then forever refine)

The public pages are the same product. They are how buyers browse, how sellers tap **Value my home** / **Get my home's value**, how newsletter and alerts come back, how the copilot knows which home they were on.

**Wrap the new UI once, then never stop improving.** That machine already exists: Public Product OS (`docs/plans/PUBLIC_PRODUCT/`), phase `P9_ROLL`, visual language locked (six v3 patterns), first family shipped (`/housing-market`). The giant incremental push is not a new redesign. It is grinding that roll until every public page is on `components/site/v3`, then a standing refine loop on the whole site forever.

Implementation amnesia applies: locked destinations (Homes, Places, Market, Sell, Saved, About) name the jobs. A page that is on v3 and still clunky gets refined, not protected. A page still on KB/legacy gets migrated, not polished in the old register.

### Loop F — Acquisition and truth (SEO, GSC, analytics, AI, every tool)

Every process and every page is also a funnel question: **how does this drive someone in?** Seller → Value my home. Buyer → newsletter / saved search / the home they were already looking at. AI and Google are the same job as a human landing: they must find the honest page that answers the question.

**Dialed means measured, not claimed:**
- SEO: indexable, canonical, JSON-LD, internal graph, no thin duplicates (cut-list + 301s)
- Analytics: first-party trail + GA4/site_signal actually used to change a page
- Google Search Console: daily snapshot ingest (`measure-search-traffic-gsc`) is the scoreboard; slipping queries get a class fix
- Every tool (mortgage/appreciation/etc.): live, §0-honest, linked from the page that needs it — not a junk drawer
- Every page: dual objectives + exits + beauty bar
- Whole system: one generation of code. Historical registers (KB, v2, FUB-as-CRM, SkySlope-as-SoR, "what's my home worth" CTAs) get deleted as the new path ships — that is versioning.

**Ads:** do not spend a lot of time now. Demand / Meta stays parked. When it comes back, it lands on the same spines (valuation, listing, newsletter) — it does not get its own site.

**LLM delivery (already a process, now an acceptance test):**
`earn-search-traffic` + `/llms.txt` + open AI robots + JSON-LD (G34/G39) are how ChatGPT, Claude, Grok, Perplexity, and AI Overviews find us. The giant review asks, for real queries:

- "Show me the best broker in Bend"
- "I need a 3-bedroom, 2-bath in Northwest Crossing"
- "Get my home's value in Bend" (never the worth-question)

If the assistant cannot cite a Ryan Realty page that actually answers that, the page, the schema, or `llms.txt` is wrong. Fix the class. Do not build a parallel "AI site."

### Loop G — Presence (GBP + a self-running social calendar)

Google Business Profile is first-class. Organic social is first-class. Neither is a footnote of SEO, and neither is paid ads (those stay parked).

**The broker does not make the content.** The system does. A new broker (Paul, Rebecca, anyone) connects their accounts once. Copilot says: **"Hey Paul, do you want me to set up some ideas for your social media?"** They look at a week on a calendar, say yes. After that it posts on the live channels, in the format each channel actually rewards, at the hours that have been working, and it tracks what happened so the next week is smarter. Traction moves the next slot. Work is gone.

That is Loop A applied to presence: recommend → yes → do it → record. Draft-first still binds: the first yes is on the *calendar* (or the standing week-grant). It does not invent a silent publisher.

Per channel means **variants**, not one caption sprayed. Instagram is not LinkedIn is not a GBP local post. Parked platforms stay parked.

Two GBP jobs, one loop:

1. **Local pack** — NAP, categories, services, photos, reviews, Q&A, citations. Map Pack for "real estate agent Bend" is often worth more than a Page 1 organic rank. Runbook: `.claude/skills/local-seo/SKILL.md`. Why: `marketing_brain_skills/platforms/gbp/SKILL.md`.
2. **Posts** — same generate → approve → publish path as IG/FB, on a calendar, timed from `content_performance`. `publishGoogleBusinessLocalPost` is already a platform on `/api/social/publish`.

**The broker home (not a 12th destination).** Today is the dashboard. Four lanes, own-book scoped, Matt sees all:

- **What they can do** — the copilot queue (inbound, looking-at, calendar yes, CMA-ready).
- **How their socials are doing** — live channels, last posts, what worked, next scheduled. Numbers that change the next action, not a vanity wall.
- **What their deals are** — Closings for their book, one tap into the file.
- **Anything they can modify** — connect/disconnect socials, pause the calendar, voice/kill a draft. Settings is the door; Today shows the state.

Loop F still scores "how does this drive someone in" (including map-pack queries). Loop G owns the operating machine so presence does not die in a reconnect checklist.

### Voice lock — valuation

Never: "What's my home worth?" / "What is your home worth?"
Always: **Value my home** or **Get my home's value** (Get your home's value when addressing them).

### Beauty lock

Everything we deliver is curated. Designer's eye. If it would not make them want to see what we are about, it does not go out.

Two surfaces, one bar, different languages (already locked — do not mix them):

- **Outbound** (posts, packets, newsletter, list-kit): blow them away. Tumalo kit is the named exemplar.
- **Admin / broker home:** a finished instrument (`design_system/admin/ADMIN_UI.md`). Every screen leads with the next action. No leftover islands. Not a marketing page. If the instrument itself is ugly, fix it inside the lock — or Matt reopens P6.

---

## 2. Quarry — steal what's right, cut what isn't

Inventory of current machines. **Not a freeze list.** Each row is kept only
if it already is the efficient path for that job. If it is in the way, it
is the thing we replace.

| Piece | Where | Use it for |
|---|---|---|
| Today / inbound triage | `getInboundTriage`, `getBrokerActionQueue` | Copilot queue substrate |
| Suggested reply | `lib/crm/reply-intent.ts`, email twin | "Here's what I think you should do" |
| Governed send | `lib/comms/guards.ts`, `sendGovernedSms.ts` | Execute after yes |
| Broker SMS agent | `lib/agent/*` | Runtime to reuse — different job (broker→agent) |
| Behavior events | `app/api/visitors/track/route.ts` | listing_view, search, scroll_depth, cta_click, save_listing |
| Behavior summary | `getContactBehaviorSummary`, `ContactBehaviorPanel` | "Homes they looked at / searches they ran" |
| Timeline merge | `app/actions/crm.ts` visitor_events → person timeline | Dwell + scroll already on the contact |
| Newsletter engine | `newsletter-run` PDS, `lib/newsletter/produce-draft.ts` | Curate → draft → approve → drain. Healthiest admin engine. |
| Saved search / alerts | `listing-alert-care`, `save-and-return.*` | Other buyer doors + return loop |
| Portal | `save-and-return.portal` | Saved homes, alerts, viewing trail bound to identity |
| CMA / expired-audit / BPO | `lib/cma/build.ts`, `expired-audit.ts`, county/site intel | Know-this-home engine |
| List-kit | `social_media_skills/list-kit/SKILL.md` | How we actually market a listing — generate half of Loop G |
| Content-approve | `docs/plans/ADMIN_PRODUCT/processes/content-approve.md` | Draft → stamp → publish law. KEEP. Two queues today. |
| Approval queue | `/admin/approval-queue` (+ `/admin/crm/approvals`) | Human yes. IA says this lands on Today. Phone-first is the gap. |
| Publisher | `publisher-sweep` → `/api/social/publish` | Execute after yes. `humanApprovedAt` ≤ 7 days. GBP is a platform. |
| GBP client | `lib/google-business-profile.ts` | Local posts + token refresh. Dead until Matt reconnects OAuth. |
| Local SEO | `.claude/skills/local-seo/SKILL.md` | Map-pack audit → drafts through the same approval pipeline |
| GBP metrics | `marketing_channel_daily` channel=`gbp` | Scoreboard once the token is live |
| Social parks | `docs/plans/ENTERPRISE_MAP/matrix/SOCIAL-PARKS.md` | RECONNECT vs PARK. Do not invent Threads/Nextdoor/Pinterest work. |
| Content calendar skill | `social_media_skills/content/content-calendar.md` | Mix + cadence quarry. Door is wrong (Sheets / FUB / April 2026 doc). Keep pillars, replace the how. |
| Format performance | `getFormatPerformance` in `lib/marketing-brain/generate-briefs.ts` | Per-platform uplift, `best_hours`, `best_topics`. Starved by measured=0. |
| Measurement loop | `lib/marketing-brain/measurement-loop.ts` | 48h/7d/30d pulls + winners digest. CAP-015 must actually flip `measured`. |
| Platform specs | `social_media_skills/platform-best-practices/SKILL.md` | Per-channel variants. Bans identical cross-post. |
| Admin visual | `design_system/admin/ADMIN_UI.md` | Broker home language. Queues over dashboards. |
| Own-book scope | `crm_people.assigned_broker` (Q4) | Paul/Rebecca see their book. Matt sees all. |
| Prospecting worklist | `/admin/prospecting`, first-touch templates | Expired/FSBO stream machine |
| TC foundation | `tc_*`, envelope engine, `/admin/forms`, ingest | Closings — unused in production |
| SkySlope | Files API + Forms library API + Chrome session | Baseline + form blanks |
| Value my home lock | PUBLIC_SITE_UX_OVERHAUL + PUBLIC_PRODUCT decisions | CTA language — still violated in live copy |
| GPC / suppression | `lib/crm/gpc.ts`, `lib/comms/guards.ts` | Fail-closed on watch + send |

---

## 3. Gaps vs the brief (the real work)

### Copilot (A)

- Reply-on-thread is **locked** to the wake rail and still only cell-forwards (`inbound-respond` §5.7).
- No single ranked queue that speaks in Matt's sentence: everyone to respond to, plus "looking at this home."
- Suggested reply exists; "yes → Grok sends" does not (broker still taps send in admin).
- Visitor-hot is a fourth notification path, Matt-hardcoded, not assigned-broker.

### Known sellers (C)

- Detection → skip-trace → doc queue → worklist **works**.
- First-touch template is a compliant intro, not a blow-away.
- Expired-audit **knows** the house (history, comps, GIS) but **markets** with a generic services list.
- FSBO uses a CMA, not a tailored "you're selling it yourself; here is the market + how we would sell it" packet.
- Worth-question language still lives on sell/valuation surfaces.

### Buyers (D)

- Newsletter subscribe + curated draft engine **exist**. Beauty bar is not gated.
- Behavior exists on identified people. Newsletter-only email with no session identify = blind.
- Copilot does not yet say "they're looking at 123 Main" with a one-yes send/ask.
- Buyer packet on a specific home is unspecified (CMA vs BPO — D1).
- Listing alerts + portal are stronger *behavior* doors than newsletter; newsletter is the named *capture* door. Must join, not compete.

### Closings (B)

- Cannot create a deal in the UI (script-fed).
- Dashboard list ≠ `tc_deals`.
- Form libraries ingested (~111 versions, July audit) but template→fill→send is not a daily path.
- Zero production envelopes. CRM person ↔ tc_deal still unbridged.
- SkySlope remains the working file.

### Beauty

- No deliverable litmus. Voice gates ≠ design gates.
- Two visual languages (public vs admin v2). Outbound packets need a third: print/email craft, with named exemplars.

### Presence (G)

- Pipeline is real. Production is not. Last live census 2026-08-08 (re-probe before G1): GBP / LinkedIn / YouTube / X **EXPIRED**; TikTok was valid only until 2026-08-09; Threads / Nextdoor / Pinterest **PARKED**. Meta page tokens exist (INT-007 amber) — ads parked, organic IG/FB still in scope.
- Generate is chat/skill (`run the brain`, `direct produce`, list-kit), not a one-tap admin door. Content destination is "rare" and is blog/guides/library, not "make a post."
- There is no broker-facing **calendar**. `content-calendar.md` still points at Google Sheets, an April 2026 Word doc, and FUB. Mix ratios are quarry; the door is not.
- Approve is two queues, desktop-shaped, ~397 `ready` rows that are mostly CMA/ops not posts. Phone yes (Q3 must-have) is the same gap as Loop A. No "Hey Paul, want me to set up some ideas?" sentence.
- Publish can fail silently (row stays `approved`). Measurement class is `measured=0` (CAP-015) — executed rows lack the identity the loop expects. `best_hours` / `best_topics` exist in code and have nothing true to read.
- Auth is one brand login. Paul cannot paste Instagram credentials into Settings and have the calendar post as Paul.
- GBP health cron / digest / photo pipeline are useless until OAuth is live. Name-stuffing the GBP title is a suspension trigger — never.
- List-kit already is the listing-launch generate path (video + flyers + carousel + single). It is not wired as a calendar slot a new broker can run.
- Today does not show social health or deals as lanes. The 11 destinations name the jobs; the home does not yet *feel* like a brokerage cockpit.

Until tokens are live, do not build a second publisher. Reconnect is the account owner (Matt for brand GBP; each broker for their own IG/LI). Agents prepare the checklist only.

---

## 4. Open decisions (Matt)

**D1 — Buyer looking at a home: what do we send?**
- (a) BPO / offer-strategy packet (locked engine meaning)
- (b) A buyer-facing CMA on that listing (Matt's words)
- (c) Ask first ("want us to send a value packet on 123 Main?") then (a) or (b)

**D2 — What is "Parallel"?** Phase 4 dual-file with in-house TC, or a second vendor?

**D3 — Is "looking at this home" a wake-up SMS, or only a Today/copilot line?** Q1 wake-ups were inbound-human. Recommend: copilot/Today only unless they repeat-view or reply. Confirm.

**D4 — Newsletter vs saved-search as primary buyer capture.** Matt named newsletter. Recommend: newsletter captures; saved-search/portal is the behavior graph; one person record.

**D5 — Worth-language in SEO titles.** Keep demand phrasing in `<title>`/meta only?

**D6 — Production-ready social set.** Recommend: GBP + Instagram + Facebook first (daily presence). Then reconnect LinkedIn / YouTube / X. TikTok if the token is still alive. Threads / Nextdoor / Pinterest stay parked. Confirm.

**D7 — Calendar yes: per-post, or a standing week-grant?** Recommend: first week is per-item (they see every draft). After that, "run my calendar" is a 7-day stamp — same freshness as `humanApprovedAt`. Kill and pause always work. Never a forever autopilot.

**D8 — Brand accounts vs per-broker accounts.** Recommend: GBP + brokerage IG/FB are Ryan Realty (principal / Matt). Each broker connects their own IG / Facebook / LinkedIn in Settings. One idea can fan out to brand and to the broker, as **variants**, never the same file twice.

Until D1–D3 are answered, build the queue + stitch + ask-first path. Do not auto-send a buyer CMA.
Until D6 is answered, G1 is GBP + one Meta surface, not every platform.
Until D7 is answered, G3 is per-item yes on a week of drafts — no standing grant.

---

## 5. Four questions (every process)

Score each locked process 1–5 **on the job, not on the current code**:

1. **Best** — would we still do it this way for A–D if we were starting tomorrow?
2. **Simple** — fewest steps, stores, taps
3. **Clear** — one sentence a new broker understands
4. **E2E** — inception reaches a CRM (and deal-file) artifact

If the *job* scores high and the *current how* scores low, the finding is
**replace the how**, not "keep it, we already built it."

Plus: **Improve** / **Inform** (more information only if it changes the action).
Plus: **Funnel** — how does this page or process drive a buyer or seller in?
If it does not, it is a candidate to cut or merge.

Loop C extra: Know / Market / Message / Voice / True / Stream.
Loop B extra: Libraries / Anticipate / Fill / Send / File / Onboard.
Loop D extra: Capture (newsletter) / Identify (session stitch) / See (every home) / Recommend / Packet beauty.
Loop G extra: Generate (calendar) / Variant (per channel) / Approve (one yes) / Post (timed) / Learn (measured) / Local pack (GBP) / Home (Today: do / socials / deals / modify).

---

## 6. Ranked plan

### P0 — do not ship broken

- Suppression / unapproved send / invented numbers in a packet
- Inbound SMS/email not on `crm_timeline`
- GPC honored on watch + send
- No "what's my home worth" on a seller **CTA we would tap** (inventory first)
- No social post without a fresh stamp (calendar grant counts; silence does not)

### P1 — first complete loops (this is "start using it")

1. **Copilot queue (A):** one ranked Today list: unreplied inbound + "looking at {address}" (identified, ranked) + CMA-ready + parked sequence. Sentence form. Assigned-broker scoped.
2. **Yes-path for one SMS reply:** preload draft → Matt yes → `sendGovernedSms` → timeline. Do not build a new agent stack; reuse composer + reply-intent.
3. **Seller first packet (C):** one expired (or FSBO) message + deliverable that (a) proves we know the house using existing site intel, (b) shows how we would market **this** house (list-kit / sell plan, not generic services). Still manual send.
4. **Buyer see-back (D):** newsletter signup identifies the session; person shows homes/searches/scrolls; copilot can say "looking at {address}" and offer ask-or-send (blocked on D1).
5. **Worth-copy inventory** (list path:line; public CTA rewrite is PUBLIC_PRODUCT, not this file's code).
6. **Presence (G):** Matt reconnects brand GBP (and IG/FB if needed). One generate door that produces a real draft. One yes on Today. `publisher-sweep` posts it. A live GBP post or IG/FB post exists that we can open. Not a new brain.

### P2 — make it a brokerage, not a demo

- CRM person ↔ `tc_deal` link; create-deal from UI; `/admin/deals` reads `tc_*`
- One OREF fill → send to Matt-owned email → seal → checklist (Loop B)
- Reply-on-thread joins the wake rail (already locked)
- Newsletter beauty pass against the approved shell; nothing auto-sends unreviewed
- Assigned-broker on visitor/copilot pings
- Dual-intent people (buyer newsletter + expired owner) stay one person
- One approval surface (Today), not `/admin/approval-queue` vs `/admin/crm/approvals`
- List-kit → approve → post is the listing-launch path a new broker can run
- GBP local-pack: NAP exact, review replies in Matt's voice, posts 2–3/week through the same queue
- **Calendar:** one week of per-channel drafts → copilot ask → yes → timed posts. Measurement writes. Next week uses `best_hours` / winning formats.
- **Per-broker OAuth** in Settings. Paul/Rebecca connect; calendar can post as them.
- **Today as broker home:** do / socials / deals / modify. Own book. Looks finished inside ADMIN_UI.

### P3 — strip bloat

- Generic "what every listing gets" as the hero of an expired audit
- CRM kanban vs TC vs SkySlope snapshot as three "deals"
- Cell-forward as a fourth inbox
- Visitor-escalate as a separate email rail
- A second event log that duplicates facts we already capture truthfully
- SkySlope archive/folder clunk
- Any shipped path that exists only because it shipped
- A second social publisher, Buffer-as-SoR, or "just post from chat" that bypasses `humanApprovedAt`
- Threads / Nextdoor / Pinterest connect work while GBP cannot post
- Treating the ~397 `ready` CMA/ops rows as a social backlog
- A 12th "Broker Dashboard" destination
- Google Sheets / FUB as the content calendar
- Identical cross-posts dressed up as "optimized"

### P4 — later

- Dark mode unreachable, FUB vocab ratchet, reporting collapse, full SkySlope cutover after one clean parallel deal

---

## 7. First build slices (smallest complete)

| Slice | Done when | Blocked on |
|---|---|---|
| **A1** Copilot queue sentence | Matt can ask "who do I respond to" and the list is true (inbound + looking-at + ready docs) | None for a read-only prototype; write path needs composer reuse |
| **A2** Yes → send one SMS | Timeline `sms_out`, suppression held, sequence paused | Matt yes on that send |
| **C1** One expired blow-away packet | Message + PDF on a real expired in-scope listing, manual send, no generic services hero | Matt review of packet |
| **D1** Newsletter identity + home list | Subscribe in a browser that browsed listings → person shows those homes | Confirm subscribe identify path |
| **E1** Public giant push | Dedicated session: `run public product` until P9 legacy pages → 0 | **Already in flight.** Do not start a second E1. See §7b live status. |
| **F1** AI/GSC query battery | Those three example queries (and live GSC top queries) resolve to a citable Ryan Realty URL via Google and via `/llms.txt` + JSON-LD | Public session; ads still parked |
| **G1** GBP live again | Matt reconnects OAuth. One approved GBP post (or photo batch) is visible on the live profile. Health cron reads. | Matt OAuth. Re-probe `google_business_profile_auth` first. |
| **G2** Easy generate → post | Name a listing (or "GBP market update") → draft on Today → yes → live IG/FB or GBP. Same `humanApprovedAt` gate. | G1 tokens. Do not bypass the queue. |
| **G3** One week on a calendar | Copilot: "Hey Paul, want me to set up some ideas?" Week of per-channel drafts on Today. Yes → posts at `best_hours` (or a documented default until data exists). | G2. D7 default = per-item until standing grant. |
| **G4** Broker connects own socials | Paul/Rebecca (or a new broker) OAuth from Settings. Calendar can post to *their* IG/LI. Own-book Today shows their social lane. | D8. Do not stuff personal tokens into the brand GBP row. |

Do not start B1 until A1/C1/D1 are specified with evidence. Closings is "soon," not "before the copilot can talk."
G1 can run the day Matt reconnects — it does not wait for A1. G2 shares Today's yes-path with A2; do not build a third approve button.
G3 is the north star slice; it is not the first slice. Tokens and one live post come first or the calendar is a slideshow.

---

## 7b. Giant incremental push — how to run Loop E (Matt 2026-08-12)

This is the operating model so "do the whole frontend" does not become a third program.

**What "wrap up the new UI" means, honestly:** the new UI is already locked
(`design_system/public/PUBLIC_UI.md`, `components/site/v3/`). Wrapping up =
every public route renders in that language. That is P9. After P9, you do not
design a new UI. You refine inside it (or reopen the visual lock if the
language itself is wrong — amnesia allows that; a new OS does not).

**The giant push, now:**

1. Open a **dedicated** session. First line: `run public product` (or
   `continue public OS`). That loads `.claude/skills/public-product-os/SKILL.md`
   and `docs/plans/PUBLIC_PRODUCT/SESSION_BOOT.md`.
2. Orient from disk. Trust git + the bottom of `progress.txt`, then `state.json.phase`
   (today: `P9_ROLL`). Print the top `work-queue.json` id **and verify it against
   disk** — as of 2026-08-12 the queue still names the reverted Market attempt
   and a chrome unit that already shipped. Do not obey a stale next-id.
3. **One family per unit, ratchet must shrink, one commit, push, deploy
   READY, browser 390 + 1280.** Gate contracts for that route move in the
   **same** change (the lesson that reverted the first Market attempt).
4. **Leverage order (verify queue vs disk each session):** chrome unit
   unblocks the most pages (KB chrome was most of the ratchet). Then Market
   remainder → Places → Homes/listing → Sell + valuation spine → About/trust
   → residual. Listing detail is the money page — extra care, every CTA and
   JSON-LD stays. LPs last, noindex, explicit approval.
5. Keep grinding until `ci:public-ui` legacy pages → 0 and P9 DoD is met.
   Then P10 (remaining gates). Then stop calling it a rollout.

**Forever refine (after the wrap):**

Every later session that touches a public page runs the same four questions
(best / simple / clear / e2e) plus beauty plus dual objectives (visitor +
machine + exits) plus **funnel** (how does this drive someone in) plus the
AI/GSC query tests in Loop F. One defect class or one family per unit.
Measure completed valuations week over week, not vibes. Never open
"Public Product OS 2."

**Parallelism:** a second session may grind broker OS (A–D + G) at the same time.
Do not mix commits. Public session does not edit `app/admin`. Broker session
does not migrate public families or touch in-flight `_v3/` work. Shared law:
voice, Value my home, beauty bar, visitor identity stitch.

### Versioning (one generation, then increment)

Versioning here is not a new numbering scheme for its own sake. It is:

1. **Name the generation we are on** — public v3, admin v2, CMA engine, TC vault — and stop shipping into the previous register.
2. **Delete historical code as the new path lands** — KB/legacy imports, dual deal stores, FUB vocabulary, dead LPs that cannibalize, worth-question CTAs. The ratchet (`ci:public-ui`, `ci:admin-ui`) is the version gate.
3. **Keep methodology versions for numbers** (`cache_methodology_definitions`) so a figure stays auditable. That is data versioning, not UI nostalgia.
4. **After the wrap, every refine is a version bump of the same system** — one family or one defect class, measured, never a parallel stack.

If a file exists only to support the old generation, it is holding us back. Cut it in the same commit that finishes the new path.

**What you say to start the giant push:**

```
run public product. Grind P9 until every public family is on v3. One family
per commit, ratchet shrinks, gate contracts move in the same change, browser
390 and 1280, deploy READY. Chrome leverage first if the queue still says
so — verify disk. Implementation amnesia: do not polish KB/legacy; migrate
or cut. Beauty bar: if it would not make them want to see what we're about,
it is not done. On every page: how does this drive someone into the funnel.
SEO/JSON-LD/llms.txt stay honest so an LLM asked for the best broker in Bend
or a 3-bed in Northwest Crossing can cite us. Ads parked. Stop only for a
Matt lock, empty P9 queue, or a real blocker. When P9 is empty, do P10, then
the standing refine loop in
docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md Loops E and F.
```

### Live status of the other process (2026-08-12 — do not fight it)

This is how Loop E streamlines instead of forking.

**On `origin/main` (trust this over `state.json`):**
- Phase is `P9_ROLL`. Process / IA / visual locked 2026-08-11.
- `/housing-market` shipped on v3 (`b076e15b`). Chrome primitives are in the barrel. `ci:public-ui` ratchet is live.
- `experience-rollout` is superseded. `PUBLIC_SITE_UX_OVERHAUL/` is evidence, not authority.

**Stale on disk (do not obey):**
- `docs/plans/PUBLIC_PRODUCT/state.json` still describes the *reverted* first Market attempt and names `p9-market-family-v2` as next.
- `work-queue.json` still has only `p9-market-family-v2` and `p9-chrome-unit`. Chrome already shipped with `/housing-market`.

**In flight on this working tree (another session, uncommitted):**
- Places + rest-of-Market family: cities, neighborhoods, communities, zip, subdivisions, oregon city, pulse, months-of-supply, annual-review, central-oregon — page files modified, `_v3/` modules untracked.
- `docs/plans/PUBLIC_PRODUCT/migration-recipe.md` staged — the executable procedure distilled from `b076e15b`. That is the streamline: broker OS does not rewrite it.
- Gate repairs in the same change (months-of-supply one formatter, alert-capture disclosure, subdivision year clamp). Correctness, not a new visual language.
- Sell spine / `app/dev/sell-film/` / `design_system/public-v2/` untracked. Also new files under `PUBLIC_SITE_UX_OVERHAUL/` — constitution says that folder is demoted. Do not join it. Do not `git add -A`.

**What this means for broker OS:**
- E1 is already being executed. A broker session that migrates a public family, edits `components/site/v3`, or "wraps the UI" is the third program A15 warned about.
- Shared law only: voice, **Value my home**, beauty, visitor identity stitch, dual objectives + funnel.
- Worth-copy inventory (P1.5) is a *list* from this plan. The public session owns the CTA rewrite.
- When that session lands a family, Loop E's forever-refine and Loop F's query tests apply. Not before, and not by stealing the dirty files.

**Parallelism that is actually safe:** A–D and G on admin / packets / TC / social tokens. E on public routes. Two sessions, disjoint paths, no mixed commits.

---

## 7c. Presence — how to make Loop G production-ready (Matt 2026-08-12)

Not a new marketing OS. The machine is:

```
produce (brain / list-kit / calendar week)
  → per-channel variants
  → marketing_brain_actions ready
  → one yes (Today: "Hey Paul, want me to set up some ideas?")
  → publisher-sweep at best_hours
  → /api/social/publish  (humanApprovedAt ≤ 7 days)
  → live GBP / IG / FB / …
  → content_performance → next week's mix and times
```

**Production-ready is six proofs, in order:**

1. **Tokens.** Re-probe auth tables. Matt reconnects brand GBP (INT-009) and any expired social in D6. Each broker later connects their own (G4 / D8). Agents do not log in as the broker. Checklist: `docs/plans/ENTERPRISE_MAP/matrix/SOCIAL-PARKS.md`.
2. **Generate is a calendar, not a chat scavenger hunt.** "Hey Paul, want me to set up some ideas?" produces a week of drafts that meet the beauty bar (Tumalo list-kit is the named exemplar). Steal mix ratios from `content-calendar.md`. Kill the Sheets/FUB door.
3. **Per channel is a variant.** Same idea, different format/hook/length. Never the same Reel on TikTok with a watermark. Parked platforms stay off the calendar.
4. **Yes is the same yes as copilot.** One queue. Phone. Stamp lands `humanApprovedAt`. Kill and pause work. Stale >7 days re-approves. Collapse the second queue into Today. Standing week-grant is D7, not a silent default.
5. **It actually posted, on time.** Open the live permalink. Row is `executed`. Schedule uses `best_hours` once sample_size is real; until then a documented Bend default (platform skill already names Tue–Thu 8am–4pm for IG) — labeled as default, not as "learned."
6. **It learned.** CAP-015: `content_performance` writes and status flips to `measured`. `getFormatPerformance` then boosts winners and suppresses losers. Traction can move the next slot. Do not call this production-ready because the cron exists.

**GBP continue (local pack, not only posts):**
- Name stays **Ryan Realty**. No keyword suffix. Suspension takes weeks.
- Phone 541.703.3095, address 115 NW Oregon Avenue, Bend, OR 97703 — exact NAP everywhere.
- Review replies: Matt's 1:1 voice (`gbp_responses.md`). Draft-first.
- Photos from the asset library, not stock. Weekly upload is a mutation → approve.
- Map-pack queries sit on Loop F's scoreboard once the token can pull `marketing_channel_daily`.

**Still inviolable:** draft-first, no invented numbers in a post, fair housing (place not people), ads parked.

---

## 7d. The broker home (Matt 2026-08-12)

Paul, Rebecca, or a new broker should land somewhere that is obviously *theirs* and obviously finished.

**It is Today.** Not a 12th destination. Own-book default; Matt sees all (Q4).

| Lane | Job | Already named |
|---|---|---|
| **Do** | Copilot queue: respond, looking-at, calendar yes, CMA-ready | Today |
| **Socials** | Connected channels, last posts, what worked, next scheduled, pause | Loop G on Today; Settings to connect |
| **Deals** | Their closings, one tap into the file | Closings, scoped |
| **Modify** | Connect socials, pause calendar, kill a draft, book settings | Settings; actions also inline on Today |

Onboard: access → connect socials (OAuth, not a password pasted into chat) → copilot asks about ideas → they yes → the calendar runs.

Looks **super awesome** means: outbound artifacts blow them away; the home is a finished ADMIN_UI instrument (next action first, no leftover islands, no vanity KPI wall). If Matt wants the admin to look like the public site, that is a P6 reopen, not a side project.

---

## 8. Collision + evidence rules

- No product code in the planning pass unless Matt says go.
- Dirty `app/admin/**/crm/inbox/**` from 11F: inventory, do not edit.
- **Loop E** lives in `docs/plans/PUBLIC_PRODUCT/` and `.claude/skills/public-product-os`.
  Do not start a third public rebuild. `experience-rollout` is superseded.
- Public CTA/copy/migrations: PUBLIC_PRODUCT session. Admin queue/packets/TC: this plan.
- Path:line or it is not a finding. The **right loop** wins vs stale docs *and*
  vs current code. Code is evidence of what we tried, not a freeze.
- Law is data (`TC_OREGON_COMPLIANCE.md`).
- Draft-first forever. Silence is not approval.
- Ads: parked. Do not open a paid-creative grind in this program. Organic social
  + GBP are Loop G, not ads.
- **Loop F** uses existing `earn-search-traffic`, `measure-search-traffic-gsc`,
  `/llms.txt`, G34/G39. Do not build a parallel AI site.
- **Loop G** uses `content-approve`, list-kit, `/api/social/publish`, local-seo,
  `getFormatPerformance`, and the content-calendar *mix* (not its Sheets door).
  Do not build a second publisher. Do not post without `humanApprovedAt`.
  Brand reconnect is Matt OAuth. Per-broker connect is that broker's OAuth.
- Dirty public tree (`app/**/_v3/`, place/market pages, `components/site/v3`):
  inventory, do not edit, do not `git add -A`. Commit this plan with pathspecs.

---

## 9. Paste prompt (short constitution)

The long method stays in this file. The executing agent reads this file after orientation.

```
PLANNING / BUILD only as Matt's last line allows. Default: plan and evidence, no product code.

You are the expert on Ryan Realty's broker OS. None of this is rocket science.
Make it efficient, smart, and streamlined. A new broker: access, own book,
hit the ground running.

IMPLEMENTATION AMNESIA: existing code and existing process must not keep us
from the right thing. Jobs stay. Current how is a quarry — steal what is
already the simple machine, replace what is in the way. "We already have it"
is not a veto. Still inviolable: draft-first, suppression, no invented
numbers, no prior-agent blame, licensed forms, SkySlope is not the SoR.

NORTH STAR — seven loops, one person record, one generation of code
  A Copilot: "Tell me everyone I need to respond to" → recommend → Matt yes → do it → CRM.
  B Closings: licensed forms → fill from deal → send → file. SkySlope is live baseline
    (browser+API, read-only). In-house should become the file we actually use. Soon.
  C Known sellers: expired + FSBO. First message + first packet blow them away:
    know THIS home, market THIS home. Manual first touch.
  D Buyers: newsletter is the named capture and a curated, beautiful edition.
    Back office sees every home they viewed, searches they saved, browse/scroll/click.
    Copilot: "So-and-so is looking at this home" → send or ask to send a packet.
  E Public site: wrap the locked v3 UI across every public page (Public Product OS
    P9 grind — already in flight; do not start a second session on those files),
    then forever refine. Do not start a third redesign.
  F Acquisition and truth: every page/process scored on how it drives the funnel.
    SEO, GSC, analytics, JSON-LD, /llms.txt, every tool — dialed and used.
    AI assistants (ChatGPT, Claude, Grok, Perplexity) citing "best broker in Bend"
    or "3-bed 2-bath in Northwest Crossing" must land on a real answering page.
    Ads parked for now.
  G Presence: Google Business Profile is first-class (local pack + posts).
    A self-running social calendar: copilot asks "Hey Paul, want me to set up
    some ideas?" → they yes → per-channel variants post at times that have been
    working → results feed the next week. Brokers connect their own accounts
    in Settings. Today is the broker home (do / socials / deals / modify).
    Process exists (produce → approve → publisher-sweep → /api/social/publish).
    Production-ready = tokens + calendar yes + live posts + measured.
    Paid ads stay parked. Threads/Nextdoor/Pinterest stay parked.

VERSIONING: one generation. Delete historical registers in the same commit that
ships the new path. Ratchets are the version gate. Methodology versions stay
for honest numbers. Never a parallel stack.

FUNNEL: on every page, how does this drive a buyer or seller in. If it does not,
cut or merge.

VOICE: never "what's my home worth." Always "Value my home" / "Get my home's value."
BEAUTY: outbound blows them away. Admin is a finished instrument (ADMIN_UI), not a
marketing page. If it would not make them want to see what we're about, it does not send.

Canon: docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md
Orient: ENTERPRISE_MAP/SESSION_HANDOFF.md, CROSS_AGENT_HANDOFF.md, ADMIN_PRODUCT
disk, then the skills that match the loop you are scoring.

Score every locked process: best / simple / clear / e2e / funnel — on the job, then
say whether the current how should be kept or replaced.
Deliver: snapshot, scorecard, loop gaps, ranked P0–P4, first slices A1/A2/C1/D1/B1/E1/F1/G1/G2/G3/G4.
Stop for Matt on D1–D8 in the plan. Then wait.
```

---

## 10. Session log

- 2026-08-12 — v0 written from Matt's stacked brief + adversarial pass + disk evidence already in ADMIN_PRODUCT / visitor track / newsletter / prospecting / TC. No live recount of `tc_envelopes` this pass (cite July 2026 audit; re-count before B1).
- 2026-08-12 — v0.1 implementation amnesia (Matt): existing code/process must not block the right, efficient loop. "Do not rebuild" demoted from freeze to quarry test. A5 rewritten. Paste prompt updated.
- 2026-08-12 — v0.2 Loop E: public site joins the OS. Giant incremental push = grind existing Public Product OS P9 (do not start OS #3), then standing refine forever. How-to in §7b.
- 2026-08-12 — v0.3 Loop F: funnel + SEO/GSC/analytics/AI citation as the giant review lens. Ads parked. Versioning = one generation, delete historical registers as the new path ships. LLM acceptance queries recorded.
- 2026-08-12 — v0.4 Loop G presence + live Loop E status. Public Product OS is in-flight on this tree (Places/Market `_v3/`, migration-recipe); broker OS does not touch it. GBP is first-class; organic social generate→approve→post must be production-ready on the existing pipeline (tokens + one door + one yes + live permalink). D6 added. Paid ads still parked.
- 2026-08-12 — v0.5 Loop G calendar + broker home. Auto calendar, per-channel variants, learn-from-results, per-broker OAuth. Copilot sentence: "Hey Paul, want me to set up some ideas?" Today = do / socials / deals / modify (not dest 12). Draft-first stays: yes on the calendar, then it runs. D7 standing week-grant; D8 brand vs personal accounts. Beauty: outbound blows them away; admin is finished ADMIN_UI. Still planning only.
