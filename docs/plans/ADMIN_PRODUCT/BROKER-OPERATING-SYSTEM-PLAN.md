# Broker Operating System — plan of record

**Started:** 2026-08-12 (Grok, planning only — no product code this session)
**Status:** v0.10 plan. D1–D10 locked. D11 (public voice) pending Matt. Third adversarial pass recorded. Technical calls are agent-made. Complete enough to build A3/A4/A1 — not a finished OS. Do not rewrite `VOICE.md` until D11 answers land.
**Home:** `docs/plans/ADMIN_PRODUCT/` (G44 covered by the ADMIN_PRODUCT package row)
**Jobs vs mechanics:** IA destinations and KEEP jobs still name the work. How we
currently do them is not sacred. See §Implementation amnesia.

This is the plan behind the broker OS prompt: copilot, known-seller streams,
buyer/newsletter, Closings/forms, public site, acquisition/truth, GBP + a
self-running social calendar, a broker home that looks finished, charts
wherever we display a series, visual inspection (not only code), and a
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
  prior-agent blame, OREF blanks stay licensed. SkySlope is the **live file
  until cutover** (D2). After cutover it is not the SoR.
- **Process/IA locks named the jobs and destinations.** They did not freeze
  the implementation. Design amnesia already said this for chrome. It now
  applies to workflows, data joins, and "don't rebuild" advice in v0.

### Who decides (Matt 2026-08-12)

Matt will not answer technical shape questions. The agent makes the best call
toward the goals, records it in this file, and keeps moving. Matt overrides
if the call is wrong.

**Matt still decides (stop):** outbound to real people (the actual send), money/ads, OAuth logins
he must click, license/forms, named-artifact taste ("does this packet blow them
away"), and **D11 voice** (the seven questions in §4). Product meaning that is
still open: D11. D1–D10 stay locked. New product meaning gets a plain-language
question, then a lock.

**Agent decides (do not stop):** atom vs pattern, which quarry piece, schema/join,
SEO title mechanics, default operating grants that still honor draft-first,
channel mix inside the live set, chart geometry. Record the call. Do not ask.

---

## 0. Adversarial audit of the brief (before Matt audits the prompt)

The stacked prompts describe a whole brokerage OS. That is the right ambition.
It is the wrong shape for one agent session unless we sequence it. Findings:

| # | Attack | Why it matters | Disposition |
|---|---|---|---|
| A1 | **Prompt obesity.** Four iterations concatenated. An executing agent will skip the middle. | Constitution must fit one screen. Method lives here. | Split: short prompt → this file |
| A2 | **Four loops, one week.** Copilot + Closings + expired/FSBO + buyer/newsletter is a quarter, not a grind tick. | Sequence or nothing ships. | P1 = copilot queue + one seller packet + one buyer signal. Forms after. |
| A3 | **"Send them a CMA" for a buyer looking at a home.** Locked engine: CMA = sellers, BPO = buyers/offer, expired-audit = expired. A seller CMA on a listing a buyer is touring is the wrong artifact. | Silent override would fork the product. | **D1 LOCKED (agent, Matt said make the call).** Ask first, in a short clear text. If they say yes, send a **buyer** packet (how it compares / what to think about offering) — never a seller CMA. |
| A4 | **Newsletter is not the only buyer door.** Saved search, guest alerts, portal, listing inquiry, call/text, Meta already create buyer people. Building only newsletter orphans hotter signals. | Honor newsletter as the named capture. Do not delete the others. | Newsletter = curated edition + capture. Saved-search/portal = behavior SoR. Copilot reads both. |
| A5 | **Behavior events exist; the product does not.** `visitor_events` already records listing_view / search / scroll / click / save. A contact panel can summarize them. That is quarry, not the copilot loop. If the join, the FUB-id leftover, or the panel-nobody-opens is why Matt cannot say "who is looking at what" in one sentence, replace the machine. | "Already tracked" is not "already useful." | Keep event facts if they are true. Rebuild the product surface (queue sentence, identity stitch, one-yes send) without loyalty to the current panel or join. |
| A6 | **"Every scroll" will drown Today or feel like surveillance.** Matt's wake-ups were inbound-human. Hot-visitor was MERGE→broker-alert and was NOT in the wake list. | Unranked pings make the copilot unusable. | **D3 LOCKED (Matt: text me like a new lead).** Wake the assigned broker on an identified person looking at a **specific home**. Not every scroll. One ping per person+listing per session. Honor GPC. Text is short. |
| A7 | **"Blow them away" / "designer's eye" is untestable.** Brand-voice gates banned words, not beauty. | Taste arguments will stall every packet. | Deliverable litmus: named exemplars (Tumalo CMA, approved newsletter shell, list-kit). If it is not in that league, it does not send. |
| A8 | **Expired "how we will market THIS home" is not the generic services list.** `lib/cma/expired-audit.ts` layer 2 mirrors `/sell` "what every listing gets." List-kit is the real marketing machine. | C2 fails today by construction. | First packet = know-this-home (engine already has site intel) + this-home marketing plan (list-kit / sell plan, not a brochure). |
| A9 | **TC "use soon" vs zero production envelopes.** July 2026 audit: `tc_envelopes` 0, `tc_principal_reviews` 0, no UI to create a deal, `/admin/deals` list reads stale SkySlope snapshot. Foundation is real. Daily use is not. | More schema is not the bottleneck. | First Closings slice: create-deal in UI + one licensed form fill/send/file to a Matt-owned email. Re-count live before building. |
| A10 | **"Parallel" is undefined.** Could be TC_SYSTEM.md Phase 4 dual-file or a second vendor. | Wrong baseline. | **D2 LOCKED (Matt).** SkySlope is the live TMS until in-house Closings is fully dialed, then cut over. Parallel = our system alongside, not a second vendor. Do not pretend in-house is the file today. |
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
| A23 | **Auth is brand-level, not per-broker.** One GBP row, one Meta page token. Paul/Rebecca cannot "enter their credentials" today. | New-broker onboard fails if only Matt's Google login works. | **D8 LOCKED.** Matt's IG (and brand FB/LI) are primary. Each broker OAuth-connects their own IG / Facebook / LinkedIn / etc. GBP stays the one brokerage profile. Auth rows keyed by `broker_id`. Never stuff personal tokens into the brand GBP row. |
| A24 | **"Broker dashboard" as destination 12.** IA already locked 11 jobs. Today = what to do; Closings = deals; Reports = numbers; Settings = modify; Content = publish. A 12th home repeats the 160-route problem. | A new dashboard OS would fight the lock and the public session. | The broker home **is Today**, with four lanes (do / socials / deals / modify). Do not add a nav word. |
| A25 | **"Super awesome" vs locked ADMIN_UI.** Admin is a calm instrument (queues over dashboards; public navy/Amboqia blacklisted). Outbound posts and packets are the marketing surface. | Painting admin like the public site reopens P6. | Outbound must blow them away. Admin must look *finished* inside ADMIN_UI (no leftover islands, every screen leads with the next action). Reopen visual lock only if Matt says the instrument itself is wrong. |
| A26 | **Identical cross-post is not "optimized per channel."** Platform skills already ban watermarked/cross-posted Reels. "All channels" is not Threads/Nextdoor/Pinterest (parked) and not the same caption everywhere. | Spray-and-pray would tank reach and look cheap. | One idea → per-channel variants (length, format, hook). D6 still limits which channels are live. |
| A27 | **We flattened series into type.** Public v3 Instrument is a big number with no chart primitive in the barrel. Admin 11C replaced recharts sparklines with typographic figures + a plain polyline, citing "data is typographic." Market charts still live in KB (`KbMarketChart`, `MarketCoreCharts`, `PriceChart`). | A median without the line is not the market. Code that "has the number" is not visualization. | Series and comparisons get a chart. A singleton status stays type. Vanity KPI walls stay cut. |
| A28 | **Code inspection cannot see a lying chart.** Gates catch hex, nesting, empty aria-labels. They do not catch a clipped Y-axis, a smear at 390, a tooltip that invents a number, or a sparkline that does not match the figure beside it. | Public OS already requires browser 390+1280. That is not yet a *chart* look. | Visual inspection is law: load the page, look at the chart, reconcile to the figure and the source. Screenshot or it did not happen. |
| A29 | **A 7th public pattern would reopen P6.** The six are closed. Atoms may grow. | A "Chart" destination or a new OS is the death mode. | **D9 LOCKED (agent, 2026-08-12).** v3 chart **atom** inside Instrument (trend under the answer), not pattern 7. Admin charts use `--a-*`. Public session owns the public atom. |
| A30 | **Identity lives in notes.** Matt has to read notes to learn "this person is an expired listing." Next step and "what are they doing right now" are not on the person. | A lead page that makes the broker hunt is the original "what am I supposed to do?" failure. | Person header always shows: who they are (expired / FSBO / buyer / …), **next step**, **what they're doing now**. Notes are history, not the label. |

### 0b. Adversarial audit of *this plan* (v0.8 — the brief audit was not enough)

A1–A30 attacked the stacked prompts. They did not attack the plan that grew out of them. The plan can still fail by being complete-looking and unbuildable, or by building the wrong existing machine.

| # | Attack | Why it matters | Disposition |
|---|---|---|---|
| A31 | **"Plan complete" is a slogan.** Meaning is locked (D1–D9). The four-question scorecard was never filled. Buyer packet, cutover, and "next step" had no machine. | Executing now would improvise those in code. More constitution without a slice is A1/A2 again. | Meaning is done. Specify only what A3/A4/A1 need. Build those. Do not write v0.9 of the OS. |
| A32 | **D3 already exists and is the wrong text.** `queueReturnVisitAlert` already texts the assigned broker: "Jane is back on your site right now. Why: … From: …" One per person per *day*, FUB-id keyed, unassigned → Matt, broker SMS opt-in default OFF. | A new wake rail is a fifth inbox. Leaving the novel in the text violates the SMS lock. | D3 = rewrite that alert. `{name} is looking at {address}.` + person link. One per person+listing per session. Same rail. Do not add a channel. |
| A33 | **"We saw you looking" to the lead is surveillance, not transparency.** Matt asked for clear, honest texts. Narrating the watch to the consumer is a different product. | Creepy first touch kills the yes. | Lead ask names the **home** and the **offer**. It does not say we watched them browse. Broker wake is the watch. |
| A34 | **"Use the BPO" would send a lender doc to a buyer.** `bpo-deliver` is institutional. Locked engine (CMA = sellers, BPO = lenders/offer, expired-audit = expired) is not a buyer-facing packet. | Silent reuse forks the artifact. | Buyer packet = know-this-home engine, buyer-facing: how it compares + what to think about offering. Not a seller CMA. Not the lender BPO. Not a new valuation OS. |
| A35 | **Person header will rot into notes** unless who / next / now have sources. | A3 becomes three more fields the broker types. | Who = labels, multiple OK (`Expired listing · looking at homes`). Next = copilot's current recommendation (broker can override). Now = latest identified `listing_view` (live session, else last 24h, else "not on the site"). |
| A36 | **Unidentified traffic and 1am pings.** Every scroll was already rejected. Anonymous heat is not a new-lead SMS. Broker wakes already fire at night for new leads. | Either silence (miss the lead) or spam Matt. | SMS only if identified. Unassigned → Matt, same as today's alert. Overnight OK (it is a new-lead class). Consumer ask honors quiet hours. Broker SMS opt-in still applies — if it is OFF, the wake never leaves; that is a Settings fact, not a new channel. |
| A37 | **"Dialed" has no test, so SkySlope is forever.** | Alongside without a finish line is a second SoR. | Cutover when this list is green on one real file: create deal in UI, fill one licensed form from the deal, send, file/seal, person↔deal, a broker can run it without opening SkySlope. Until then SkySlope is the live file. |
| A38 | **Dual-intent is the real person.** Expired owner who is also looking at homes. | Two records, or one label, hides the truth. | One person. Header shows both. Copilot can wake (looking-at) and still owe the expired packet. |
| A39 | **P1 is nine items — still the ocean.** | A2 warned. | First build: **A3 person header, A4 wake rewrite, A1 queue.** C1 is taste (Matt). G1 is Matt OAuth. E is the other session. A5 ask text can ship with A4's rail; the packet waits on taste. |
| A40 | **Evidence is stale.** TC count = July 2026. Social census = 2026-08-08. | Building G1/B1 on a dead token or a dead envelope count is theater. | Re-probe before G1 or B1. Not a reason to keep planning. |
| A41 | **No named exemplar for the expired or buyer packet.** Tumalo is a seller CMA. | C1/A5 will stall on "does this blow them away?" | Correct stall. Matt taste-stops those artifacts. Do not invent a beauty gate in code first. |
| A42 | **Return-visit is FUB-keyed.** `fub_legacy_id` is a historical register. | D3 that only fires for FUB-era people misses newsletter buyers. | Wake keys `crm_people.id` (and session identity). FUB id is quarry, not the join. |
| A43 | **A model zoo is the opposite of streamlined.** Replicate Kling/Hailuo/Luma/Veo/Wan/Seedance, Vertex Veo/Imagen, Fal, Synthesia, plus Grok Imagine — producers pick at random or copy Tumalo. May 2026 audit: the zoo was billed and almost unused. | A new broker cannot "just post." Agents cannot be expert in eight video APIs. | **D10.** One generative stack: Grok Imagine via `XAI_API_KEY`. Park the zoo. |
| A44 | **Imagine is not Remotion.** 4-pillars scout (2026-05-03): Grok Video re-painted brand-locked vector stills (palette drift, cartoon outlines). Auto slop check passed; the look failed. | Baking numbers or Amboqia into generated frames will lie. | Imagine generates pixels. Remotion (and list-kit compositors) own exact type, live numbers, brand-locked motion. Fallback when Imagine drifts: still + Remotion. |
| A45 | **A generated house is not the listing.** Photoreal AI "this home" is slop and a license hole. | First listing video that isn't 123 Main is a beauty and truth failure. | Listing motion = Imagine **image-to-video of the real MLS photo**. Never text-to-video a fake exterior and caption it as the property. |

**v0.8 verdict:** The plan is complete as a **plan of record for meaning**. It is not a finished brokerage OS, and it was not fully audited until this pass. Further constitution is the failure mode. The best outcome now is to build A3/A4/A1 against these dispositions, not to add Loop H.

### 0c. Third adversarial pass (v0.10 — will it actually work?)

A1–A45 attacked the brief and then the plan. They did not ask whether the shipped
loops would still sound like us, or whether a few remaining holes would make the
first week fail in production. This pass does. It does not reopen D1–D10.

| # | Attack | Why it matters | Disposition |
|---|---|---|---|
| A46 | **Voice is a second OS, and it already failed once.** 2026-08-05 was "once and for all": nuke old lists, Buffett letters as law, one file `VOICE.md`. GOV.UK mechanics became what gates could check → site went beige (removed 2026-08-06). Shape bans were retired because Buffett uses them. Rule 3 ("judgment in a quote under a name") fought "never invent quotes" and produced fake-Matt lines that were reverted. `.cursor/rules/blog-voice.mdc` is a second voice file. This plan only locks Value my home. Social, SMS, newsletter, blog, and site will keep drifting. | A working copilot that overexplains, sounds corny, or leans on em dashes is the same product failure as a missing queue. Regex cannot catch "corny." Piling constructions is how we got beige. | **D11 pending Matt.** Replace the voice machine: one short law, named exemplars, tiny mechanical gate (punctuation + invented quotes + Value my home). Retire Buffett-as-law as a gate. Kill rule 3 quotes. Kill the long word lists unless Matt keeps a tiny pander/urgency set. Do not rewrite `VOICE.md` until the seven questions are answered. Code comments stay out. |
| A47 | **Dual-intent taxonomy is not a closed list.** A3 says "expired / FSBO / buyer / …". Tags exist (`audience:*`, `seller:*`). The header will invent labels, or notes will win again. | Two records, or one vague label, hides the truth A38 already named. | **Agent lock.** Closed set, multiple OK: `Expired listing` · `FSBO` · `Buyer` · `Seller` · `Client`. Dual-intent is two labels on one person, not a sixth type and not a second record. Source = tags + live work + latest `listing_view`. Broker does not type the label. |
| A48 | **A wake SMS without Today looking-at is a missed phone.** D3 texts the broker. If they do not look at the text, the queue still hides the person. | SMS is the poke. The job is "tell me everyone I need to respond to." | A4 and A1 ship together. Today shows looking-at. Do not ship the rewrite of `queueReturnVisitAlert` as a text-only feature. |
| A49 | **The buyer packet has no template.** D1 says what it is not (seller CMA, lender BPO). A5 will stall or silently reuse one of those. | Wrong artifact on a hot buyer is the original A3/A34 failure. | Name the sections now, not the beauty: (1) how this home compares (comps, days, price vs band), (2) what to think about offering. Know-this-home engine. Matt taste-stops the first PDF. Do not invent a third valuation OS. |
| A50 | **The calendar cannot learn while `measured` stays 0.** CAP-015 writer exists (`measurement-status.ts`). If no live row flips, G3 "optimal hours" is theater. | A22 already said this. Building G3 on empty bias repeats it. | Do not build a new optimizer. Confirm one executed post writes `content_performance` and flips `measured`. Then G3. Default hours until that row exists. |
| A51 | **Imagine wrappers and listing-tour still the old camera.** `lib/grok-image.ts` = `grok-imagine-image`. `lib/grok-video.ts` = `grok-imagine-video`. `video/listing-tour/scripts/prepare-tour.ts` still imports Replicate for i2v. | D10 said upgrade, don't add a second client. A listing tour that still calls Wan/Replicate is the zoo. | G5 upgrades wrappers to `grok-imagine-image-quality` + `grok-imagine-video-1.5`. Listing-tour i2v points at Imagine on next touch. Do not add a second client. |
| A52 | **Two (really three) Grok talkers.** Broker SMS agent, copilot drafts, social caption generators. Three voices. | Public-facing copy will not stay consistent if each runtime has its own prompt novel. | One public-facing law (D11). Anything a person reads goes through it. Admin instrument copy is out unless it is forwarded or sent. |
| A53 | **v3 barrel has no chart atom.** D9 locked. `components/site/v3/index.ts` still exports Instrument as a big number. KB still holds the real market charts. | A Market migration can ship without the line. | Public session owns the atom. Do not build it here. Flattening a series is still a defect. |
| A54 | **Newsletter beauty is ungated.** The engine is the healthiest admin loop. An ugly or corny edition can still drain after approve. | Voice gates ≠ designer's eye. | Draft-first stays. Beauty is Matt's eye, not a regex. D11 applies to the prose. |
| A55 | **`/admin/social` is a traffic report.** `next.config.ts` rewrites it to `/admin/analytics/social` (GA4 + visitor_sessions). OAuth callbacks land there. G4 connect UI is not that page. | A broker who "connects Instagram" and lands on a sessions chart will think the product is broken. | Settings = connect. Today = calendar. `analytics/social` stays a report. Do not make the rewrite the product. |
| A56 | **Regex cannot catch corny or overexplain.** `voice-constructions.cjs` still grows by "we found this by eye." Agents write to pass the gate. That is how the site went beige. | A once-and-for-all voice that is a novel of regex will fail the same way again. | Mechanical gate after D11: punctuation + invented quotes + Value my home + (optional) a tiny pander/urgency list. Taste = named exemplars + "would Matt send this?" Delete `.cursor/rules/blog-voice.mdc` as a second canon when D11 lands. |

**v0.10 verdict:** Meaning still holds. First build is still **A3 / A4 / A1**. The new hole that would make the whole OS sound wrong is voice. Lock D11 from Matt's answers, then stop writing constitution. Do not start Loop H. Do not rewrite public copy in this session.

---

## 1. North star (Matt, 2026-08-12 — do not drift)

### Loop A — Copilot (daily, phone)

"Tell me everyone I need to respond to." → Grok names the person, what they wrote or did, the one next action, the draft. Matt says yes. Grok does it. CRM records it.

**On the person, always, without opening notes:**
- Who they are (expired listing, FSBO, buyer, …)
- **What's the next step**
- **What they're doing right now** (e.g. looking at 123 Main)

**Looking at a home wakes the phone** (D3): a short text to the assigned broker, same class as a new lead. Identified person + a specific home. Not every scroll.

**SMS lock:** every text we send (to a lead or a broker) is clear, transparent, and concise. No extra stuff.

### Loop B — Closings (SkySlope now, in-house until it wins)

**D2 locked:** SkySlope is the primary transaction system today. We are building ours alongside it. We cut over when the full workflow is dialed. Until then SkySlope is the live file (browser + API, read-only unless Matt names a mutation). In-house already has anticipate / envelope / seal / commissions / form blanks — refine until a broker can pick a licensed form, fill it from the deal, send it, and file it, easier than SkySlope. Then cut over. Brokers never build forms. New broker: access → own book → ground running.

### Loop C — Known sellers (weekly, guaranteed stream)

Expired and FSBO are people we know are selling. First **message** and first **deliverable** must blow them away: prove we know everything about **this** home, and show how we will **market this** home. Manual first touch. Never blame the prior agent. Never invent numbers.

### Loop D — Buyers (newsletter + site behavior)

Buyer leads come in when people sign up for the newsletter (named door). Newsletter is its own curated process — designer's eye, nothing ships that does not blow them away. In the back we see exactly what they looked at: homes, searches created, browse, scroll, clicks, learned-more.

**D1 locked:** when they are looking at a home, we **ask first** in a short text, then send a **buyer** packet if they want it — not a seller CMA. Copilot still wakes the broker (D3). The ask to the lead is a yes from the broker, same as any other outbound.

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

**Two layers of accounts (D8 locked 2026-08-12):**

1. **Brand / primary** — Matt's Instagram is the primary IG. Brand Facebook, LinkedIn, and GBP are the brokerage presence. Calendar ideas can post here as Ryan Realty.
2. **Each broker** — Paul, Rebecca, or a new broker hooks up *their* Instagram, Facebook, LinkedIn, and whatever else is in the live set, in Settings. Calendar ideas can also post there as that broker — **variants**, never the same file twice.

GBP is one brokerage profile. Brokers do not each get a Google Business Profile.

That is Loop A applied to presence: recommend → yes → do it → record. Draft-first still binds: the first yes is on the *calendar* (or the standing week-grant). It does not invent a silent publisher.

**How posts get made (D10):** one generative stack — **Grok Imagine** (image + video) on `XAI_API_KEY`. Not Kling, not Veo, not Hailuo, not Synthesia. List-kit still orchestrates the listing kit. Imagine is the camera. Remotion and the Tumalo compositors are the type/data layer. See §7f.

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

### Voice lock — valuation (subset of D11)

Never: "What's my home worth?" / "What is your home worth?"
Always: **Value my home** or **Get my home's value** (Get your home's value when addressing them).

### Voice lock — public-facing (D11 pending)

This is the once-and-for-all replacement for the 2026-08-05 machine. It is **not
fully locked**. Dialogue is in progress. Do not rewrite `VOICE.md`, do not delete
gates, do not start a site-wide copy pass until D11 is closed.

**Locked from dialogue (2026-08-12):**

- **Punctuation.** No em dash, no en dash, no semicolon, no `!`. Colon only as a
  label or list (`Beds: 3`), never as a dramatic beat (`Here's the thing:`).
- **Stop after the fact.** Do not add a sermon after the number. Client language,
  not industry jargon (no "band," no "comp set"). Place names are fine. Seller
  market line: `131 homes are for sale in Bend between $504,000 and $616,000. The
  median one has been listed 53 days.`
- **Buyer SMS (D1 ask).** `{address} is listed at {price}. Want a short comparison
  and what to think about offering?`
- **Who is talking.** `We`. Not `I`. Not a pronoun-free telegram unless the line
  is a caption fragment.
- **Listing sequence (public copy must be true).** Sign agreement → schedule
  photographer → schedule sign → start marketing material → MLS coming soon →
  go live when photos and materials are ready, sign goes in. Photos happen
  **before** the listing posts. Public process line: `We sign. We schedule photos
  and the sign. We start the marketing. It goes in the MLS as coming soon. When
  the photos and materials are ready, we go live and the sign goes in.`
- **Enthusiasm.** Complimentary and exciting is allowed. Not over-the-top salesy.
  Caption shape: facts, then one true specific (`New on Awbrey Butte. 4 bed, 3
  bath, $1.12M. Views, a usable lot, and a house that shows well.`). House
  compliment: `A bright kitchen and a deck with a real view of the butte.` Not
  stunning / incredible / jaw-dropping.
- **Length.** Same rules everywhere. A caption can be short. A blog can be longer.
  Neither overexplains.
- **SEO vs voice.** Driving traffic outranks voice on discovery surfaces
  (title, H1, meta). Body, SMS, captions, packets still obey the voice.
  Homepage H1: `Homes for Sale in Central Oregon`. Under it: `Bend, Redmond,
  Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market.`
- **Authenticity / genuine / every principle.** Conveyed only. **Never named.** We
  never call ourselves authentic, genuine, honest, simple, transparent, trusted,
  dedicated, or any other virtue we want the reader to feel. We never print the
  principle. The language does the work. This outranks every other voice rule
  except live numbers and invented quotes.
- **Grateful.** Felt. Not printed on a listing post. The house is the post
  (P9 C).
- **Three registers, not one.**
  1. **Public** (site, social, newsletter, packets, SMS to leads): the voice
     above. Never name a virtue.
  2. **Personal notes to clients:** always respectful. Always thank them for
     the business. Their trust means a lot. This register may thank. Public
     marketing may not.
  3. **Admin:** as simple as possible. Completely different from public.
     Instrument language (`ADMIN_UI`). Not this voice.
- **Boutique.** Size fact, used to describe the firm. Not a virtue claim.
- **MLS remarks.** Never rewrite. Someone else's words, plus our own remarks
  as filed. Display may translate a property-type code (type A → Residential).
  That is a label, not a voice pass.
- **About draft (conflict, not locked).** Matt's line: `We are a boutique real
  estate brokerage in Bend, Oregon, committed to building community through
  authentic relationships and exceptional customer service.` This names
  authentic and exceptional. It fights the never-name-the-virtues lock. P15b
  decides which wins.

**Named exemplars so far (Matt picked):**
- **Judgment.** A short sentence in our voice is allowed. Never an invented
  quote. Never cut a true judgment only to avoid having a view.
  Example: `The second listing succeeds by correcting the first ask, not
  defending it.`
- **Newsletter open.** The listings are the content. `14 new listings in Bend
  this week. Median list $625,000.`
- **Buffett.** Skipped. Not required to write this voice. Leave out of the
  operating file unless Matt reopens it.

**Named exemplars so far (Matt picked):**

| Surface | Line |
|---|---|
| Market / packet | 131 homes are for sale in Bend between $504,000 and $616,000. The median one has been listed 53 days. |
| Homepage H1 | Homes for Sale in Central Oregon |
| Homepage lead | Bend, Redmond, Sisters, Sunriver, La Pine, and Terrebonne. Live list prices and days on market. |
| Buyer SMS | 123 Main is listed at $895,000. Want a short comparison and what to think about offering? |
| IG caption | New on Awbrey Butte. 4 bed, 3 bath, $1.12M. Views, a usable lot, and a house that shows well. |
| House compliment | A bright kitchen and a deck with a real view of the butte. |
| Listing process | We sign. We schedule photos and the sign. We start the marketing. It goes in the MLS as coming soon. When the photos and materials are ready, we go live and the sign goes in. |
| Newsletter open | 14 new listings in Bend this week. Median list $625,000. |
| Judgment | The second listing succeeds by correcting the first ask, not defending it. |

**Still open:** About sentence vs never-name-the-virtues (P15b), word lists
(premier / top producing / local experts), Buffett (skipped).

**What failed last time.** We tried to encode taste as regex. Buffett-as-law plus
GOV.UK mechanics plus construction bans plus word lists produced beige (agents
wrote to pass the gate) or corny (rule 3 invented quotes). A second file
(`.cursor/rules/blog-voice.mdc`) drifted from the canon. Colons are not in
`PUNCTUATION` in `scripts/brand-voice-vocabulary.cjs`, but the blog rule still
talks about "dramatic colons."

**Recommended machine (pending yes):**

1. **One short law, one file.** Write to one person. Say the fact. Then stop.
   Never pander, never sermon, never self-praise, never overexplain. Never
   invent a quote. Never name a virtue (authentic, genuine, honest, …). Live
   numbers. Value my home. A short judgment in our voice is allowed.
2. **Buffett is out of the operating file** unless Matt reopens it.
3. **No invented quotes.** Judgment is a short sentence in our voice.
4. **Punctuation (he named it):** no em dash, no en dash, no semicolon, no `!`.
   Colon only as a label or list (`Beds: 3`), never as a dramatic beat
   (`Here's the thing:`).
5. **Shrink or kill word lists.** Do not ban words "to be safe." Keep only what
   Matt keeps in the D11 answers.
6. **Named exemplars** he would actually send (site, SMS, caption, newsletter,
   packet). Review test: "does this sound like those?"
7. **Mechanical gate stays tiny:** punctuation + invented quotes + Value my home
   + (optional) a few pander/urgency phrases. Not a novel of regex.
8. **Scope:** anything a member of the public reads. Code comments out. Admin
   instrument copy out unless it is forwarded or sent. MLS remarks stay out
   (format-specific) unless Matt pulls them in. Flyers/signage stay out.
   Ads stay parked.

**Surfaces in:** site, SMS, email, newsletter, blog, social captions, GBP posts,
packets, video on-screen text we author, public error/empty states.

**Surfaces out:** code, comments, commit messages, logs, internal docs, admin UI
(unless sent), someone else's words (reviews, other brokers' remarks, MLS fields).

### SMS lock

Every text is **clear, transparent, and concise.** No extra stuff. Broker wake-ups and lead asks both obey this. Draft-first still binds on anything to a real person.

Two different texts. Do not conflate them.

- **Broker wake (D3):** `{name} is looking at {address}.` Person link. That is the whole message.
- **Lead ask (D1):** after broker yes. Names the home and asks if they want a short comparison / what to think about offering. Does **not** say we watched them browse. If they say yes, send the buyer packet. No brochure, no seller CMA, no extra.

### Person header lock

Open a lead and the page answers three things without notes:

1. **Who they are** — closed set, more than one is OK: `Expired listing` · `FSBO` · `Buyer` · `Seller` · `Client`. Dual-intent is two labels on one person (`Expired listing · Buyer`), not a sixth type. Source = tags + live work + latest `listing_view`. Broker does not type the label.
2. **What's the next step** — the copilot recommendation (broker can override)
3. **What they're doing right now** — latest identified `listing_view` (live session, else last 24h, else "not on the site")

Notes are history. They are not the label. Do not add three fields the broker types.

### Beauty lock

Everything we deliver is curated. Designer's eye. If it would not make them want to see what we are about, it does not go out.

Two surfaces, one bar, different languages (already locked — do not mix them):

- **Outbound** (posts, packets, newsletter, list-kit): blow them away. Tumalo kit is the named exemplar.
- **Admin / broker home:** a finished instrument (`design_system/admin/ADMIN_UI.md`). Every screen leads with the next action. No leftover islands. Not a marketing page. If the instrument itself is ugly, fix it inside the lock — or Matt reopens P6.

### Chart lock (Matt 2026-08-12 — we are dropping the ball)

**The data is the spectacle** is already the public thesis. We are not living it. A series shown only as a number, a table, or a dead polyline is a defect.

- **Series or comparison → chart.** Price over time, months of supply, social reach, pipeline, seasonality, comps vs subject. Honest axes, labeled, source line, empty state that states the reason. No pie. No 3D. No chartjunk. Reduced-motion: static final state.
- **Singleton status → type.** "4 things need you" stays a sentence. ADMIN_UI still bans a KPI wall that *is* the page.
- **Look at it.** Every data surface is inspected in a real browser at 390 and 1280 on live numbers. Code review is necessary and not sufficient. If the line and the figure disagree, the chart is wrong — even if every gate is green.
- **One language per plane.** Public charts are a v3 atom (D9), not a leftover `KbMarketChart` on a v3 page. Admin charts resolve `--a-*` at runtime (recharts cannot take `var()`). CMA/packet charts are print craft, same honesty.

Quarry, not a new library: recharts is installed; `KbMarketChart`, `PriceChart`, `MarketCoreCharts`, `SalesReportCharts`, CMA `seasonalityChartSvg`, admin `analytics/_components/charts.tsx` exist. Steal the honest ones. Replace the ones that lie or live in the wrong register.

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
| Grok Imagine | `lib/grok-image.ts`, `lib/grok-video.ts`, `XAI_API_KEY` | **D10 — the generative camera.** Upgrade wrappers to Imagine 1.5 / image-quality. Download temp URLs into our storage. |
| List-kit | `social_media_skills/list-kit/SKILL.md` | Listing-launch orchestrator (video + flyers + carousel + single). Produce half of Loop G. |
| List-kit compositors | `scripts/build_tumalo_v3_kit.py`, single-image / Pattern D | Type on **real** listing photos. Tumalo is the named exemplar. Not a video model. |
| Remotion | `video/market-report`, `video/listing_reveal` | Data-true motion. Live numbers from DAL. Fallback when Imagine drifts. |
| FFmpeg / first-frame | `scripts/check_first_frame.py` | Assembly, concat, ship-blocker. Keep. |
| Replicate / Vertex / Fal / Synthesia video zoo | Kling, Hailuo, Luma, Veo, Wan, Seedance, avatar | **PARK.** Do not route new produce through them. |
| Content-approve | `docs/plans/ADMIN_PRODUCT/processes/content-approve.md` | Draft → stamp → publish law. KEEP. Two queues today. |
| Approval queue | `/admin/approval-queue` (+ `/admin/crm/approvals`) | Human yes. IA says this lands on Today. Phone-first is the gap. |
| Publisher | `publisher-sweep` → `/api/social/publish` | Execute after yes. `humanApprovedAt` ≤ 7 days. GBP is a platform. |
| GBP client | `lib/google-business-profile.ts` | Local posts + token refresh. Refresh token live as of 2026-08-12; access tokens last ~1h. |
| Local SEO | `.claude/skills/local-seo/SKILL.md` | Map-pack audit → drafts through the same approval pipeline |
| GBP metrics | `marketing_channel_daily` channel=`gbp` | Scoreboard once the token is live |
| Social parks | `docs/plans/ENTERPRISE_MAP/matrix/SOCIAL-PARKS.md` | RECONNECT vs PARK. Do not invent Threads/Nextdoor/Pinterest work. |
| Content calendar skill | `social_media_skills/content/content-calendar.md` | Mix + cadence quarry. Door is wrong (Sheets / FUB / April 2026 doc). Keep pillars, replace the how. |
| Format performance | `getFormatPerformance` in `lib/marketing-brain/generate-briefs.ts` | Per-platform uplift, `best_hours`, `best_topics`. Starved by measured=0. |
| Measurement loop | `lib/marketing-brain/measurement-loop.ts` | 48h/7d/30d pulls + winners digest. CAP-015 must actually flip `measured`. |
| Platform specs | `social_media_skills/platform-best-practices/SKILL.md` | Per-channel variants. Bans identical cross-post. |
| Admin visual | `design_system/admin/ADMIN_UI.md` | Broker home language. Queues over dashboards. Charts of series are allowed; KPI walls are not. |
| Public charts (KB) | `KbMarketChart`, `MarketCoreCharts`, `PriceChart`, `SalesReportCharts` | Honest series quarry. Do not import onto a v3 page — lift into a v3 atom. |
| Admin charts | `app/admin/.../analytics/_components/charts.tsx`, `AgentActivityChart` | Recharts. Must use `--a-*` at runtime (11F). KPI strips that dropped sparklines are the miss. |
| CMA charts | `lib/cma/render.ts` `seasonalityChartSvg` | Packet craft. Visual-inspect the PDF, not only the SVG string. |
| Own-book scope | `crm_people.assigned_broker` (Q4) | Paul/Rebecca see their book. Matt sees all. |
| Prospecting worklist | `/admin/prospecting`, first-touch templates | Expired/FSBO stream machine |
| TC foundation | `tc_*`, envelope engine, `/admin/forms`, ingest | Closings — unused in production |
| SkySlope | Files API + Forms library API + Chrome session | **Live TMS until cutover (D2).** Baseline + form blanks. Not a second SoR after cutover. |
| Value my home lock | PUBLIC_SITE_UX_OVERHAUL + PUBLIC_PRODUCT decisions | CTA language — still violated in live copy |
| Voice canon (2026-08-05) | `marketing_brain_skills/brand-voice/VOICE.md` + `scripts/brand-voice-vocabulary.cjs` + `scripts/voice-constructions.cjs` + `.cursor/rules/blog-voice.mdc` | **Quarry to replace after D11.** Steal: one-file intent, never-invent-quotes, Value my home, punctuation. Cut: Buffett-as-law as a gate, rule 3 quotes, construction zoo, second blog file, long word lists. |
| GPC / suppression | `lib/crm/gpc.ts`, `lib/comms/guards.ts` | Fail-closed on watch + send |

---

## 3. Gaps vs the brief (the real work)

### Copilot (A)

- Reply-on-thread is **locked** to the wake rail and still only cell-forwards (`inbound-respond` §5.7).
- No single ranked queue that speaks in Matt's sentence: everyone to respond to, plus "looking at this home."
- Suggested reply exists; "yes → Grok sends" does not (broker still taps send in admin).
- Visitor-hot is a fourth notification path, Matt-hardcoded, not assigned-broker. D3 now requires a wake SMS like a new lead — **rewrite `queueReturnVisitAlert`** (already on the wake rail, wrong text, per-day, FUB-keyed). Do not add a fifth inbox.
- Person page does not lead with **next step** + **what they're doing now** + who they are. That is buried in notes. Closed label set (agent lock): `Expired listing` · `FSBO` · `Buyer` · `Seller` · `Client`. Multiple OK.
- A4 without A1 is a missed phone: the wake SMS is the poke; Today must also show looking-at.

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
- Buyer packet is locked (D1): ask first, then a buyer comparison/offer packet — never a seller CMA, never a lender BPO. The packet itself is not built. Sections named now: (1) how this home compares (comps, days, price vs band), (2) what to think about offering. Matt taste-stops the first PDF.
- Listing alerts + portal are stronger *behavior* doors than newsletter; newsletter is the named *capture* door. Must join, not compete.

### Closings (B)

- Cannot create a deal in the UI (script-fed).
- Dashboard list ≠ `tc_deals`.
- Form libraries ingested (~111 versions, July audit) but template→fill→send is not a daily path.
- Zero production envelopes. CRM person ↔ tc_deal still unbridged.
- SkySlope remains the working file.

### Voice (public-facing — D11 pending)

- The 2026-08-05 "once and for all" is still the machine, and it failed: beige from gates, corny from rule 3, a second blog file, punctuation fights (colons).
- This plan only locked Value my home. SMS, social, newsletter, blog, site, and packets do not share one short law.
- Regex cannot catch overexplain or corny. Growing `voice-constructions.cjs` is how we got beige.
- Do not rewrite `VOICE.md` or start a copy pass until Matt answers the seven D11 questions.

### Beauty

- No deliverable litmus. Voice gates ≠ design gates.
- Two visual languages (public vs admin v2). Outbound packets need a third: print/email craft, with named exemplars.

### Charts (everywhere we display a series)

- Public v3 has **no chart atom**. Instrument is a big number. KB still holds the real market charts. Migrations can ship a Market page that lost the line.
- Admin 11C *removed* recharts sparklines from KPI strips in the name of typography. The series is still in the data. The picture is gone.
- Existing charts were not all looked at: 11F found public navy hardcoded in agent-activity recharts. A green gate is not a visual pass.
- CMA seasonality SVG exists; nobody this program has opened the rendered PDF and asked if it blows them away.
- Social lane on Today has no chart of what worked — and cannot until measured=0 is fixed.

Do not start a chart-library program. Steal recharts + the honest KB charts. Add a v3 atom (D9). Look at every one in a browser.

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
- `/admin/social` rewrites to `/admin/analytics/social`, a traffic report. Settings is the connect door. Today is the calendar. Do not make the rewrite the product.

Until tokens are live, do not build a second publisher. Reconnect is the account owner (Matt for brand GBP; each broker for their own IG/LI). Agents prepare the checklist only.

---

## 4. Decisions

**D1 — Buyer looking at a home: what do we send?** **LOCKED (agent, Matt said make the call).** Ask first, in a short clear text (SMS lock). Shape: `{address}` — want a short comparison and what to think about offering? Do **not** say we watched them browse. If they say yes, send a **buyer** packet (know-this-home engine, buyer-facing — not a seller CMA, not the lender BPO). The ask to the lead is a broker yes, same as any outbound.

**D2 — What is "Parallel"?** **LOCKED (Matt).** SkySlope is the primary TMS now. In-house Closings runs alongside until the full workflow is dialed, then we cut over. Not a second vendor. Until cutover, SkySlope is the live file. **Dialed** means this list is green on one real file: create deal in UI, fill one licensed form from the deal, send, file/seal, person↔deal, a broker can run it without opening SkySlope.

**D3 — Is "looking at this home" a wake-up SMS?** **LOCKED (Matt: B).** Text the assigned broker like a new lead. Identified person + a specific home. Not every scroll. One ping per person+listing per session. Short. Honor GPC. Shape: `{name} is looking at {address}.` + person link. Nothing else. **How:** rewrite `queueReturnVisitAlert` (do not add a rail). Key `crm_people.id`, not FUB. Unidentified = no SMS. Unassigned → Matt. Overnight OK. Broker SMS opt-in still applies.

**D4 — Newsletter vs saved-search as primary buyer capture.** **LOCKED (Matt named it; agent recorded).** Newsletter is the named capture. Saved-search/portal is the behavior graph. One person record.

**D5 — Worth-language in SEO titles.** **LOCKED (agent, technical).** Keep demand phrasing in `<title>`/meta only. On-page CTA, headline, and SMS stay **Value my home** / **Get my home's value**. Do not smash SEO titles in the same pass as a CTA rewrite.

**D6 — Production-ready social set.** **LOCKED (agent, from Matt's FB/IG/LI + parks).** Live: GBP + Instagram + Facebook + LinkedIn. Reconnect YouTube / X when tokens are back. TikTok if the token is alive. Threads / Nextdoor / Pinterest stay parked. Ads stay parked.

**D7 — Calendar yes: per-post, or a standing week-grant?** **LOCKED (agent, toward "take the work away" + draft-first).** First week is per-item (they see every draft). After that, "run my calendar" is a 7-day stamp — same freshness as `humanApprovedAt`. Kill and pause always work. Never a forever autopilot.

**D8 — Brand accounts vs per-broker accounts.** **LOCKED (Matt 2026-08-12).** Matt's Instagram is the primary IG. Brand Facebook / LinkedIn / GBP are the brokerage. Each broker connects their own Instagram, Facebook, LinkedIn, and the rest of the live set, in Settings. One idea can fan out to brand and to the broker as **variants**, never the same file twice. GBP stays one profile — not per-broker.

**D9 — Public chart: atom inside Instrument, or a 7th pattern?** **LOCKED (agent, technical).** Atom inside Instrument. The six patterns stay closed. A trend lives under the big answer. A 7th pattern would reopen P6. Public families must not delete a working KB chart without a v3 replacement in the same change. Flattening a series to a figure is a defect.

**D10 — What produces posts and video?** **LOCKED (Matt asked; agent: yes, one stack).** Grok Imagine is the only generative image/video model. `XAI_API_KEY`. Current models: `grok-imagine-image-quality` (stills + edits, up to 3 refs) and `grok-imagine-video-1.5` (text-to-video, image-to-video, reference-to-video, edit, extend, native audio). Duration 1–15s. Aspects 16:9 / 9:16 / 1:1 (and the rest the API names). 720p default; 1080p on t2v/i2v. Temp URLs get downloaded into our storage. Our wrappers (`lib/grok-image.ts`, `lib/grok-video.ts`) still name the old models — upgrade them, do not add a second client.

Park: Replicate Kling / Hailuo / Luma / Veo / Wan / Seedance, Vertex Veo / Imagen, Fal as a parallel host, Synthesia avatars. Do not route new produce through them.

Not Imagine (keep): Remotion for live numbers and brand-locked motion; list-kit compositors for type on real MLS photos; FFmpeg / first-frame; owned camera and drone. Listing motion is **i2v of the real photo**, never a generated house captioned as the property. If Imagine drifts (we already watched it re-paint vector stills), fall back to still + Remotion. Type and prices are composited in code, never baked into a prompt.

**D11 — Public voice, once and for all?** **PARTIAL (dialogue).** See Voice lock for what landed. Remaining questions are prompt dialogues, not the original seven-item list. Do not rewrite `VOICE.md` until this is closed.

D1–D10 are locked. D11 is the open product-meaning stop. Do not auto-send a buyer CMA; the D1 path is ask-first after a broker yes. G1 is GBP + Matt's primary IG + brand Facebook (D6). G3: first week per-item, then the D7 week-grant. Produce is Imagine (D10), not a model zoo. Voice copy passes wait on D11.

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
Plus: **Chart** — if this is a series or a comparison, is it a chart (honest axes, source, empty state) or did we flatten it to a number?
Plus: **Look** — was this data surface opened in a real browser at 390 and 1280 on live numbers this session? Code review is not the look.

Loop A extra: Queue / Yes / Wake (D3) / Person (who / next / now) / SMS (short).
Loop B extra: Libraries / Anticipate / Fill / Send / File / Onboard.
Loop D extra: Capture (newsletter) / Identify (session stitch) / See (every home) / Recommend / Packet beauty.
Loop G extra: Generate (Imagine, D10) / Variant (per channel) / Approve (one yes) / Post (timed) / Learn (measured) / Local pack (GBP) / Home (Today: do / socials / deals / modify).

### Scorecard (v0.8 — jobs, not code)

| Job | Best | Simple | Clear | E2E | Funnel | Chart | Look | The how |
|---|---|---|---|---|---|---|---|---|
| Inbound / copilot queue | 5 | 3 | 3 | 4 | 5 | — | no | Keep the rail. Replace the sentence. |
| Person page | 5 | 2 | 2 | 3 | 5 | — | no | Replace the header. Quarry the behavior panel. |
| Looking-at wake | 5 | 3 | 2 | 3 | 5 | — | — | Rewrite `queueReturnVisitAlert`. Do not add a rail. |
| Expired / FSBO packet | 5 | 2 | 2 | 3 | 5 | 2 | no | Keep the engine. Replace the generic services hero. |
| Newsletter + identity | 4 | 3 | 4 | 4 | 5 | — | no | Keep the engine. Stitch the session. |
| Closings | 5 | 1 | 2 | 1 | 3 | — | no | SkySlope until the cutover list is green. |
| Social publish | 5 | 2 | 2 | 2 | 4 | 1 | no | Tokens first. Then the calendar door. |
| GBP | 5 | 1 | 3 | 1 | 5 | 1 | no | Matt OAuth. Then the same yes-path. |
| Public v3 | 5 | 3 | 4 | 3 | 5 | 1 | in flight | Grind P9. Add the D9 atom. Do not start OS #3. |
| Public voice | 5 | 1 | 2 | 2 | 5 | — | no | Replace the 2026-08-05 machine after D11. Keep punctuation + invented quotes + Value my home. |

A 2 on Clear or Simple with a 5 on Best means **replace the how**. That is the person page, the wake text, and the voice machine.

---

## 6. Ranked plan

### P0 — do not ship broken

- Suppression / unapproved send / invented numbers in a packet
- Inbound SMS/email not on `crm_timeline`
- GPC honored on watch + send
- No "what's my home worth" on a seller **CTA we would tap** (inventory first)
- No social post without a fresh stamp (calendar grant counts; silence does not)
- No invented number on a chart axis, tooltip, or sparkline
- No data surface shipped that was only grepped — look at it
- No invented quote. No "what's my home worth" on a CTA we would tap. After D11: no em dash / semicolon / `!` in public prose.

### P1 — first complete loops (this is "start using it")

1. **Person header (A3):** open a lead → who they are + **next step** + **what they're doing now**. Notes are not the label.
2. **Looking-at wake (A4 / D3):** rewrite `queueReturnVisitAlert` to `{name} is looking at {address}.` Identified only. One per person+listing per session.
3. **Copilot queue (A1):** one ranked Today list: unreplied inbound + "looking at {address}" (identified) + CMA-ready + parked sequence. Sentence form. Assigned-broker scoped.
4. **Yes-path for one SMS reply (A2):** preload draft → Matt yes → `sendGovernedSms` → timeline. Short, clear, no extra stuff.
5. **Buyer ask (A5 / D1):** after broker yes, a short ask that names the home (does not narrate the watch); if they want it, a buyer packet — not a seller CMA, not a lender BPO.
6. **Seller first packet (C1):** one expired (or FSBO) message + deliverable that (a) proves we know the house, (b) shows how we would market **this** house. Still manual send. Matt taste.
7. **Buyer see-back (D):** newsletter signup identifies the session; person shows homes/searches/scrolls.
8. **Worth-copy inventory** (list path:line; public CTA rewrite is PUBLIC_PRODUCT).
9. **Presence (G):** Tokens are live (IG @ryanrealtybend; GBP refresh works). One generate door on Imagine (D10). One yes. A live post we can open.

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
- **Per-broker OAuth** in Settings (D8 locked). Matt's IG is primary. Paul/Rebecca connect their own IG / Facebook / LinkedIn. Calendar posts brand + broker as variants.
- **Today as broker home:** do / socials / deals / modify. Own book. Looks finished inside ADMIN_UI.
- **Chart pass:** every series we display is a chart, looked at in a browser. Public = v3 atom (D9). Admin = `--a-*` recharts, not a polyline that pretends. Packets = the CMA/seasonality figure actually read.

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
- A 7th public pattern (or a chart OS) instead of a v3 atom
- A KPI wall that *is* the page
- Flattening a time series to a single figure and calling it Instrument
- Kling / Veo / Hailuo / Luma / Wan / Seedance / Synthesia / Fal as a second generative camera
- A generated house captioned as the listing
- Buffett-as-law as a gate, rule 3 invented quotes, a second voice file, a novel of construction regex
- `/admin/social` as the connect UI (it is a traffic report)

### P4 — later

- Dark mode unreachable, FUB vocab ratchet, reporting collapse, full SkySlope cutover after one clean parallel deal

---

## 7. First build slices (smallest complete)

| Slice | Done when | Blocked on |
|---|---|---|
| **A1** Copilot queue sentence | Matt can ask "who do I respond to" and the list is true (inbound + looking-at + ready docs) | None for a read-only prototype; write path needs composer reuse |
| **A2** Yes → send one SMS | Timeline `sms_out`, suppression held, sequence paused. Text is short and clear. | Matt yes on that send |
| **A3** Person header | Open an expired (or any lead): who they are (closed set, multiple OK), next step, what they're doing now — without notes | None |
| **A4** Looking-at wake | Identified listing_view → `{name} is looking at {address}.` Rewrite `queueReturnVisitAlert`. One per person+home per session. **Ship with A1** so Today also shows looking-at. | D3 locked. Same rail. Broker SMS opt-in still applies. |
| **A5** Buyer ask | After broker yes, lead gets a short ask that names the home (no "we watched you"); yes → buyer packet, not seller CMA, not lender BPO | D1 locked. Packet is taste (Matt). |
| **C1** One expired blow-away packet | Message + PDF on a real expired in-scope listing, manual send, no generic services hero | Matt review of packet |
| **D1** Newsletter identity + home list | Subscribe in a browser that browsed listings → person shows those homes | Confirm subscribe identify path |
| **E1** Public giant push | Dedicated session: `run public product` until P9 legacy pages → 0 | **Already in flight.** Do not start a second E1. See §7b live status. |
| **F1** AI/GSC query battery | Those three example queries (and live GSC top queries) resolve to a citable Ryan Realty URL via Google and via `/llms.txt` + JSON-LD | Public session; ads still parked |
| **G1** GBP + IG live | IG @ryanrealtybend page token valid. GBP refresh token works (re-probe before a post). One approved post visible. | Tokens already in env. No new keys. |
| **G2** Easy generate → post | Name a listing (or "GBP market update") → **Imagine produce** (D10) → draft on Today → yes → live on @ryanrealtybend (or brand FB / GBP). Same `humanApprovedAt` gate. | D10. Do not bypass the queue. Do not call Replicate. |
| **G3** One week on a calendar | Copilot: "Hey Paul, want me to set up some ideas?" Week of per-channel drafts on Today. Yes → posts at `best_hours` (or a documented default until data exists). | G2. D7 locked: first week per-item, then 7-day grant. |
| **G4** Broker connects own socials | Paul/Rebecca (or a new broker) OAuth from Settings: their IG, Facebook, LinkedIn (and later the rest of the live set). Calendar can post to *their* accounts as variants of the brand post. Own-book Today shows their social lane. | D8 locked. Do not stuff personal tokens into Matt's primary IG or the brand GBP row. |
| **G5** Imagine is the camera | One listing still → Imagine i2v (1.5) → stored MP4 → draft on Today. Wrappers on `grok-imagine-video-1.5` / `grok-imagine-image-quality`. No Replicate call on the path. | D10. `XAI_API_KEY` already set. Matt taste on the clip. |
| **V1** Chart inventory | Path:line of every public, admin, and packet surface that displays a series as type/table only, plus every live chart that was not browser-looked-at. | None. Planning/evidence. Do not migrate public charts in a broker session. |
| **V2** One honest chart, looked at | One series (recommend: `/housing-market` trend or admin overview sparkline) is a real chart, 390 + 1280, figure reconciles to the line, source on screen. | Public half = public session (D9 locked: atom). Admin half can run here. |
| **Voice** One law, one file | `VOICE.md` is the short law. Buffett-as-law is not a gate. Rule 3 is gone. `blog-voice.mdc` is deleted. Mechanical gate is punctuation + invented quotes + Value my home (+ optional tiny pander/urgency). Five named exemplars in the file. | **D11 answers.** Do not start this slice before they land. Not mixed with A3/A4/A1. |

Do not start B1 until A1/C1/D1 are specified with evidence. Closings is "soon," not "before the copilot can talk."
G1 tokens are already live. G2/G5 share Today's yes-path with A2; do not build a third approve button. Produce is Imagine (D10).
G3 is the north star slice; it is not the first slice. One live Imagine post comes first or the calendar is a slideshow.
V1 can run in the planning pass. V2 public waits on the other process's barrel.
Voice waits on D11. First build is still A3 / A4 / A1.

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
   READY, browser 390 + 1280 — including looking at every chart.** Gate contracts
   for that route move in the **same** change (the lesson that reverted the first
   Market attempt). A series flattened to a figure is not a migration, it is a
   deletion. Declare it or replace it with a v3 chart atom (D9).
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
390 and 1280, deploy READY. LOOK at every chart — a series flattened to a
figure is a deletion; replace it with a v3 chart atom (D9: atom inside
Instrument, not a 7th pattern) or declare it. Chrome leverage first if the
queue still says so — verify disk. Implementation amnesia: do not polish
KB/legacy; migrate or cut. Beauty bar: if it would not make them want to
see what we're about, it is not done. On every page: how does this drive
someone into the funnel. SEO/JSON-LD/llms.txt stay honest so an LLM asked
for the best broker in Bend or a 3-bed in Northwest Crossing can cite us.
Ads parked. Stop only for a Matt lock, empty P9 queue, or a real blocker.
When P9 is empty, do P10, then the standing refine loop in
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

**In flight / collision (2026-08-12):**
- Places + rest-of-Market `_v3/` landed on `origin/main` in `16f0361f` (mixed into a broker-OS docs commit because those files were already staged; main is protected, could not split). Public session should treat that as shipped quarry and keep grinding — do not re-migrate those families.
- Still uncommitted and **not ours:** sell spine / `app/dev/sell-film/` / `design_system/public-v2/` / extra `PUBLIC_SITE_UX_OVERHAUL/` files. Constitution says that folder is demoted. Do not join it. Do not `git add -A`.

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
produce (Grok Imagine + list-kit compositors + Remotion for numbers)
  → per-channel variants
  → marketing_brain_actions ready
  → one yes (Today: "Hey Paul, want me to set up some ideas?")
  → publisher-sweep at best_hours
  → /api/social/publish  (humanApprovedAt ≤ 7 days)
  → live GBP / IG / FB / …
  → content_performance → next week's mix and times
```

**Production-ready is six proofs, in order:**

1. **Tokens.** IG @ryanrealtybend page token is valid. GBP refresh token works (access tokens last ~1h; heartbeat or next call refreshes). Each broker later connects their own IG / Facebook / LinkedIn in Settings (G4). Never store Paul's token on Matt's IG row.
2. **Generate is Imagine + a calendar, not a model zoo.** "Hey Paul, want me to set up some ideas?" produces a week of drafts. Stills and motion from Grok Imagine (D10). Type and prices from list-kit / Remotion. Beauty bar: Tumalo list-kit is the named exemplar. Kill the Sheets/FUB door. Do not call Kling/Veo/Hailuo.
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

Onboard: access → connect *their* IG / Facebook / LinkedIn (OAuth, not a password pasted into chat) → copilot asks about ideas → they yes → the calendar can post to Matt's primary accounts and to theirs, as variants.

Looks **super awesome** means: outbound artifacts blow them away; the home is a finished ADMIN_UI instrument (next action first, no leftover islands, no vanity KPI wall). If Matt wants the admin to look like the public site, that is a P6 reopen, not a side project.

---

## 7e. Charts + visual inspection (Matt 2026-08-12)

This is already supposed to be in the process (public OS: browser 390+1280; admin 11F: load routes at 375). It is not specific enough, and we dropped the ball on the picture.

**Pass, everywhere we display data:**

1. Inventory the surface (V1). Is it a singleton or a series/comparison?
2. If series: there is a chart in the *current* visual language (v3 atom / admin `--a-*` / packet SVG). Not a leftover KB widget on a v3 page. Not a polyline that replaced recharts to satisfy a misread of "data is typographic."
3. **Look.** Real browser, 390 and 1280, live numbers. The line matches the figure. Axes are honest (zero baseline unless a labeled index). Tooltip does not invent. Empty state states the reason. Reduced-motion is complete, not blank. Screenshot in the commit or the decisions log.
4. Code gates still run. They do not replace step 3.

Public chart work is Loop E (barrel atom). Admin + packet charts are this plan. Do not mix.

---

## 7f. How we produce posts — Grok Imagine (D10, 2026-08-12)

Matt: pare the video zoo back to one solution. Agent: **yes.** The zoo is why produce never got easy. One camera, one key, one expert path.

### The stack (three layers, not eight models)

| Layer | Job | Tool | Not |
|---|---|---|---|
| **Camera** | Generate or animate pixels | **Grok Imagine** (`XAI_API_KEY`) | Kling, Veo, Hailuo, Luma, Wan, Seedance, Fal, Synthesia |
| **Type / data** | Exact words, live numbers, brand-locked motion | List-kit compositors (Tumalo) + **Remotion** | Baking prices or Amboqia into an Imagine prompt |
| **Assembly** | Concat, first-frame, store | FFmpeg + our buckets | Leaving xAI temp URLs live |

Owned drone / listing photos / MLS stills are **source frames**, not a fourth generative vendor.

### Imagine API (be expert in this — current as of 2026-08)

Docs: `https://docs.x.ai/developers/model-capabilities/imagine`

**Auth:** `XAI_API_KEY` (already in env). Direct xAI API, not Fal as a host.

**Image** — `POST https://api.x.ai/v1/images/generations` and `/v1/images/edits`
- Model: `grok-imagine-image-quality` (quality stills; `grok-imagine-image` is the cheaper draft). Our `lib/grok-image.ts` still says `grok-imagine-image` — upgrade.
- Text-to-image. Edits with up to **3** reference images (URL, data URI, or Files API `file_id`).
- `response_format: b64_json` so we store it. Grok URLs are temporary.
- Aspects we use: `1:1` (IG feed), `4:5` if the API names it, `9:16` (stories/reels still), `16:9` (YouTube/GBP). Default feed `1:1`.

**Video** — `POST https://api.x.ai/v1/videos/generations`, poll `GET https://api.x.ai/v1/videos/{request_id}`
- Model: `grok-imagine-video-1.5` (native audio, 1080p on t2v/i2v). Our `lib/grok-video.ts` still says `grok-imagine-video` — upgrade.
- Modes (one per request):
  1. **Text-to-video** — `prompt` only. First frame is invented, then animated. Use for brand/abstract/b-roll that is **not** a specific house.
  2. **Image-to-video** — `prompt` + `image` (`{ url }` or data URI). The still **is** the first frame. **This is the listing path.**
  3. **Reference-to-video** — `prompt` + `reference_images` (and optional `reference_audios` preset `voice_id`). Guides look without locking frame one. Cap 720p.
  4. **Edit** — restyle / add / remove in an existing clip. Duration follows the source (cap ~8.7s).
  5. **Extend** — continue from the last frame; stitch into one clip. How we get past 15s without a second vendor.
- Duration **1–15s**. Default social: **5–8s** 9:16 720p. Don't spend 15s until the 5s take is good.
- Resolution: `480p` (scout) / `720p` (ship) / `1080p` (t2v + i2v on 1.5). Reference-to-video and edit cap at 720p.
- Aspect: `16:9`, `9:16`, `1:1`, plus `4:3` / `3:4` / `3:2` / `2:3` on t2v. **i2v follows the source image** unless we override (override stretches — don't, crop the still first).
- Native **audio** on 1.5, included. Preset voices via `reference_audios` (`voice_id` from the TTS roster, e.g. `eve`). Custom voice files are partner-only — we do not wait on that.
- Status: poll until `done` (use `video.url`), or `failed` / `expired`. Timeout 10 min is already in `lib/grok-video.ts`.
- **Download immediately** into Supabase/storage. Do not publish the xAI URL.

**Cost (xAI list, 2026-08 — re-read pricing before a volume week):** image-quality ~$0.05/still; video-1.5 ~$0.08/s (480p) to ~$0.14/s (720p). A 6s 720p i2v is about a dollar. Scout at 480p. Iterate 3–10 takes, pick one, then 720p. Money/ads stay Matt-gated; this is produce cost, not ad spend.

### What to make with which mode

| Post | Mode | Source | Overlay in code |
|---|---|---|---|
| Just listed / reel of **this** home | i2v | Best MLS exterior or hero photo | Address, price, beds/baths — list-kit type, never in the prompt |
| Carousel / single still | Image edit or compositor | Real photos | Tumalo generators. Imagine may restyle a **non-listing** still, not replace the house |
| Market / GBP update | Remotion if it has a number; Imagine t2v only for abstract motion under the number | DAL / GSC | The figure is Remotion or type |
| Brand / lifestyle b-roll | t2v or ref2v | Brand stills we authored, or owned drone | No fake Cascades sold as Bend |
| Talking head | Park Synthesia. If we need it later: Imagine ref2v + preset voice, still draft-first | Broker photo only with consent | Do not invent a person |
| Longer than 15s | Extend from last frame, or FFmpeg concat of approved beats | Approved clips | First-frame gate on the stitch |

### Hard rules (inviolable for produce)

1. **The listing is the listing.** i2v the real photo. Never t2v a house and name an address.
2. **Numbers and type are code.** Imagine is weak at exact lettering (we already failed a brand-locked vector scout, 2026-05-03). Prices, counts, CTAs, Amboqia — compositor or Remotion.
3. **If it drifts, don't ship it.** Palette shift, extra people, wrong roofline, cartoon outlines → still + Remotion fallback. Auto duration checks are not the look.
4. **Draft-first.** Imagine output is a draft on Today. `humanApprovedAt` still required.
5. **Beauty bar.** If it would not make them want to see what this is about, it does not go out. Tumalo kit remains the still exemplar. Named video exemplar: first Imagine i2v Matt says yes to (G5).
6. **Fair housing.** Place not people. No generated "buyers" as the hook.
7. **One client.** Upgrade `lib/grok-image.ts` / `lib/grok-video.ts`. Do not add `lib/kling.ts`. Producers that still call Replicate i2v (`prepare-tour.ts` Wan, etc.) get pointed at Imagine on the next touch.

### What we are not doing

- Becoming a film studio with eight APIs.
- Using Imagine on the public site as fake MLS photography (public creative-brain still: AI is a stylized layer, camera is truth). Social listing posts use **real photos in motion**, which is different and allowed.
- Waiting on ElevenLabs vs Imagine native audio as a new OS. Remotion VO can keep Victoria until a produce pass replaces it; new social clips prefer Imagine's native track so we don't mix two VO vendors on one Reel.
- Calling Fal's hosted Imagine. We already have the xAI key.

### Expert produce loop (the actual craft)

1. Pull the listing (or the week theme) once. Same facts as list-kit.
2. Pick the still (MLS hero, owned drone still, or a brand frame we authored). Crop to the aspect.
3. Scout: 2–4 Imagine takes at 480p, 5s, tight motion prompt (locked-off or slow push, no new objects, no text).
4. Look at them. Pick one or fall back.
5. Ship take: 720p, 5–8s, 9:16 for IG/FB Reels, 1:1 still for feed, 16:9 for GBP/YouTube.
6. Composite type/price in the approved generator.
7. First-frame gate. Store the MP4. Queue on Today.
8. Caption is short, clear, no extra stuff (SMS lock's cousin). Per-channel variant, not the same file twice (D8).
9. Matt/broker yes. Publish.

Prompts are cinematography (lens, move, light), not adjectives. Negative: no text, no extra people, no logo, no changing the house. Iterate in the API, not in a new tool.

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
- **Loop G** uses `content-approve`, list-kit, Grok Imagine (D10), `/api/social/publish`, local-seo,
  `getFormatPerformance`, and the content-calendar *mix* (not its Sheets door).
  Do not build a second publisher. Do not post without `humanApprovedAt`.
  Do not route new video through Replicate/Vertex/Fal/Synthesia.
  Brand IG is @ryanrealtybend (page token live). Per-broker connect is that broker's OAuth.
- Dirty public tree (`app/**/_v3/`, place/market pages, `components/site/v3`):
  inventory, do not edit, do not `git add -A`. Commit this plan with pathspecs.
- **Charts:** public atom = public session. Admin/packet charts = this plan.
  Visual inspection is required on both. A green `ci:gates` is not a look.

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
numbers, no prior-agent blame, licensed forms. SkySlope is the live TMS until
cutover (D2); then it is not the SoR.

WHO DECIDES: Matt — OAuth clicks, money/ads, license, named-artifact taste,
and product meaning asked in plain language. Agent — technical shape, recorded
here. Do not stop to ask atom-vs-pattern. D1–D10 are locked. D11 voice is pending Matt.

NORTH STAR — seven loops, one person record, one generation of code
  A Copilot: "Tell me everyone I need to respond to" → recommend → Matt yes → do it → CRM.
    On a person, always, no notes required: who they are, next step, what they're
    doing now. Looking at a home wakes the assigned broker like a new lead (D3).
    SMS: clear, transparent, concise. No extra stuff.
    Wake: "{name} is looking at {address}." Ask: name the home; want a comparison? Do not say we watched them.
  B Closings: SkySlope is primary until in-house is dialed, then cut over (D2).
    Licensed forms → fill from deal → send → file. Brokers never build forms.
  C Known sellers: expired + FSBO. First message + first packet blow them away:
    know THIS home, market THIS home. Manual first touch.
  D Buyers: newsletter is the named capture. Back office sees every home they
    viewed. Looking at a home: ask first in a short text, then a buyer packet
    if they want it — never a seller CMA, never a lender BPO (D1). Broker yes
    before the ask. Do not tell the lead we watched them browse.
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
    working → results feed the next week. Matt's IG is the primary; each broker
    connects their own IG / Facebook / LinkedIn (D8 locked). GBP is one brokerage
    profile. Today is the broker home (do / socials / deals / modify).
    Process exists (produce → approve → publisher-sweep → /api/social/publish).
    Produce = Grok Imagine (D10) + list-kit type + Remotion for numbers. Park the video zoo.
    Production-ready = tokens + calendar yes + live posts + measured.
    Paid ads stay parked. Threads/Nextdoor/Pinterest stay parked.

VERSIONING: one generation. Delete historical registers in the same commit that
ships the new path. Ratchets are the version gate. Methodology versions stay
for honest numbers. Never a parallel stack.

FUNNEL: on every page, how does this drive a buyer or seller in. If it does not,
cut or merge.

VOICE: never "what's my home worth." Always "Value my home" / "Get my home's value."
  Public-facing copy is honest, simple, transparent. Fact, then stop. Never pander,
  never sermon, never invent a quote. D11 pending: one short law, named exemplars,
  tiny punctuation gate. Do not rewrite VOICE.md until those answers land.
  Code comments are out. Admin UI is out unless the words are sent.
SMS: clear, transparent, concise. No extra stuff.
BEAUTY: outbound blows them away. Admin is a finished instrument (ADMIN_UI), not a
marketing page. If it would not make them want to see what we're about, it does not send.
CHARTS: a series or comparison is a chart — honest axes, source, empty state.
  Public: v3 atom inside Instrument (D9), not a leftover KB chart, not a 7th pattern.
  Admin: --a-* recharts; typography does not mean "delete the sparkline."
  Packets: look at the rendered PDF.
LOOK: every data surface is opened in a real browser at 390 and 1280 on live numbers.
  Code inspection is necessary and not sufficient. Screenshot or it did not happen.

Canon: docs/plans/ADMIN_PRODUCT/BROKER-OPERATING-SYSTEM-PLAN.md
Orient: ENTERPRISE_MAP/SESSION_HANDOFF.md, CROSS_AGENT_HANDOFF.md, ADMIN_PRODUCT
disk, then the skills that match the loop you are scoring.

Score every locked process: best / simple / clear / e2e / funnel / chart / look — on the job, then
say whether the current how should be kept or replaced.
Deliver: snapshot, scorecard, loop gaps, ranked P0–P4, first slices A1/A2/A3/A4/A5/C1/D1/B1/E1/F1/G1/G2/G3/G4/G5/V1/V2.
Stop for Matt on OAuth logins, money/ads, license, named-artifact taste, and D11 voice.
Technical shape is decided in this file toward the goals. Do not ask. Record it.
D1–D10 are locked. D11 is pending. Scorecard is in this file. First build is A3 person header, A4 rewrite of queueReturnVisitAlert (with A1 so Today shows looking-at), A1 queue. Produce is Grok Imagine. Voice rewrite waits on D11. Then wait only on those stop classes.
```

---

## 10. Session log

- 2026-08-12 — v0 written from Matt's stacked brief + adversarial pass + disk evidence already in ADMIN_PRODUCT / visitor track / newsletter / prospecting / TC. No live recount of `tc_envelopes` this pass (cite July 2026 audit; re-count before B1).
- 2026-08-12 — v0.1 implementation amnesia (Matt): existing code/process must not block the right, efficient loop. "Do not rebuild" demoted from freeze to quarry test. A5 rewritten. Paste prompt updated.
- 2026-08-12 — v0.2 Loop E: public site joins the OS. Giant incremental push = grind existing Public Product OS P9 (do not start OS #3), then standing refine forever. How-to in §7b.
- 2026-08-12 — v0.3 Loop F: funnel + SEO/GSC/analytics/AI citation as the giant review lens. Ads parked. Versioning = one generation, delete historical registers as the new path ships. LLM acceptance queries recorded.
- 2026-08-12 — v0.4 Loop G presence + live Loop E status. Public Product OS is in-flight on this tree (Places/Market `_v3/`, migration-recipe); broker OS does not touch it. GBP is first-class; organic social generate→approve→post must be production-ready on the existing pipeline (tokens + one door + one yes + live permalink). D6 added. Paid ads still parked.
- 2026-08-12 — v0.5 Loop G calendar + broker home. Auto calendar, per-channel variants, learn-from-results, per-broker OAuth. Copilot sentence: "Hey Paul, want me to set up some ideas?" Today = do / socials / deals / modify (not dest 12). Draft-first stays: yes on the calendar, then it runs. D7 standing week-grant; D8 brand vs personal accounts. Beauty: outbound blows them away; admin is finished ADMIN_UI. Still planning only.
- 2026-08-12 — D8 LOCKED (Matt): his Instagram is the primary IG. Brand FB/LI/GBP are the brokerage. Each broker hooks up their own Instagram, Facebook, LinkedIn, and the rest of the live set. Variants, never the same file twice. GBP is not per-broker. G4 unblocked on the decision.
- 2026-08-12 — v0.6 charts + look. Series must be charts; visual inspection in a real browser is law (code review is not the look). v3 has no chart atom; admin 11C dropped sparklines. D9: recommend atom inside Instrument, not pattern 7. Slices V1/V2. Public chart work stays with the public session.
- 2026-08-12 — Who decides: Matt will not answer technical shape. Agent makes the best call toward the goals and records it. D9 LOCKED: v3 chart atom inside Instrument, not pattern 7. Also agent-locked D4 (newsletter capture), D5 (worth-language in title/meta only), D6 (GBP+IG+FB+LI live; YT/X reconnect; Threads/ND/Pin parked), D7 (first week per-item, then 7-day grant). Stop only on D1–D3, OAuth, money, license, named taste.
- 2026-08-12 — v0.7 D1–D3 locked. D2: SkySlope is live TMS until in-house is dialed, then cut over. D3: looking-at-a-home wakes the broker like a new lead (identified home, not every scroll). D1 (agent): ask first in a short text, then a buyer packet — never a seller CMA. SMS lock: clear, transparent, concise. Wake = `{name} is looking at {address}.` Ask = noticed the home; want a comparison? Person header: who they are, next step, what they're doing now — not in notes. Slices A3/A4/A5.
- 2026-08-12 — v0.8 adversarial audit of the *plan* (not only the brief). Complete as meaning, not as a built OS. Return-visit alert already exists and is the wrong text (A32). Lead ask does not narrate the watch (A33). Buyer packet ≠ lender BPO (A34). Person header has sources, not typed fields (A35). Cutover is a checklist (A37). First build is A3/A4/A1. Scorecard filled. Stop writing constitution.
- 2026-08-12 — v0.9 D10: Grok Imagine is the only generative camera (`grok-imagine-video-1.5` + `grok-imagine-image-quality`). Park Kling/Veo/Hailuo/Luma/Wan/Seedance/Fal/Synthesia. Keep Remotion + list-kit compositors + FFmpeg. Listing motion = i2v of the real MLS photo. §7f is the produce canon. Slice G5. IG @ryanrealtybend already live.
- 2026-08-12 — v0.10 third audit + voice. A46: the 2026-08-05 voice machine already failed (beige gates, corny rule-3 quotes, second blog file). D11 pending Matt (seven questions). Recommended: one short law, named exemplars, tiny punctuation/conduct gate; retire Buffett-as-law as a gate; kill rule 3. A47 closed person labels. A48 A4 ships with A1. A49 buyer packet sections named. A51 wrappers still old model names; listing-tour still Replicate. A55 `/admin/social` is a traffic report. First build still A3/A4/A1. Do not rewrite `VOICE.md` this pass.
