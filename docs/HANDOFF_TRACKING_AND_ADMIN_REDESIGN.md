# Handoff — Visitor Tracking Policy + Admin (Mobile CRM) Redesign

**Author:** Claude Code session 2026-06-16 · **Branch:** `main` · **HEAD at handoff:** `9f4af753`
**Read order:** this doc → [`docs/MOBILE_CRM_FUB_PARITY.md`](MOBILE_CRM_FUB_PARITY.md) (the design contract) →
[`docs/CONSOLE_KIT.md`](CONSOLE_KIT.md) (the admin design system) → the files cited below.

This is a self-contained handoff for two parallel initiatives that ran together:

1. **The admin / mobile-CRM redesign** — make the broker console match (and beat) the Follow Up Boss
   mobile app, and stop it looking like a generic data-entry form. **Shipped.**
2. **The visitor-tracking & identity policy** — own every visitor's behavior in *our* CRM (Next.js +
   Supabase), de-anonymize sessions deterministically, and drop the dependence on Follow Up Boss.
   **Phase 0 shipped (email-click identity stitch + named-people feed); Phases 1–5 specced, not built.**

The North Star for both: **FUB is being decommissioned.** Everything must be CRM-native, owned in our
own Postgres, and at least as good as FUB on the broker's phone.

---

# PART 1 — Admin / Mobile-CRM Redesign

## 1.1 What this was

The broker console (`/admin/console/*` and `/admin/(protected)/*`, both wrapped by `ConsoleShell`) drifted
into a cramped, form-heavy "data dump." Matt's bar is the **FUB mobile app** — he sent ~20 reference
screenshots (saved in the two `matt@ryan-realty.com` emails "Fub screenshots" / "Fun screenshots 2",
2026-06-16; pulled locally to `tmp/fub-reference/` via `scripts/_fub-screenshots-download.mjs`). The
durable design contract is [`docs/MOBILE_CRM_FUB_PARITY.md`](MOBILE_CRM_FUB_PARITY.md) — **read it; it is the
saved target and lists every FUB pattern + our "beat it" notes.**

## 1.2 The design language (match this for any new console surface)

- **Register:** neutral Linear/Notion. Tokens come from the `.console-root` scope in
  [`app/admin/console/console-theme.css`](../app/admin/console/console-theme.css) — fully grayscale
  (`--primary` is dark charcoal `oklch(0.255 0 0)`, NOT navy), with `--console-info` (calm blue) as the only
  accent. **Do not** put brand navy/cream in the console — Matt's directive: "ultra intuitive, brand-free."
- **Dark identity header band** (the FUB signature): for detail screens, a full-bleed `bg-primary
  text-primary-foreground` band carries the avatar + name + key meta + a white/`--console-info`-underline tab
  row. See `LeadTabs` (below) for the canonical implementation. This is what made the lead detail stop looking
  like a form. **Roll this same band onto the other detail/list surfaces** (inbox, people, dashboard) — that
  is the main remaining redesign work.
- **Build from the console kit** (`@/components/ui/*` shadcn + `@/components/console/*`). Raw `<button>` /
  hand-rolled cards FAIL `ci:design-tokens`. Chips/segments use `<Button variant=… size="sm"
  className="rounded-full">`. Horizontal scroll tracks need `no-scrollbar`. 7-col grids need a `sm:grid-cols-7`
  variant (the `ci:admin-responsive` gate flags bare `grid-cols-N≥3`). No arbitrary Tailwind utilities like
  `pb-[max(...)]` (D17–D22 ladder gate) — use `pb-6`.

## 1.3 What shipped (commits, newest → oldest)

| SHA | What |
|---|---|
| `cb2de579` | **Lead detail redesign** — dark identity header band + clean tabs + Call/Text/Email row |
| `f3f437ee` | Friendly, context-aware empty states (leads list) |
| `a3da9a74` | Month calendar on the dashboard (`MonthCalendar`) |
| `c07fd4f6` | "Online now" live list in People → All Lists (our live-intent edge over FUB) |
| `e718b960` | Inbox filter bottom-sheet (Emails / Texts / Calls type filter) |
| `6a168b49` | People "All Lists" — `crm_saved_views` with live counts + Stages/All-lists toggle |
| `48cb2ada` | Live per-stage counts on the leads stage chips |
| `0d085f80` | Segmented inbox — Inbox / Assigned / Sent with live counts (`InboxSegments`) |
| `3903f57b` | Design-token fix (Button chips + no-scrollbar) |
| `1a8ac34d` | `ci:admin-mobile-shell` gate re-pointed at ConsoleShell (was checking retired AdminHeader/Sidebar) |
| `898e76cc` | **Base:** tabbed lead detail (`LeadTabs`), context-aware "+" FAB (`ConsoleQuickAction`), segmented dashboard feed |
| `9f4af753` | Named-people "Right now" feed + the email-click identity stitch (see Part 2) |

## 1.4 Key files

- [`components/console/LeadTabs.tsx`](../components/console/LeadTabs.tsx) — **client.** The dark identity
  band + 6 mobile tabs (Overview · Comms · Tasks · Watching · Workflow · Activity). On `< lg`: one tab at a
  time. On `lg`: band shows identity, tabs hide, every section visible single-scroll. Reads `location.hash`
  → selects the owning tab (so the FAB / header anchors deep-link). Pure presentation — every server-action
  form inside a slot is unchanged. Gated by `ui_kits/lead-command-center/parity.json` (requires `LeadTabs`).
- [`components/console/ConsoleQuickAction.tsx`](../components/console/ConsoleQuickAction.tsx) — **client.**
  The global "+" FAB, mounted in `ConsoleShell` so it rides every console + protected surface. On a lead it
  pre-targets that lead, surfaces the recommended next action (`getNextRecommendation`), adds Enroll-in-
  workflow + Start-a-CMA; off a lead it shows the global create set. Lead-scoped actions are bare-hash
  anchors (`#comms`) so `LeadTabs` switches tab on click (a Next `<Link>` would `pushState` and not fire
  `hashchange`).
- [`components/admin/DashboardActivityFeed.tsx`](../components/admin/DashboardActivityFeed.tsx) — **client.**
  The "Right now" feed. **Now shows NAMED PEOPLE** (On the site / Email / New leads), each linking to the
  lead. See Part 2 for the data behind it.
- [`components/admin/InboxSegments.tsx`](../components/admin/InboxSegments.tsx) — **client.** Inbox / Assigned
  / Sent segments + the type-filter bottom-sheet. (Closed + unread omitted — no read-state on the timeline.)
- [`components/admin/MonthCalendar.tsx`](../components/admin/MonthCalendar.tsx) — **client.** Month grid +
  per-day list on the dashboard. `todayIso` passed from the server (no hydration mismatch).
- [`app/admin/console/leads/[id]/page.tsx`](../app/admin/console/leads/%5Bid%5D/page.tsx) — the lead detail
  (server). Feeds identity into `LeadTabs` + the panels into slots.
- [`app/admin/(protected)/broker-dashboard/page.tsx`](../app/admin/(protected)/broker-dashboard/page.tsx) —
  the single home. Live tiles + the named-people feed + month calendar.
- [`app/admin/console/leads/page.tsx`](../app/admin/console/leads/page.tsx) — the leads list (People): Stages
  chips w/ counts ↔ All-lists toggle (`crm_saved_views`) + the "Online now" live chip.

## 1.5 Gotchas learned

- **Preview screenshots are NOT visible to Matt.** `preview_screenshot` renders inline in the agent's tool
  output only. Verify with it, but to show Matt, give a **live URL** or send an image file — never say
  "screenshot above."
- **The worktree dev server vs Matt's localhost.** Work happens in a git worktree and pushes to remote
  `main`; Matt's own `localhost:3000` serves his *main checkout* and won't show pushed changes until he
  pulls. Production (Vercel, `main`) reflects pushes after deploy. State this when asking him to look.
- **HMR DOM ghosts.** A long-lived preview tab accumulates orphaned Fast-Refresh DOM (looked like a
  "double-mount"); the raw SSR HTML is the source of truth (`fab=1`, `sidebar=1` → single render). Don't
  diagnose layout bugs from a stale preview tab.

## 1.6 What REMAINS on the redesign

1. **Roll the dark identity band onto the other surfaces** (inbox, people/leads list, dashboard) so the whole
   mobile console matches FUB, not just the lead detail. (Matt dismissed the "do it everywhere?" question
   twice — proceed and show him; the lead detail is the proven pattern.)
2. **Lead-detail body polish** — the stage/owner `[select][button]` rows still read form-y; FUB shows them as
   tappable rows (label left, value + chevron right). Converting to auto-submit-on-change needs a small client
   wrapper (server components can't take an `onChange`).
3. Pre-existing, **not** caused by this work, left intentionally (domain-sensitive / separate initiative):
   - `ci:no-staging-host` fails on `app/actions/tc-envelopes.ts` + `lib/tc/seal-envelope.ts` (a `vercel.app`
     fallback — per the `project_domain` note that is *currently* prod; do not change blind).
   - `ci:mockup-parity` fails on city/community/listing-detail (missing `SectionNav`/`TextMattCTA` — a public
     -site initiative).

---

# PART 2 — Visitor Tracking & Identity Policy

## 2.1 The policy (the verdict)

Own the behavioral graph **in our CRM**. Identify people **deterministically**. **Do not buy reverse-IP
de-anonymization.** Drop FUB as the system of record for web behavior.

- **Build, don't buy, the event store** — write events straight into Supabase Postgres; it's the CRM's spine.
- **Deterministic identity only** — email/SMS link click, OAuth/One-Tap, form fill, login. These are accurate
  and safe for *consumer* leads.
- **Skip RB2B / Vector / Opensend / Retention.com** — they are B2B reverse-IP tools. Match rates are ~10–30%
  even on B2B and far worse on residential/mobile consumers, US-only, with privacy-law risk. Useless for a
  brokerage's home buyers/sellers. ([coldiq](https://coldiq.com/blog/rb2b-vs-vector),
  [abmatic](https://abmatic.ai/blog/top-tools-to-de-anonymize-your-website-visitors-a-comprehensive-review))

## 2.2 Cookie & identifier strategy (the load-bearing fact)

- **JavaScript-set cookies (`document.cookie`) are capped at 7 days by Safari ITP. Server-set first-party
  `Set-Cookie` cookies persist up to ~400 days** — *only* when set first-party on our own domain/IP
  (cross-host "tracking server" setups get re-capped at 7 days). URLs with *known* tracker params (`fbclid`,
  `gclid`) drop to 24h. ([seresa.io](https://seresa.io/blog/data-loss/server-side-cookie-setting-in-2026-why-your-server-can-set-cookies-safari-cannot-kill),
  [Stape](https://stape.io/blog/safari-itp))
- **We are on the winning side already.** `fub_cid` is set via Next.js `cookies().set()` (httpOnly, first-
  party, same origin). Our `_fuid` param is custom (not on Safari's known-tracker list) so it won't trigger
  the 24h cap.
- **To add:** a durable anonymous **`rr_vid`** (random UUID, server-set httpOnly, ~400-day) set in
  `middleware.ts` on first request, before any JS. `rr_vid` is the anonymous browser key; it gets stitched to
  a `person_id` on the first deterministic signal. **Never set the visitor ID from JS.**

## 2.3 What already exists (Phase 0 — SHIPPED, `9f4af753`)

The full identity chain was already built but never *triggered*, because our own outbound emails/texts only
stamped `?agent=` on links — never the recipient's id. Fixed:

- [`lib/crm/merge.ts`](../lib/crm/merge.ts) `attributeSiteLinks(text, brokerSlug, fubPersonId?)` now also
  stamps **`?_fuid=<fub_legacy_id>`** on every `ryan-realty.com` link.
- Wired into the **manual CRM email** + **manual SMS** sends ([`app/actions/crm.ts`](../app/actions/crm.ts)
  `sendCrmEmailAction` / `sendCrmSmsAction`) and the **automated sequence engine**
  ([`app/api/cron/crm-sequence-engine/route.ts`](../app/api/cron/crm-sequence-engine/route.ts) `renderMerge`).
- The landing chain (already present): [`components/FubIdentityBridge.tsx`](../components/FubIdentityBridge.tsx)
  reads `?_fuid=` on load → [`app/actions/fub-identity-bridge.ts`](../app/actions/fub-identity-bridge.ts)
  `identifyFubFromEmailClick` sets the `fub_cid` cookie (httpOnly, 90d) + calls `backfillSessionToFub`
  ([`lib/visitor-backfill.ts`](../lib/visitor-backfill.ts)) to attribute prior anonymous events.
- **Net effect:** any contact who clicks any link in any email/text we send is now cookied to their record and
  their anonymous sessions are backfilled. Anonymous → named, on every send.
- Also Phase 0: the dashboard feed now shows **named people**, not session IDs — new actions
  `getRecentWebsiteVisitors` / `getRecentEmailPeople` in [`app/actions/crm.ts`](../app/actions/crm.ts) resolve
  `crm_timeline` `web_event` / `email_*` rows to named `crm_people` (latest per person, broker-scoped).

> **Note:** Phase 0 uses FUB's `fub_cid`/`fub_person_id` plumbing. Phases 1–5 migrate the system of record to
> our own `rr_vid` + Postgres so FUB can be removed. Keep both working during the transition; the join key is
> `crm_people.fub_legacy_id ↔ fub_person_id`.

## 2.4 Granular event capture (Phase 2 — TO BUILD)

A tiny first-party tracker (our own app code, no third-party domain) that batches to our endpoint:

- **Page views** — hook App Router route changes (`usePathname`/`useSearchParams` effect; RSC navigations
  don't fire a full load).
- **Section/element engagement** — `IntersectionObserver` on tagged blocks (listing photos, map, mortgage
  calc, schools) → "viewed section X for N s."
- **Scroll depth** — 25/50/75/100% milestones.
- **Active dwell** — accumulate time only while the tab is visible (Page Visibility API), not wall-clock.
- **Listing views, saved searches, search/filter usage, clicks, outbound CTAs.**
- **Delivery** — `navigator.sendBeacon` on `visibilitychange`/`pagehide` + batched `fetch(keepalive)`.

This beats FUB's pixel, which records page views, **property views**, saved searches, and "online now" on the
lead ([FUB Pixel](https://help.followupboss.com/hc/en-us/articles/360037775174-Follow-Up-Boss-Pixel-Overview)).

## 2.5 Postgres schema (Phase 3 — TO BUILD)

One ingest endpoint (`/api/track`, extend the existing
[`app/api/visitors/track/route.ts`](../app/api/visitors/track/route.ts)) reads `rr_vid` + `fub_cid` from
cookies (**never trust the body for identity**) and inserts:

- `visitor_events` — `(id, vid, person_id null, session_id, ts, type, path, listing_key, section,
  scroll_pct, dwell_ms, referrer, utm, props jsonb)`. Append-only, month-partitioned. Index `(person_id, ts)`.
- `visitor_sessions` — already exists; keep as session rollup.
- `visitor_identity_map` — `(vid, person_id, identified_at, method)` — the stitch ledger.

## 2.6 Identity-stitch flow (Phase 4)

`rr_vid` is anonymous until a deterministic signal: **email/SMS click (`_fuid`)** → **One-Tap** → **form/login**.
On any: write `visitor_identity_map(vid → person_id)`, set the cookie, and **backfill** all prior
`visitor_events` for that `vid` (re-point `backfillSessionToFub` at Postgres instead of FUB). From then on
every event resolves to the named person.

## 2.7 Feed the CRM timeline (Phase 5)

Two surfaces on the lead: a **live "currently on /listing/X, photos 40s"** panel, and **digested
`crm_timeline` web_event rows** ("Viewed 21042 Robin Ln · 3 photos · mortgage calc · 2m"). No FUB round-trip.

## 2.8 "Get their Google info" (One-Tap on the Next site)

[`/api/fub/identify`](../app/api/fub/identify/route.ts) already verifies a Google One-Tap ID token (and FB)
server-side and resolves email + name — but it's wired for the WordPress site. **Next aggressive step:** put
the Google One-Tap prompt on the Next.js app so *any* Google-signed visitor (not just email-clickers) is
named on the spot, then stitch `rr_vid → person`.

## 2.9 Compliance (US, first-party)

CCPA/CPRA is **opt-out, not opt-in** — first-party behavioral tracking for our own use can load by default;
the obligation is a clear "Do Not Sell/Share" opt-out + privacy policy, with (2026) symmetric accept/decline
and no dark patterns. First-party tracking of known leads who clicked our email is defensible; risk lives in
*selling/sharing* to ad networks (we won't). TCPA is a **separate** concern on the outreach side (calls/texts).
([Usercentrics](https://usercentrics.com/us/knowledge-hub/ccpa-cookie-banner/),
[CookieYes](https://www.cookieyes.com/blog/cpra-cookie-consent/))

## 2.10 Buy vs build

| Need | Verdict |
|---|---|
| Behavioral event store | **Build** — Supabase Postgres; own it |
| Identity resolution | **Build** — deterministic; mostly done |
| Reverse-IP de-anon (RB2B/Vector/Opensend) | **Skip** — B2B-only, poor for consumers, legal risk |
| Product analytics (funnels/retention) | **Optional** — self-host PostHog later; not required for the CRM |

---

# PART 3 — Conventions, gates, verification

- **Workflow:** single checkout, push to `origin/main` immediately after each commit. The session worked in a
  git worktree and pushed `HEAD:main`. Concurrent automation pushes to `main` often → `git fetch && git rebase
  origin/main && git push` in a small retry loop.
- **Pre-commit hook** runs `ci:brand-voice` + the full `vitest` suite (601 tests). **Pre-push** runs
  `tsc --noEmit` (G46 self-containment). Both must pass.
- **Gates a console change must keep green:** `ci:design-tokens`, `ci:console-kit`, `ci:admin-responsive`,
  `ci:admin-mobile-shell`, `ci:mockup-parity` (lead-command-center), `ci:dal-boundary`, `ci:data-access`,
  `ci:dead-ui`, `ci:nav-reachability`. Run `npm run ci:gates` before shipping a user-facing surface.
- **No ad-hoc SQL** — read `docs/DATABASE_SCHEMA_SNAPSHOT.md` + `docs/DAL_INDEX.md` first. A genuine one-off
  data audit must be prefixed `-- audit: <reason>` (a hook enforces this on `crm_people`).
- **Verify in the browser** at 390px before claiming a mobile surface done; a green gate is never design
  sign-off.
- **The WRITE hook false-positives on PostgREST `!inner`** (reads `!` as a banned exclamation). Use a plain
  embed (`crm_people(...)`, left join — equivalent when the FK is NOT NULL) or build the string at runtime.

## Immediate next actions (in order)
1. Tracking **Phase 1** — `rr_vid` first-party cookie in `middleware.ts` + extend `/api/visitors/track` to the
   richer event shape + the `visitor_events` / `visitor_identity_map` tables (migration).
2. Tracking **Phase 2** — the granular client tracker (sections/scroll/dwell, sendBeacon, App Router routes).
3. Admin — roll the dark identity band onto inbox / people / dashboard; convert the lead-detail stage/owner
   rows to tappable FUB-style rows.
4. Wire Google One-Tap onto the Next.js site (§2.8).
