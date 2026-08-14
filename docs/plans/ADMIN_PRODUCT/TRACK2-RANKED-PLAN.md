# Track 2 ranked plan — 2026-08-13

**Pass:** slices A, C, B, P2, and P3 leftovers that do not need Matt (dead send paths, visitor email rail, Pipeline→Closings) land on `main`. No outbound from the agent. No SkySlope write. Matt still gates Yes on Today, C copy taste, Email to Matt, and publish.
**SoR:** this file. v0.14 in `BROKER-OPERATING-SYSTEM-PLAN.md` is quarry. Destinations stay locked.

---

## Snapshot (≤8)

- Track 1 public Looks are green. Conversion surface is not this pass.
- Loop A is **queue + draft**, not “tell me everyone → yes → you send → CRM records it.”
- `lib/agent` is broker→agent SMS. Reuse the runtime. Do not confuse it with Loop A.
- Loop B: SkySlope is the live file (D2). In-house has libraries + anticipate + seal. `/admin/deals` still reads the SkySlope mirror. CRM people link to `tc_deal` via `tc_deal_people` (many people, one file).
- Loop C first SMS is a market-analysis offer. The expired packet hero is the this-home plan (video, flyers, photo set for THIS address). Generic brochure copy is not the lead.
- First touch stays manual. Suppression fail-closed. No invented numbers. No prior-agent blame.
- 11 destinations stay. Extra weight: Today, Messages, People, Prospecting, Valuations, Closings.
- Ads parked. No second CRM, chatbot, or signing stack.

---

## Process scorecard (21 + leftover forks)

Q1 Best · Q2 Simple · Q3 Clear · Q4 E2E. S1 Improve (next copilot / first-touch / forms-send). S2 Inform only if it changes the action. Q4 <4 → P0/P1.

| Process | Q1 | Q2 | Q3 | Q4 | S1 | S2 | How |
|---|---|---|---|---|---|---|---|
| inbound-respond | 5 | 3 | 3 | 3 | One recommended SMS on Today, yes → governed send | What they wrote, on the row | Today lists inbound. Open is a person page, not the yes-path. |
| broker-alert | 4 | 3 | 4 | 4 | Same sentence as Today | Assigned broker already | Looking-at wake text exists. Still not the copilot send. |
| lead-ingress | 5 | 3 | 4 | 4 | Keep | Session stitch already landed | Person exists. Header who/next/now landed (A3). |
| identity-dedup | 4 | 3 | 3 | 3 | Keep merge path | Dual-intent labels from tags + live work | One person. Notes still win if header is skipped. |
| suppression-guard | 5 | 4 | 4 | 5 | Never bypass | — | Fail-closed. P0 if any new send skips it. |
| sequence-run | 4 | 3 | 3 | 4 | Pause on reply already | Parked steps already on Today | Quiet lead is a sequence, not a second inbox. |
| cma-deliver | 4 | 3 | 4 | 4 | Keep engine | Address + comps already | Inbound packet names THIS home + this-address plan. Manual send. |
| bpo-deliver | 3 | 3 | 3 | 3 | Stay lender/offer | — | MERGE→cma-deliver surface. Never a buyer packet. |
| prospecting | 5 | 3 | 3 | 3 | Rewrite message + packet | THIS home’s DOM, ask, photos, list-kit plan | Detect / skip-trace / manual send work. Copy fails the bar. |
| listing-alert-care | 4 | 3 | 4 | 4 | Keep | — | Buyer alerts. Not Loop C. |
| visitor-escalate | 4 | 4 | 4 | 4 | Kill the extra email rail | Identified looking-at already wakes | Landed. Cron creates a 5-min call task. No Resend email. |
| content-approve | 4 | 3 | 3 | 4 | One yes on Today | — | Today Yes stamps via approveNowAction. Does not publish. |
| sync-ops | 4 | 3 | 3 | 4 | Keep | — | Not A/B/C. |
| data-curate | 3 | 3 | 3 | 3 | MERGE→sync-ops | — | Oversight, not a loop. |
| deal-track | 3 | 3 | 3 | 3 | One deal entity | Person ↔ `tc_deal` | CRM board redirects to Closings. SkySlope still live. |
| tc-close | 5 | 3 | 3 | 3 | One OREF fill → Matt email → seal | Deal facts + CRM parties | SkySlope is live. 001 overlay fills when field_map is empty. |
| weekly-sla-review | 3 | 3 | 3 | 3 | Oversight, not a wake | — | Human ritual. |
| reporting-truth | 3 | 2 | 3 | 3 | Do not rebuild | — | Sprawl. P4. |
| newsletter-run | 4 | 3 | 4 | 4 | Keep | Identity stitch landed | Loop D, not this build. |
| market-report-deliver | 4 | 3 | 4 | 4 | Keep | — | Not A/B/C. |
| site-content-ops | 3 | 3 | 3 | 3 | Thin KEEP | — | P4. |

**Leftover live forks (score as jobs, not new processes)**

| Fork | Q2 | Q4 | Disposition |
|---|---|---|---|
| CRM deals vs `tc_deals` vs SkySlope | 1 | 2 | P2/P3. SkySlope live until cutover. One in-house deal. |
| Today vs `/admin/approval-queue` vs `/admin/crm/approvals` | 2 | 3 | P2. One yes. |
| `expired-outreach.ts` / `fsbo-dashboard.ts` vs `/admin/prospecting` | 4 | 5 | Landed. Dead send actions refuse. Prospecting is the only cold send. |
| `lib/agent` vs Loop A | 3 | 3 | Reuse runtime. Different job (broker→agent). |
| Chrome Golf → `/lp/central-oregon-golf` | 3 | 4 | Not this pass. Paid arrival. Organic is `/central-oregon/golf/{slug}`. |

---

## Loop A / B / C gaps

### Loop A — Copilot

North star: “Tell me everyone I need to respond to” → who they are, what they wrote, what it means, the one next action, the draft → Matt yes → send → CRM records it as Matt.

**On disk now:** `/admin/today` ranks looking-at + inbound + parked + CMA drafts + ready approvals + due tasks. Inbound row is name + signal + Open/Dismiss. Ask preloads a buyer text. A3 header has who / next / now. A4 wake SMS is queued, not auto-sent.

**Landed (slice A):** inbound row shows who (closed set), what they wrote, `composePersonNextStep`, and a recommended SMS. Yes → `sendTodayInboundReply` → `sendCrmSmsAction` → `sendGovernedSms` → `crm_timeline` `sms_out` → dismiss so the row leaves Today. Email rows stay Open (no Yes-send-SMS). Empty draft disables Yes. Never auto-send. Sequence stays paused.

**Landed (P2 approval Yes):** a ready content row Yes stamps via `approveNowAction` (same as `/admin/approval-queue`). Does not publish. Does not text.

**Do not confuse with `lib/agent`.** That is the broker texting the marketing line. Loop A is agent→broker over **client** work.

### Loop B — Closings

North star: licensed library → fill from deal → send → file sealed PDF → PB review in 7 banking days. Brokers never build forms. SkySlope is the comparison, not the destination.

**On disk now:** `tc_form_versions` live (forms page: 111 versions, OREF 110/110). Anticipate / envelope / seal / commissions / PB sign-off exist. D2: SkySlope is the live file. `/admin/deals` dashboard still reads `skyslope_transactions`. `tc_deals.fub_person_ids` is dead. Person ↔ deal is `tc_deal_people` (many people, one file).

**Landed (slice B + P2 overlay):** one OREF from `tc_form_versions` → fill from deal facts + `tc_deal_people` names → Matt-owned email → seal. Empty live `field_map` on 001 15-page 01/2026 uses the checked-in overlay. Missing facts stay blank. No SkySlope write.

**Landed (P2 person↔deal):** `tc_deal_people` (unique `deal_id+person_id`, roles buyer|seller|other). Start a deal from the person. Parties on the deal page above lender/title contacts. Closings rows show party names. Dual-intent stays one person. Two houses = two deals.

**F1–F6:** Libraries 4 · Anticipate 3 · Fill 2 · Send 2 (SkySlope) · File 3 · Onboard 2.

### Loop C — Known sellers

North star: first MESSAGE and first DELIVERABLE blow them away. Know THIS home. Market THIS home. Same bar for expired, FSBO, and inbound valuation. Manual send.

**Live first-touch SMS (seed = production body, `20260718120300_seed_prospecting_templates.sql`):**

Expired (`expired-first-touch-sell-v1`):

> Hi, %sender_first_name% with Ryan Realty. I saw %address% came off the market without selling, so I put together a market analysis for it. Take a look when you get a chance: %cma_link% No pressure either way.

FSBO (`fsbo-first-touch-v1`):

> Hi, %sender_first_name% with Ryan Realty. I saw you are selling %address% yourself. No pitch, and good luck with the sale. I put together a market analysis for %address% that may help you price and negotiate. Want me to send it over? A little about us: ryan-realty.com/sell

**Live packet layer 2** (`lib/cma/expired-audit.ts` `buildThisHomeMarketingPlan`): hero names THIS address (listing video, flyer set, photo set). Secondary is walkthrough / weekly report / MLS. Render title is “How we would market {address}.” Not the old brochure heading.

**C bar (message + packet, not architecture)**

| | Expired | FSBO | Inbound valuation |
|---|---|---|---|
| C1 KNOW | Packet failure analysis can name THIS listing’s ask, DOM, cuts. SMS does not. | SMS names the address only. | Address-only step 1. CMA engine knows the house if built. |
| C2 MARKET | Rewrite names listing video, flyers, photo set for this house. Taste open. | Same this-address plan. No “a little about us.” Taste open. | Site 3% plan is the listing offer, not a first packet. |
| C3 MESSAGE | This-home analysis + this-address plan + link. Taste open. | Same. No brochure close. Taste open. | CTA is Value my home (Track 1). |
| C4 VOICE | No prior-agent blame. | No blame. Brochure close. | Worth-question gone on the button. |
| C5 TRUE | Engine traced. SMS invents nothing. | Same. | Same. |
| C6 STREAM | Rewritten template (seed-body UPDATE). | Rewritten template (seed-body UPDATE). | Packet copy aligned. Manual send. |

**Landed (slice C):** first-touch SMS + packet rewrite names THIS house and a this-address list-kit plan (video, flyers, photo set). Seed bodies UPDATE only when they still match the old seed. Still manual send. Matt taste on the copy is still open.

---

## Journeys (inception → artifact on the person)

| Journey | Today | Gap | Priority |
|---|---|---|---|
| Inbound SMS/email | Twilio / gmail-sync → person + timeline. Today shows a row. | No draft on the row. Open ≠ send. | P1 A |
| New lead | `ensureNativeLead` + alert + auto-enroll | Header exists. Copilot send does not. | P1 A |
| Value my home | Address-only → CMA worker → Valuations | First packet not at C bar | P2 |
| Expired | Delta detect → skip-trace → audit queued → Prospecting | Message + packet fail C1/C2 | P1 C |
| FSBO | Daily detect → CMA → Prospecting | Same | P1 C |
| Replies | Pause-on-reply inside sequence engine | Must appear on Today as the one next action | P1 A |
| Accepted offer | Human creates TC deal and/or SkySlope file | No create-deal from the person. Two stores. | P2 then B |
| Sequences | Auto-enroll + engine | Quiet lead is this, not a fourth inbox | P2 |
| Quiet lead | Sequence running, no inbound | Today should say the one next step or “nothing” | P1 A |
| New broker first week | Access + own-book scope | No one-week onboard. Closings still SkySlope. | P2 F6 |

Buyer path: inquiry/showing → search → offer → under contract → Loop B on the same person.
Seller path: value my home / expired / FSBO → CMA or audit → list → under contract → Loop B on the same person.

---

## 11 destinations (locked — extra weight)

| Destination | Extra weight | Finding |
|---|---|---|
| **Today** | Loop A home | Queue exists. Missing: what they wrote, one draft, yes → send. |
| **Messages** | Loop A thread | History + composer. Not the ranked “everyone.” |
| **People** | Who / next / now landed | Dual-intent must stay one person. |
| **Prospecting** | Loop C worklist | Send path is right (manual, claimed, fail-closed). C rewrite landed; Matt taste still open. |
| **Valuations** | CMA / audit / BPO | Engine KEEP. Expired layer 2 REPLACE. |
| **Closings** | Loop B | SkySlope live. In-house fill/send/file is the soon-use slice. |
| Oversight | — | Alarms land here, not a text. |
| Reports | — | Do not rebuild. |
| Audiences | — | Not A/B/C. |
| Content | — | Not A/B/C. |
| Settings | — | Templates live here. Rewrite C templates; do not add a 12th dest. |

---

## Ranked plan

### P0 — do not ship broken

- Unapproved send to a real person
- Suppression bypass
- Inbound SMS/email not on `crm_timeline`
- Invented number in a seller packet
- Worth-question on a seller CTA we would tap
- SkySlope write without Matt naming the live action
- Blame the prior listing agent
- Auto-send expired / FSBO / CMA

### P1 — first complete loops (start using it)

1. **A — Copilot yes-path.** **Landed.** Today inbound row: who, what they wrote, one next action, draft → yes → `sendGovernedSms` → timeline. Assigned-broker scoped.
2. **C — Blow-away first touch.** **Landed (code).** Expired and FSBO first message + packet name this home + this-address plan. Manual send. Matt taste still open.
3. **B — One OREF.** **Landed (code).** One form from `tc_form_versions` → fill from deal data + CRM parties → Matt-owned email → seal. No SkySlope mutation. 001 overlay when the live map is empty. Other form versions still omit.

### P2 — context that changes the action

- Person ↔ `tc_deal`; create-deal from the person — **landed** (many people, one file)
- `/admin/deals` list redirects to Closings (`tc_*`). SkySlope remains the live file until cutover
- Inbound valuation first packet aligned to the C bar — **landed** (compose only, manual send)
- Reply-on-thread is the Today row (already locked)
- One approval yes on Today — **landed** (stamp only, does not publish)
- Dual-intent stays one person (unique `deal_id+person_id`)
- OREF 001 field overlay — **landed** (15-page 01/2026 sample only)

### P3 — strip bloat

- Generic “every listing gets” as the hero of an expired audit — **landed** (this-home plan is the hero; tests pin the old heading out)
- Two (three) deal stores as the broker’s job — **landed** (`/admin/crm/deals` + pipelines + `[id]` redirect to Closings; Pipeline dropped from People nav). SkySlope remains the live file until cutover. `crm_deals` rows stay in the DB.
- Dead `expired-outreach` / `fsbo-dashboard` / `send-doc` send actions — **landed** (refuse; one send path is Prospecting)
- Visitor-escalate as a second email rail — **landed** (cron still creates a 5-minute call task for identified sessions; no Resend email)
- SkySlope rituals we do not need after one clean in-house packet — **not this land** (Matt must name a live action)
- A 12th destination — **not added**. Pipeline child removed.

### P4 — later

- Reporting collapse, FUB vocab, dark mode, full SkySlope cutover after one parallel deal
- Ads
- Social calendar / GBP week-grant (hard stops; not this audit’s first build)

---

## First build slices

| Slice | Done when | Unblocked vs Matt-gated |
|---|---|---|
| **A** Queue → one recommended SMS → yes → governed send → timeline | Matt can say “everyone I need to respond to,” tap yes, and the CRM shows `sms_out` | **Landed.** Send is still Matt-gated every time (Yes is the stamp). |
| **B** One OREF from `tc_form_versions` → fill → Matt-owned email → seal | Matt has a sealed PDF in his inbox from deal data | **Landed (code).** Email to Matt is a send (Matt-gated). Overlay covers empty 001 map. Other form versions still omit. |
| **C** One expired (or FSBO) first-touch rewrite | Message + packet name THIS house and how we will market THIS house. Still manual. | **Landed (code).** Send and “is it beautiful?” are Matt-gated. |

Build order: **A then C then B then P2 remainder then P3 leftovers that do not need Matt.**

---

## End-to-end goal (2026-08-13 /endtoend)

A broker can walk in and run the daily loops on one person and one file.

**What exists when finished**
- Today: inbound who / quote / draft / Yes (governed SMS). Ready drafts: Yes stamps the same approval as the queue. Nothing auto-sends or auto-publishes.
- People: Start a deal from the person. A deal holds many CRM people (buyer, seller, other). Dual-intent stays one person. Spouse/co-buyer can ride the same file.
- Closings: list is `tc_*`. Deal page shows CRM parties above lender/title contacts. One OREF 001 fills from deal facts onto the blank, emails Matt only, then seals. No SkySlope write.
- First packets (expired, FSBO, inbound valuation) name THIS home and how we would market THIS home. Manual send.

**What a real user does**
1. Open Today. Reply or stamp a draft. Yes is the stamp.
2. Open a person. Start a deal. Add the other parties.
3. Open the file. Fill OREF 001. Email to Matt when Matt says so. Seal.
4. Expired / FSBO / Value-my-home packet is a plan for that address, not a brochure.

**Bar**
Production READY on the same SHA as `origin/main`. Hosted `tc_deal_people` applied. A broker can click the surfaces without a second store or a second send path. Matt still gates every outbound message, every publish, Email to Matt, and packet taste.

**P3 leftover (2026-08-14 /endtoend) — READY `7392b788`**
A broker does not work a second send path or a second deal board.
- Prospecting is the only expired/FSBO send. Dead dashboard actions refuse.
- Identified hot visitors become a Today/task (broker-alert). No extra Matt email.
- People nav has no Pipeline. Bookmarks to `/admin/crm/deals` land on Closings.
- Packet hero stays the this-home plan.

**Not this mission:** ads, SkySlope cutover, auto-send, public-site leftover, `stash@{0}`, a 12th destination.

**Leftover-todo pass (2026-08-14)**
Work the leftover list an agent can finish. Matt-gated sends stay parked.
- CRM Pipeline islands deleted. `/admin/crm/deals*` stay redirect bridges. Gated absent in `check-dead-ui`.
- OREF maps: live `tc_form_versions` is 111/111 `field_map=[]`. Overlay remains 001 / 15-page / 01/2026 only. No other sample blanks on disk. Do not invent geometry.
- Seller-net 400-sale print: `docs/research/pricing-backtest-2026-08-14.json`. Close MAPE 2.76% (97.3% within 10%). Seller net MAPE 2.54% on 384 priced rows (97.9% within 10%). 36 starved (<3 comps). Filter and cite in that file.
- Pre-2024 concessions YN: 2024+ is 100%. 2023 is 73.7%. 2018–2022 is 21–34% and those stamped rows are Yes only (0 No). Drain stays the existing cron RPC. Do not TOAST-scan `listings.details`.
- Seller-net gate debt: `pricing_subdivision_cells` no longer uses `CURRENT_DATE` in the MV body. Window is `pricing_index_window.cells_since`. Hosted applied `20260814132710`. Snapshot + DAL index refreshed so `ci:migration-drift` and `ci:mv-determinism` pass.
- Not this pass: Yes on Today, C taste, Email to Matt, publish, SkySlope cutover, referral agreement.

---

## Skills read this pass

admin-product-os (orient only — did not grind its leftover queue), crm-e2e (awareness), PUBLIC_PRODUCT/decisions.md locks, ia-lock 11 destinations, process-registry 21, prospecting + tc-close PDS, live templates + `expired-audit.ts` + `/admin/today`.
