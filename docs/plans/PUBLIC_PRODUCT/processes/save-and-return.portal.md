# Process: save-and-return.portal — Portal save-and-return (signed-in account hub)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (inception fires on any engaged organic/direct/internal session,
  24/7; the return leg is visitor-paced and recalled by the sibling alert loop)
- Verdict: **PROPOSAL — KEEP.** The portal is the retention half of the machine: it is where
  every durable artifact the other processes capture (saves, likes, alerts, areas, places,
  views) becomes a reason to come back, and it is the only surface where a visitor's identity,
  CRM record, and behavioral trail are bound together. Proposal for P3: treat the three
  `save-and-return.*` registry rows as ONE process family — this row carries the destination;
  `search-alerts` and `guest-alert-capture` are its machine recall-loop and its anonymous
  on-ramp, and neither implies a separate destination. Proposal only; the verdict locks at P3
  in `decisions.md`.
- Last evidence pass: **2026-08-11** (every file:line below opened this session)

## 1. Purpose

(a) A visitor turns an anonymous browse into a durable personal workspace — an account whose
portal holds every home they saved or liked, every alert with what is new since they last
looked, their named map areas, places they follow, and their own viewing trail — so a return
visit resumes the search exactly where it left off instead of starting over. (b) The machine
outcome is a persistent identified relationship — a Supabase auth user stitched to the
`crm_people` record and the first-party visitor graph, generating recurring attributable
return visits — which serving (a) produces directly, because saved state is only worth
creating if the visitor comes back to consume it, and every consumption visit is a warm,
identity-stamped re-engagement the CRM can see and the broker can act on.

## 2. Inception (what starts it)

Trigger: an engaged **organic / direct / internal** visitor creates an account or signs back
in. Paid and outreach traffic is deliberately excluded from the auto-prompt (they have their
own funnels or are already identified). Preconditions: none — inception is anonymous by
definition; the save-bounce path additionally requires a save click while logged out.

| Entry | Mechanism | Evidence (opened this run) |
|---|---|---|
| Auto-prompt | Global sign-in modal fires on the **2nd pageview of a session** after a 1s delay, offering Google/Facebook OAuth with a three-benefit alerts+portal pitch | `components/SignInPrompt.tsx:103-125` (engagement gate + timer), `:161-173` (pitch copy), `:22-30` (sessionStorage pageview counter) |
| Auto-prompt suppressions | Never fires for paid clicks (`fbclid`/`gclid`/`msclkid`/`ttclid`/any `utm_*`), outreach links (`?agent`/`_pid`/`_fuid` — dismissed for the full 24h window), `/lp/*`, lead-form pages (`/contact`, `/sell`), auth pages, 404s, or within 24h of a dismissal | `components/SignInPrompt.tsx:84-101` (ad + outreach detection), `:71-80` (LP/auth/lead-form), `:56-59,114,121-123` (404 flag re-check), `:32-51` (24h dismissal) |
| Mount point | Modal is mounted globally via the code-split public client layer (never on `/admin`, hidden on `/lp/*`); session state comes from a client fetch of `/api/auth/me` so the page HTML stays CDN-cacheable | `components/layout/PublicClientLayer.tsx:27,45-50`; `app/layout.tsx:166`; `components/layout/SignInPromptWithSession.tsx:13-27`; `app/api/auth/me/route.ts:1-25` |
| Save bounce | A logged-out "Save" click on any listing stashes the listing key in sessionStorage and redirects to `/login?next=<current page>` | `components/listing/SaveListingButton.tsx:69-80` (bounce on `Not signed in`); `lib/pending-save.ts:19-26` (stash), `:45-50` (redirect) |
| Direct | `/login` and `/signup` (both noindex; `next` defaults to `/account`), password or one-tap OAuth | `app/login/page.tsx:17,22-24`; `components/auth/LoginForm.tsx:7,21-41` |
| Guard-driven | Any logged-out hit on `/account/*` or `/dashboard` redirects to `/login?next=<requested path>` | `app/account/layout.tsx:17-24`; `app/dashboard/layout.tsx:14-17` |
| OAuth mechanics | Browser-initiated PKCE (`signInWithOAuthBrowser`) so the code-verifier cookie survives to the callback; `redirectTo` carries `next` | `lib/supabase/oauth.ts:26-38` |

## 3. Actors

- **Buyer-leaning visitor** — the primary segment: every artifact the portal accrues (saves,
  likes, alerts) is captured with canonical `audience: 'buyer'` tagging in the sibling write
  paths (`app/actions/saved-searches.ts:192-208`). Owners and dreamers use the same account;
  nothing in the portal is buyer-gated.
- **Returning account holder** — the actor of the completion leg; they alone decide when to
  return (the sibling alert-email loop is the machine's recall lever).
- **Device reality:** mobile 390 is Matt-locked product truth (`decisions.md` 2026-08-11).
  A GA4 device split for `/account` was NOT queried this session and is therefore not stated
  (§0); pulling it is a P4/P8 gap item.
- **Automated actors:** the OAuth callback machine steps (CRM sign-in event, avatar capture,
  `rr_pid` stamping, identity stitch, guest-alert claim — `app/auth/callback/route.ts:30-86,
  133-158`); the site's own instrumentation writing `user_events` rows the portal later reads
  (`lib/data/activity/getUserEvents.ts:9-12`); the hourly `saved-search-alerts` cron
  (`vercel.json:213-214`) that generates the return trigger — it belongs to
  `save-and-return.search-alerts`, not this process.
- **Accountable for completion:** the visitor (returning is theirs); the system is
  accountable for state fidelity — every number and list on the portal must equal what they
  actually saved (`app/account/page.tsx:101-105` states this contract in-file).

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| The account | Supabase auth (`auth.users` + session cookies via `@supabase/ssr`) | `app/auth/callback/route.ts:123-126` (code exchange); `app/api/auth/me/route.ts:20-23` |
| Saved homes | `public.saved_listings`, keyed by canonical RETS ListingKey | `app/actions/saved-listings.ts:42-55` (write + canonical-key resolution), `:24-40` (read rationale) |
| Liked homes | `public.likes` | `app/actions/likes.ts:13,25,37,59` |
| Saved searches / alerts | `public.listing_alerts` (unified table); legacy `saved_searches` survives ONLY for the public/social search feature and is never alert-scanned | `app/actions/saved-searches.ts:39-54` (module contract), `:139-146` (upsert), `:148-168` (display-only mirror, `is_paused: true` belt-and-suspenders) |
| Named map areas | `public.search_areas`, owner-scoped | `lib/data/areas/searchAreas.ts:63-77` (`owner_user_id` read; table named at `:56`) |
| Places followed | `public.saved_cities` + `public.saved_communities` | `app/actions/saved-cities.ts:10-54`; `app/actions/saved-communities.ts:11-52` |
| Hidden homes | `public.hidden_listings` | `app/actions/hidden-listings.ts:35,57,80` |
| Collections | `public.listing_collections` | `app/actions/collections.ts:34-187` |
| Payment-estimate prefs | `public.user_buying_preferences` | `app/actions/buying-preferences.ts:25,68` |
| Activity / viewing trail | `public.user_events` (`listing_view`, `search_*`, `page_view` — written by the trackers, only READ here) | `lib/data/activity/getUserEvents.ts:25-36,59-74`; `app/actions/dashboard-history.ts:18-41` |
| Identity bind | `public.crm_people` (via `personIdsByEmailCi`) + durable `rr_pid` cookie (90d) + first-party identity graph (`stitchVisitorIdentity`) | `app/auth/callback/route.ts:14-15,30-65` |
| **NOT a SoR** | sessionStorage (`rr_pending_save_listing`, pageview counter) and localStorage (modal dismissal, guest-watch residual) — ephemeral client intent only; GA4 — a mirror, never the record; the legacy `saved_searches` table for anything alert-related | `lib/pending-save.ts:10-14`; `components/SignInPrompt.tsx:11-13`; `app/actions/saved-searches.ts:148-152` |

## 5. End-to-end path (inception → completion)

1. **Engage** · visitor · browses a 2nd page in one session (or clicks Save while logged
   out) · pageviews / save click · sign-in modal opens after 1s, or the browser is redirected
   to `/login?next=<page>` with the listing key stashed · sessionStorage counters + modal
   state (`components/SignInPrompt.tsx:103-125`; `lib/pending-save.ts:45-50`) · failure:
   storage unavailable → `countPageview()` returns 2, so the modal can fire on the FIRST
   pageview (legacy behavior, `components/SignInPrompt.tsx:27-29`) · both.
2. **Choose a provider** · visitor · taps Continue with Google/Facebook (modal or login
   page) or submits email+password · provider choice + `next` path · browser-initiated PKCE
   redirect to the provider with `redirectTo=/auth/callback?next=…`
   (`components/SignInPrompt.tsx:127-133`; `lib/supabase/oauth.ts:26-38`) · failure: OAuth
   init error is surfaced and the button re-enables (`components/SignInPrompt.tsx:131-132`) ·
   both.
3. **Callback — identity machine step** · system · exchanges the code for a session, then:
   CRM sign-in event, OAuth avatar captured onto the CRM person, `rr_pid` cookie stamped from
   `crm_people` by email (90-day), anonymous `rr_vid` history stitched to the known person,
   and the guest's email-keyed `listing_alerts` rows claimed onto the account
   (**verified-email gated**) · auth code + cookies · signed-in session, redirect to
   `next` with `&signed_up=1` (`app/auth/callback/route.ts:125-158`; claim gate `:77-86`;
   stamp+stitch `:30-65`) · failure: exchange failure logs the real reason and lands on
   `/auth-error` (`:127-131,188`); every identity side effect is best-effort and never blocks
   sign-in (`:26-28,62-64`) · both.
4. **RC7 resume — the stashed save completes itself** · system · on return to the bounced
   page, the hook consumes the sessionStorage flag and calls `resumeSaveListing`: idempotent,
   **add-only** (never a toggle, so stale client state can never un-save), auth-honest (no
   session yet → re-stash and retry on the next return) · stashed listing key · a
   `saved_listings` row + save-count increment + GPC-gated CRM save event + the same
   analytics a manual save fires (`lib/hooks/useResumePendingSave.ts:29-45`;
   `app/actions/saved-listings.ts:77-94`; `components/listing/SaveListingButton.tsx:60-67`) ·
   failure: a real write error is NOT treated as auth — the intent is dropped rather than
   claiming a false "Saved" (`app/actions/saved-listings.ts:90`) · both.
5. **Accrue state across visits** · visitor · saves/likes homes, saves searches, draws and
   names areas, follows cities/communities, hides homes, builds collections, sets buying
   preferences — writes owned by the sibling and `find-a-home` processes; the trackers write
   `user_events` for free · browse behavior · rows in the nine stores of §4
   (`app/actions/saved-listings.ts:42-55`; `app/actions/saved-searches.ts:124-146`;
   `lib/data/activity/getUserEvents.ts:9-12`) · failure: each write path owns its own
   failure modes; the portal only reads · both.
6. **Return signed-in** · visitor · navigates to `/account` (nav, alert-email manage link,
   or `next` default after login) · session cookie · the portal page renders per-request —
   13 parallel reads (profile, likes, saves, searches, cities, communities, hidden +
   collections, recent views, prefs, areas, admin role, activity rows, activity summary)
   plus live per-search insights · `app/account/page.tsx:106-146` · failure: logged-out hits
   redirect — layout to `/login?next=<path>` (`app/account/layout.tsx:17-24`), page guard to
   `/` (`app/account/page.tsx:107-108`) · both.
7. **Consume — the observable done-state** · visitor · reads the stat tiles (saved homes,
   alerts on, **new since your last visit**, named areas, places followed), the deduped
   homes grid (union of `saved_listings` and `likes` so one set of homes renders, not two),
   per-search "new since" badges, the recently-viewed strip, places chips, and their own
   activity feed · accrued rows · every number is the result of a query run in this render
   (`app/account/page.tsx:149-157` dedup, `:230-236` stats, `:288-322` recently viewed,
   `:146-147` new-since totals; insights `app/account/portal-data.ts:51-110`) · failure: an
   insight that cannot be produced honestly (unnarrowed search, deleted area) is omitted —
   no number rather than a wrong one (`app/account/portal-data.ts:51-64,88-91`) · both.
8. **Manage** · visitor · pause/resume alerts, change cadence, rename, delete, share with
   household, mark-all-seen (resets the new-since baseline via `last_viewed_at`), manage
   areas/hidden/collections/notifications, export their data · portal controls · scoped
   writes carrying BOTH row id and session user id (`app/actions/saved-searches.ts:268-346`;
   mark-seen `:325-346`; export `app/account/page.tsx:398-405`) · failure: every action
   returns a typed error; none can touch another user's rows (`app/actions/saved-searches.ts:44-47`) ·
   both.
9. **Re-enter the graph** · visitor · every tile, chip, and row deep-links back out —
   listing tiles and recently-viewed rows to listing detail, place chips to `/cities/<slug>`
   and `/homes-for-sale/<city>/<subdivision>`, empty states and the header CTA to the browse
   surface · portal links · a warm, identified `find-a-home` / `evaluate-a-place` session
   (`app/account/page.tsx:264-266,297-317,326-345,569-571`) · failure: a portal row whose
   listing no longer resolves renders nothing rather than a dead link
   (`app/account/page.tsx:293-294`) · both.

## 6. Decision points

- **Auto-pop vs stay silent** — the modal's suppression matrix is the process's biggest
  branch: paid click (per-page-load), outreach params (full 24h dismissal — the visitor is
  already identified server-side), `/lp/*`, lead-form pages, auth pages, 404, prior
  dismissal < 24h, first pageview of the session (`components/SignInPrompt.tsx:84-125`).
  A `?next=` param on any page shows it immediately — the visitor was bounced here to sign
  in (`:113-116`).
- **Resume is add-only and auth-honest** — `resumeSaveListing` never toggles; no session →
  re-stash, real write error → no false "Saved" (`app/actions/saved-listings.ts:69-94`;
  `lib/hooks/useResumePendingSave.ts:8-20`).
- **Guest-claim is verified-email gated** — guest alert rows attach to the account only when
  `user.email_confirmed_at` is set, so another person's guest searches can never be claimed
  on an unverified address (`app/auth/callback/route.ts:70-86`).
- **Privacy gates** — the CRM save mirror is GPC + session gated
  (`app/actions/saved-listings.ts:57-67`); the entire `/account/*` subtree is noindex (CR4,
  `app/account/layout.tsx:11-14`), `/login` is noindex (`app/login/page.tsx:17`); the
  `/api/auth/me` endpoint is `private, no-store` while page HTML stays cacheable
  (`app/api/auth/me/route.ts:12-16`).
- **Honest numbers or none** — portal insights are omitted for unnarrowed searches and
  deleted areas instead of rendering a wrong count (`app/account/portal-data.ts:51-64`);
  the "new since" baseline falls back from `last_viewed_at` to `created_at` so a
  never-checked search measures from its birth (`app/actions/saved-searches.ts:78-80`).
- **Public-search mirror stays inert** — opting a saved search into the community feature
  writes a legacy `saved_searches` row with `is_paused: true` so the alert cron can never
  scan it (`app/actions/saved-searches.ts:148-168`).
- **Voice/§0 gates in-path** — every rendered count is a this-render query result
  (`app/account/page.tsx:101-105`); brand-voice + design-token gates apply to all copy and
  UI on these routes (CLAUDE.md §2/§6).

## 7. Completion

Done when the **return visit consumes accrued saved state**: a signed-in visitor lands on
`/account` and the portal renders their real rows — the stat tiles, the deduped homes set,
per-search new-since badges, recently viewed, places, and activity, all queried in that
render (`app/account/page.tsx:106-157,230-236`). `/dashboard` reaching the same state via
redirect counts (`app/dashboard/page.tsx:10-12`).

Artifacts at completion: the session; the `rr_pid`-stamped browser; the stitched identity
graph row; the nine per-user stores of §4 rendered and manageable; `last_viewed_at`
timestamps when the visitor marks searches seen (`app/actions/saved-searches.ts:325-346`).

Terminal states: **active returner** (repeats step 6-9 indefinitely — the intended steady
state); **dormant account** (state accrues, no returns — the sibling alert loop is the recall
mechanism, and the CRM row keeps the relationship actionable); **declined guest** (dismissed
the modal — re-eligible after 24h, still servable by `guest-alert-capture`); **abandoned
inception** (bounced to `/login` and never returned — the stashed intent survives the tab
session and re-arms on the next return, `lib/hooks/useResumePendingSave.ts:38-40`).

## 8. Time & performance

- **Time-to-answer budget:** the returning visitor's question is "what changed since I
  left?" — answered in the first viewport by the stat tiles (specifically "New since your
  last visit") and the homes grid (`app/account/page.tsx:230-250`). No explicit per-read
  timeout wrapper exists on this page (unlike search's settled-timeout pattern) — a stalled
  read stalls the whole render; listed as a defect in §10.
- **Render model:** per-request dynamic (the auth-cookie read opts out of static rendering,
  `app/account/page.tsx:44-45`) — correct for a private surface, but it means every return
  visit pays the full 13-read `Promise.all` (`:114-142`) plus up to 12 insight reads.
- **The insight cap is the performance guard:** `PORTAL_INSIGHT_LIMIT = 12` live insights
  per render, each a 5-minute-cached search read scanning newest-first
  (`app/account/portal-data.ts:44-49,67-75`) — a subscriber with dozens of searches gets
  badges on the newest 12 rather than a slow page.
- **Deliberately uncached per-person reads:** the activity DAL and alert readers refuse
  `unstable_cache` — a cache window over per-person rows would serve one visitor a stale
  feed while pinning memory for everyone (`lib/data/activity/getUserEvents.ts:14-19`).
- **What "slow" means and who sees it:** only signed-in returners ever see this route; a
  slow portal punishes exactly the warmest visitors the machine has. No latency or field CWV
  number for `/account` was measured this session, so none is stated (§0) — pulling field
  CWV and a p95 render time is a P4/P8 gap item.

## 9. Variants

All land on the same portal; none diverges materially after sign-in:

- **Modal inception** (engaged 2nd pageview, organic/direct/internal only) — the designed
  main line (`components/SignInPrompt.tsx:103-125`).
- **Save-bounce inception** (RC7) — adds the stash/resume steps 1a+4; otherwise identical
  (`lib/pending-save.ts`; `components/listing/SaveListingButton.tsx:69-80`).
- **Direct** `/login` / `/signup` — password or OAuth; `next` defaults to `/account`
  (`app/login/page.tsx:22-24`).
- **Auth method** — OAuth code exchange vs magic-link/recovery `verifyOtp`: the callback
  runs the same identity side effects on both branches
  (`app/auth/callback/route.ts:125-159,162-185`).
- **Claimed guest** — a `guest-alert-capture` graduate whose email-keyed rows are attached
  at first verified sign-in; they arrive with a pre-populated portal
  (`app/auth/callback/route.ts:77-86`).
- **Alert click-back** — an alert email's manage link deep-links to
  `/account/saved-searches#alert-<id>`; the standalone route mounts the same manager the
  portal tab mounts, so the surfaces cannot drift (`app/account/page.tsx:94-99`).
- **Legacy `/dashboard` bookmark** — redirect shell to `/account`
  (`app/dashboard/page.tsx:10-12`).

## 10. Current implementation map

- **Routes:** `/account` (tabbed portal: overview/alerts/areas/homes/activity —
  `app/account/page.tsx:574-584`) + subroutes `areas`, `buying-preferences`, `collections`,
  `hidden`, `history`, `notifications`, `profile`, `saved-cities`, `saved-communities`,
  `saved-homes`, `saved-searches` (dir listing this run); `/login`, `/signup`,
  `/forgot-password`, `/auth-error`, `/auth/callback`; `/dashboard` + subpages.
- **Registers (of the 4 surviving design languages):** the portal is built on the ui
  component library (`Card`/`Button`/`Alert` from `@/components/ui`, `app/account/page.tsx:28-29`)
  with the **legacy-flat** `SiteFooter` (`app/account/layout.tsx:9`); `/login` mixes
  **primitives** (`H1`) with legacy-flat `SiteFooter` (`app/login/page.tsx:4-5`); `/dashboard`
  wears its own `DashboardShell` chrome (`app/dashboard/layout.tsx:4`). No kb, no explore.
- **Actions/API:** `app/actions/saved-listings.ts`, `saved-searches.ts`, `likes.ts`,
  `saved-cities.ts`, `saved-communities.ts`, `hidden-listings.ts`, `collections.ts`,
  `buying-preferences.ts`, `dashboard-history.ts`, `dashboard-likes.ts`;
  `app/account/portal-data.ts` (composition seam); `lib/data/activity/getUserEvents.ts`;
  `app/api/auth/me`; `app/auth/callback/route.ts`. No cron belongs to this process
  (`saved-search-alerts` is the sibling's).
- **Known defects / duplicates (P3/P5 input, all verified this run):**
  1. **`/dashboard` is a zombie shell.** Every consumer subpage is a redirect to its
     `/account` equivalent (`app/dashboard/{saved,searches,likes,notifications,collections,history,settings}/page.tsx`
     all `redirect(...)` — read this run), yet `app/dashboard/layout.tsx:9-17` still renders
     a full `DashboardShell` chrome + login guard that only ONE real page uses:
     `/dashboard/marketing` — an **admin-gated Marketing Brain dashboard living under a
     public route path** (`app/dashboard/marketing/page.tsx:1-11`). This corrects the P1
     registry note ("feature subpages still resolve alongside /account equivalents" —
     they are redirect shells, not duplicates); the real defect is the admin surface and
     dead chrome.
  2. **Three different logged-out behaviors in one subtree:** `/account` layout →
     `/login?next=<path>` (`app/account/layout.tsx:17-24`); the portal page itself → `/`
     (`app/account/page.tsx:107-108`); notifications page → `/login` without `next`
     (`app/account/notifications/page.tsx:21-22`).
  3. **Portal tab vs standalone-page duplication** is deliberate (email deep links must not
     drift from the portal — `app/account/page.tsx:94-99`) but doubles the surfaces P9 must
     migrate: `?tab=homes` vs `/account/saved-homes`, `?tab=alerts` vs
     `/account/saved-searches`, `?tab=areas` vs `/account/areas`.
  4. **`WelcomeBanner` explains the UI to the user** ("Here you can manage your saved
     searches…", `components/WelcomeBanner.tsx:42-45`) — a Matt-recorded copy ban
     (decisions.md 2026-08-11, "no explaining the UI") — and shows on every `/account`
     subpage until cookie-dismissed (`app/account/layout.tsx:29`).
  5. **No timeout guard on the portal's 13-read fan-out** (`app/account/page.tsx:114-142`) —
     unlike search's settled-timeout degraded state, one stalled read stalls the warmest
     visitors' page.
  6. **Two "places" nav vocabularies:** the stat tile "Places you follow" links
     `/account/saved-cities` while sibling tiles link portal tabs (`app/account/page.tsx:235`),
     and `AccountNav` lists saved-cities/saved-communities as separate top-level items
     (`components/account/AccountNav.tsx:18-23`) while the portal renders them as one chip
     row (`app/account/page.tsx:324-348`).
  7. **`getDashboardLikesData` over-fetches:** it pulls the full cities + communities index
     to hydrate liked places (`app/actions/dashboard-likes.ts:3-10`) on every portal render
     even when the visitor has zero liked places.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** The exploration graph (north star) needs exactly one "your
state" node: the machine's KPI-bearing processes all terminate in artifacts that are only
worth capturing because this process brings the visitor back to them. Shape derives from the
job — *bind identity once, accrue state everywhere, resume instantly* — not from today's
`/account` + `/dashboard` route pair or its 11-subroute sprawl.

- **Ideal step count:** inception stays two taps (prompt → provider → done; the PKCE +
  identity machine steps are invisible); return is ONE tap from any node to the resumed
  state. Management is depth inside the single destination, never sibling destinations.
- **Continuity (binding decision #5) is the real target:** saved state should follow the
  visitor through the graph — a saved home badges on search, a followed city greets them on
  its node, "new since your last visit" belongs wherever they re-enter, not only behind an
  account click. The portal remains the management surface; the *experience* of
  save-and-return diffuses into every node. (Today's code already half-does this: search
  hydrates saved/liked/hidden into results — `find-a-home` PDS step 5.)
- **Device:** mobile 390 is truth; the portal is a natural phone surface (glance at what
  changed, tap through) and must pass there first.
- **Consolidations implied:** `/dashboard` dies entirely (marketing dashboard re-homes under
  `/admin`; redirect shells become server redirects in config); the tab-vs-standalone
  duplication collapses to one addressing scheme; saved-cities/saved-communities merge into
  one "places" concept.
- **Data gaps blocking correctness:** no GA4 numbers were queried this session for modal
  accept/dismiss rate, sign-in conversion, or return-visit frequency — the P3 KEEP/MERGE
  call and the P5 destination weighting need them; no field CWV or render-latency for
  `/account`; no count of accounts with zero return visits (dormancy rate — the process's
  own failure metric).

**Dual objective this process stamps on its pages:**

- `visitor_objective`: "Pick up my home search exactly where I left it — everything I saved,
  and what changed since I was last here."
- `machine_objective`: "Bind this visitor to a durable identified account stitched to their
  CRM record, and generate recurring attributable return visits that keep the relationship
  warm."
- `exits`: portal home tiles / recently-viewed → listing detail (`find-a-home`) · place
  chips → city/community nodes (`evaluate-a-place`) · saved-search rows → the live search
  with those filters (`find-a-home`) · "Your agent" card → `contact-a-broker` · alert
  management → the `deliver-alerts` touchpoints · empty states → the browse surface.
  Exact exit routes are P5 output; these are the graph edges the process requires.

**Destination implication (proposal, not a lock):** ONE account destination (portal +
management as depth), with the sign-in surfaces as SYSTEM routes and `/dashboard` cut
(301s per the SEO carve-out — though `/account/*` and `/dashboard/*` are noindex, so no
GSC equity is expected; P5 still pulls the evidence before cutting).

## 12. Acceptance checks

Prove the process end-to-end. Persist; never delete.

1. **Modal gating (suppression):** load any listing page with `?fbclid=x`, browse a 2nd
   page — no modal (`components/SignInPrompt.tsx:84-89,110`). Load two organic pages in one
   tab session — modal appears ~1s into the 2nd (`:118-124`). Dismiss it; reload — no modal
   for 24h (`:32-43,117`).
2. **Save bounce:** logged out, click Save on a listing — browser lands on
   `/login?next=<that page>` and devtools shows
   `sessionStorage.rr_pending_save_listing = <key>` (`lib/pending-save.ts:19-26,45-50`).
3. **RC7 resume idempotency:** complete OAuth from that bounce, then
   `select listing_key, created_at from saved_listings where user_id = '<uid>' order by created_at desc limit 1;`
   → the bounced listing's canonical key, exactly one row; reload the page — still one row
   (`app/actions/saved-listings.ts:77-94`).
4. **Callback identity side effects:** after a fresh OAuth sign-in with a known CRM email,
   devtools shows the `rr_pid` cookie (httpOnly, 90d) and
   `select id from crm_people where lower(email) = '<email>';` returns the id the cookie
   carries (`app/auth/callback/route.ts:30-65,154`).
5. **Guest claim:** seed `listing_alerts` with a guest row on the test email
   (`user_id is null`), sign in with that email (verified), then
   `select user_id from listing_alerts where email = '<email>';` → the auth user id stamped
   (`app/auth/callback/route.ts:77-86,157`).
6. **Guards:** `curl -sI https://ryan-realty.com/account | grep -i '^location'` →
   `/login?next=%2Faccount` (layout guard); `curl -sI https://ryan-realty.com/dashboard`
   → redirect chain ending at `/account`-or-its-login-guard
   (`app/account/layout.tsx:17-24`; `app/dashboard/page.tsx:10-12`).
7. **noindex:** `curl -s https://ryan-realty.com/login | grep -io 'noindex'` → present
   (`app/login/page.tsx:17`); signed-in `/account` HTML carries the robots noindex meta
   (`app/account/layout.tsx:11-14`).
8. **Stats reconcile (§0):** signed in, compare the rendered stat tiles against:
   `select count(distinct k) from (select listing_key k from saved_listings where user_id='<uid>' union select listing_key from likes where user_id='<uid>') u;`
   (Saved homes — the dedup contract, `app/account/page.tsx:149-157`) and
   `select count(*) from listing_alerts where user_id='<uid>' and is_active;` (Alerts on,
   `:216,113` mapping). Numbers must match the page.
9. **New-since resets:** note the "New since your last visit" tile, click Mark all seen,
   then `select last_viewed_at from listing_alerts where user_id='<uid>';` → all stamped
   now, and the tile reads 0 on reload (`app/actions/saved-searches.ts:339-346`;
   `app/account/page.tsx:233`).
10. **Activity is real instrumentation:** view a listing signed in, then
    `select event_type, listing_key from user_events where user_id='<uid>' order by event_at desc limit 3;`
    → a `listing_view` row for that key, and it appears in Recently viewed on the next
    portal render (`app/actions/dashboard-history.ts:18-41`).
11. **Insight honesty:** create a saved search with NO narrowing filter (direct row insert)
    — its portal card renders without a match count rather than a whole-feed number
    (`app/account/portal-data.ts:51-57`).
12. **Timed span (P8 input):** on a real phone, cold organic visit → 2nd pageview → modal →
    Google OAuth → portal rendered with ≥1 saved home — record the seconds end-to-end. A
    timing not measured this session is not a timing.
