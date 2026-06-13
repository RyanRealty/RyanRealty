# Handoff — Laurie McAdam CMA + Valuation-Form upgrade + Twilio SMS block (2026-06-13)

**Written:** 2026-06-13 by Claude Code (Opus). **Branch:** `main`. **HEAD at session start:** `91e531e6`.
**Nothing in this thread is committed.** Three independent threads below. The working tree ALSO holds unrelated in-flight work (homepage v6, trails, brand-voice rework) — see the main [`CROSS_AGENT_HANDOFF.md`](./CROSS_AGENT_HANDOFF.md). **Do NOT `git add -A`.** Stage only the files listed per thread.

The other agent can't read the chat. Everything needed is here + in git + memory `reference_twilio_a2p_status`, `feedback_*`. User: Matt Ryan, principal broker.

---

## Thread A — CMA for 62285 Deer Trail Rd, Bend (Laurie McAdam) — DRAFT, awaiting Matt's "ship it"

A real seller lead (FUB person 27022, cold-lead, ready-now). CMA built end-to-end via `marketing_brain_skills/producers/cma/SKILL.md`. Action row `72c4ee55-654a-45b0-8853-ec091e390ff7` is set to **`ready`**.

**Subject was NEVER on the MLS** — profile reconstructed from Deschutes County DIAL (authoritative):
- Tax account `109489`, taxlot `171332B001300`, owner McAdam (matches lead)
- 4.78 ac, **MUA10 + Airport Safety overlay**, Legal Lot of Record, wetland present, not in floodplain. Dwelling fully conforming (no EFU risk).
- House ~2,290 sqft, one-story+attic. Assessor YB 1972, but full 1991 permit set (bldg/elec/mech/plumb/**septic finaled**) → effective ~1991, installed septic. 210 sqft shed.
- Private domestic well (corridor-confirmed via OWRD; subject's own log not geocoded — flagged seller to provide). RMV $1,193,630.
- **Open item:** subject beds/baths NOT in county records → CMA says "confirm with seller". Condition unverified = the swing factor that could lift the high end.

**Valuation:** recommended list **$975,000**, range **$925,000–$1,025,000**, Moderate confidence. Anchored by the same-street twin **62315 Deer Trail** (identical 4.78 ac, 1972, sold $965K May 2025). 6 comps. Three methods converge (M1 $973,250 / M3 $948,000; M2 $860,000 low because condition unverified). Full data + adjustments + verification verdict in `out/cma-62285-deer/build-spec.json` and `citations.json`.

**Verification:** independent adversarial pass run (separate agent). Verdict **PASS-with-dispositioned-flags** — 5 flags found and ALL fixed: sale-to-list corrected to 95.5%, Legal-Lot-of-Record buildability note added, Dodds net-zero annotated, prose em/en-dashes + semicolons purged. Page-fit zero-bleed (17 pp), PDF 7.62 MB (<25 MB cap), brand-voice clean. All comp figures re-verified against Supabase + DIAL + OWRD.

**Files (Thread A):**
- `public/drafts/cma-62285-deer/cma.html` + `assets/` — the draft (gitignored path)
- `out/cma-62285-deer/` — pdf, citations.json, build-spec.json, render/QA scripts (gitignored)
- `app/api/maps/cma-62285-deer/route.ts` (NEW, untracked) + entry in `lib/cma-map.ts` + `lib/data/index.ts` (getCmaMap registration) — the branded Google static map
- Local preview link (dev server must be running): `http://localhost:3000/drafts/cma-62285-deer/cma.html`

**ON MATT'S "SHIP IT" (per CMA SKILL.md Steps 14-15):**
1. Move `public/drafts/cma-62285-deer/` → `public/cmas/cma-62285-deer/`
2. Upsert `public.cmas` + insert `public.cma_comps` (6 rows)
3. `git add` the `public/cmas/cma-62285-deer/` files + `app/api/maps/cma-62285-deer/route.ts` + `lib/cma-map.ts` + `lib/data/index.ts`; commit + push
4. Set action row → `approved` → `executed`
5. Fire `POST /api/cma/cma-62285-deer/finalize-deliver` (Gmail draft to Laurie, BCC FUB). **Matt sends personally.**
   - NOTE: Matt already texted Laurie from his personal phone asking for the clarifying info (beds/baths, roof/furnace/AC age, improvements, condition). Fold her reply into the CMA before finalizing if it arrives.

---

## Thread B — Valuation form "About your home" section + CMA skill upgrades — ✅ COMMITTED `5c70a510` (pushed origin/main 2026-06-13)

Matt directive: add an optional, intuitive section to the seller valuation form (roof/furnace/AC age, improvements, beds/baths, condition) that flows into CMA logic, and bake the behavior into the skill.

**Wired end-to-end** (verified: route 200, `tsc` clean on these files, browser-rendered):
- `app/lp/seller-home-value/SellerLPForm.tsx` — collapsed-by-default "+ Add home details" section: beds/baths, roof/furnace/AC age, improvements textarea, approx invested, condition Select. All `@/components/ui/*`.
- `app/lp/seller-home-value/actions.ts` — `SellerLPSubmission.homeDetails` + `SellerHomeDetails` type; passes through.
- `lib/cma-request.ts` — `CreateCmaRequestInput.sellerHomeDetails`; compiles into `marketing_brain_actions.payload` as structured `home_details` + readable `seller_improvements` + `seller_improvements_total`, and into the `cmas` row notes.

**CMA skill** `marketing_brain_skills/producers/cma/SKILL.md` (4 durable rules added, all dated 2026-06-13):
- **Step 3.6** — resolve water+sewer (septic via DIAL Permits, well via OWRD GIS) for any non-municipal property; adjust only if subject lacks one vs comps.
- **Step 5** — when subject has no MLS photo, use an aerial (Google satellite) on cover + subject hero, not a blank panel; comp photo cards must render well (≥90px, 640×480 tier).
- **QA gate** — DOM always shown (table column + every comp flyer).
- **CMAPayload** — added `home_details`; recipe consumes beds/baths (fill gaps), system ages (effective age + Method 2 value-add), condition (high-end check).

**Files (Thread B):** the 3 code files above + the SKILL.md — all committed in `5c70a510` (Matt approved in chat; form draft shown). (The other seller form — `home-valuation/ValuationForm.tsx` — was NOT touched; it doesn't create CMA rows. Add the section there later if Matt wants parity.)

---

## Thread C — Twilio SMS is BLOCKED (A2P 10DLC under review). Full detail in memory `reference_twilio_a2p_status`.

FUB is dead for texting — main line **541.703.3095 ported FUB → Twilio**. ALL Twilio outbound SMS fails **error 30034** (confirmed empirically both paths 2026-06-13). Cause: A2P campaign `CMb1d8153a2afc36416efae44c196c7d46` (Low Volume Mixed) is **IN_PROGRESS / under carrier review — Twilio console says ~2-3 weeks.** Brand `BN6164…` is APPROVED. Nothing broken on our side; no self-serve fix.

**Done this session:**
- Filed Twilio support ticket **#27497858** (help.twilio.com/tickets/27497858) to expedite — the only lever.
- Added 541.703.3095 to Messaging Service `MG592bf…` pool (covered the instant the campaign clears).
- `scripts/render-worker.mjs` got an iMessage "draft ready" notify on the ready-flip (STAGED, uncommitted).

**Until approved:** reach leads via personal phone or email. Do NOT rely on Twilio SMS. Next agent: check campaign status every day or two; when it flips to registered, SMS goes live via Messages API (`MessagingServiceSid=MG592bf…`).

---

## Architecture finding (important) — auto-CMA / render-worker

- `scripts/build_cma_wrapper.py` is a **STUB** — it copies the old Tumalo example CMA and relabels it. **Do not wire it to the queue** (would ship a wrong-property CMA, §0 violation). Real CMAs are built by the agent running the SKILL (what was done here).
- The cloud cron defers visual producers to `scripts/render-worker.mjs`, but that worker is **not scheduled** (no launchd entry was active). A launchd plist exists on disk at `~/Library/LaunchAgents/com.ryanrealty.render-worker.plist` but is **NOT loaded** (held pending the decision below).
- Matt's decision for auto-CMA: **headless-agent-per-request** (a launchd worker invokes a headless `claude` agent to build each CMA correctly + notify). **NOT yet wired.** This is the next build if Matt wants CMAs to run unattended.

---

## State / running processes

- **Dev server running:** `npx next dev -p 3000` (backgrounded, log `tmp/cma-dev.log`). Started to render/preview the CMA + form. **Kill it when done** — a live `next dev` grows `.next/dev/cache/turbopack` unbounded (see memory `reference_mac_mini_disk_cleanup`).
- **Nothing committed.** `git add -A` is dangerous here (unrelated homepage/trails/voice work in tree). Stage per-thread file lists only.

## Next actions
1. Matt reviews the CMA PDF → on "ship it", run Thread A steps 1-5.
2. ~~Commit Thread B~~ ✅ DONE — committed + pushed `5c70a510` (2026-06-13).
3. Poll Twilio campaign; ping Matt when registered.
4. If Matt wants unattended CMAs: wire the headless-agent auto-CMA worker + load the launchd plist.
