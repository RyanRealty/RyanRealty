> **MERGED -> track-outbound-engagement (P3 lock, Matt 2026-08-11).** This PDS is evidence for the survivor; do not build surfaces from it directly.

# Process: sms-shortlink-click — SMS tracked-link click (/r/<code> redirect)

## 0. Meta

- Status: **deepened**
- Cadence: **event-driven** (a tap on a texted link; no cron of its own — the six mint
  surfaces have their own cadences, the click path is purely visitor-initiated)
- Verdict (**PROPOSAL, not a lock — P3 decides**): **MERGE→track-outbound-engagement** —
  the job is identical to the email click tracker's ("a link in a message we sent opens the
  promised page; the tap becomes a person-level engagement row"): both 302 to a
  server-held target, both upsert a deduped `crm_timeline` engagement row per person+link,
  both fail open, both feed the same dashboards side by side
  (`app/api/track/e/click/route.ts:17-73` vs `app/r/[code]/route.ts:18-33`;
  `lib/data/crm/shortLinks.ts:11` names itself "the SMS analog of the email click
  tracker"). Grouping derives from the job, not from today's two routes — this is one
  process, "record engagement on an outbound message," with a per-channel mint mechanism.
  Non-negotiable rider regardless of grouping: the `/r/<code>` URL namespace and every
  minted code are immutable external contracts (they live in sent texts on clients'
  phones forever) — merge the process definition, never the routes. If P3 keeps
  track-outbound-engagement email-only, fall back to KEEP standalone.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A CRM person who taps a link in a text from Ryan Realty lands on the exact page the text
promised — instantly, with a link short enough not to bloat the message, and never a dead
end even when the code is mangled. The machine outcome is a person-level engagement +
identity stitch: because serving the tap requires resolving OUR stored target for that
person's code, the same resolution records an `sms_click` timeline row (the hottest
no-effort engagement signal the CRM gets — `lib/data/crm/getContactActivityFeed.ts:53-55`)
and, on governed sends, delivers the visitor to the site carrying `?agent=` and identity
params that cookie the browser to the contact (`lib/crm/merge.ts:338-348`) — advancing the
client-step "known contact becomes a recognized, attributed web visitor whose interest is
visible to their broker."

## 2. Inception (what starts it)

Trigger: a CRM person taps a `ryan-realty.com/r/<code>` link inside an outbound text.
Entry channel: **owned/direct — SMS** (never organic, never paid; the URL exists only in
texts Ryan Realty sent).

Precondition — the link was minted at compose time by `instrumentSmsLinks`
(`lib/data/crm/shortLinks.ts:82-129`), which rewrites every trackable http(s) URL in an
outbound body to `https://ryan-realty.com/r/<code>` (`:17,103`) backed by a
`crm_short_links` row (`createShortLink`, `:49-75`). Six mint surfaces, all funneling into
the same two functions:

1. Governed 1:1 CRM send — `lib/comms/sendGovernedSms.ts:61` (called from the composer,
   `app/actions/crm.ts`; order proven by test: merge → attribute → instrument → send,
   `lib/comms/governed.test.ts:100,190`).
2. Sequence-engine drip cron — `app/api/cron/crm-sequence-engine/route.ts:410`, registered
   `vercel.json` (`13,28,43,58 * * * *`).
3. Prospecting send — `app/actions/prospecting.ts:236-237`.
4. Expired outreach intro — `app/actions/expired-outreach.ts:142-143`.
5. FSBO outreach intro — `app/actions/fsbo-dashboard.ts:184-185`.
6. Composed doc/outreach send — `app/actions/send-doc.ts:290-291`.

Entry evidence: route handler `app/r/[code]/route.ts:18-33`; table
`crm_short_links` (`docs/DATABASE_SCHEMA_SNAPSHOT.md` §crm_short_links: `code`,
`person_id`, `target_url`, `broker`, `channel` default `'sms'`, `message_sid`,
`click_count`, `first_click_at`, `last_click_at`; migration
`supabase/migrations/20260713140000_crm_short_links.sql`).

Not preconditions: no auth, no cookie, no session — the code alone is the credential.

## 3. Actors

- **Visitor segment:** an existing CRM person — lead, prospect (expired/FSBO owner), or
  client — reading a text on their own phone. Device reality is structural, not sampled:
  the tap happens on the phone that received the SMS, so this process is effectively
  100% mobile by construction (no GA4 query was run this session and none is claimed —
  §0; the route renders no page for GA4 to see anyway).
- **Automated actors:** link-preview prefetchers (iMessage/WhatsApp/Slack/social
  crawlers) hit the URL to build previews — the middleware allowlists them
  (`GOOD_BOT_RE`, `middleware.ts:154-155`) and the route serves them the redirect but
  refuses to record them (`app/r/[code]/route.ts:21-23`;
  `lib/data/crm/shortLinks.ts:36-47`). CLI/library automation never arrives — the
  middleware bot screen 403s it upstream (`BAD_BOT_RE`, `middleware.ts:174-175,204-220,
  515-519`; matcher covers `/r/`, `:587-589`). The sequence-engine cron is an actor at
  mint time only.
- **Accountable for completion:** nobody, by design — the process completes autonomously
  in one request. Brokers are downstream consumers of the signal (activity feed,
  prospecting/expired/FSBO dashboards), not completers.

## 4. Systems of record

| Artifact | SoR |
|---|---|
| Code → target mapping (the redirect's only truth) | `crm_short_links.target_url`, written once at compose time (`lib/data/crm/shortLinks.ts:59-66`) — the anti-open-redirect property lives here: the target NEVER comes from the request |
| The engagement event consumers read | `crm_timeline` `kind='sms_click'`, deduped `sms_click:{personId}:{code}` (`lib/data/crm/shortLinks.ts:161-173`; kind admitted by migration `20260713140100_crm_timeline_sms_click_kind.sql`) |
| Per-code raw tallies | `crm_short_links.click_count` / `first_click_at` / `last_click_at` (`lib/data/crm/shortLinks.ts:178-186`) — written on every human hit, currently read by no surface (§10) |
| What the broker sees as "the text I sent" | `crm_timeline` `kind='sms_out'` rows written by each mint surface (e.g. `lib/comms/sendGovernedSms.ts:70-79`) |

Explicitly NOT a SoR: Twilio click analytics (does not exist — tracking is in-house
precisely so links stay short, `lib/data/crm/shortLinks.ts:6-11`); GA4 (no event fires on
the redirect; the click only becomes analytics-visible after the target page loads);
`crm_short_links.message_sid` (nullable column, never populated — no caller passes it,
because minting happens before the Twilio SID exists; grep this run shows `messageSid`
referenced only inside `shortLinks.ts` itself).

## 5. End-to-end path (inception → completion)

Steps 1–3 are the compose-time substrate that makes inception possible; steps 4–9 are the
process proper.

1. **Attribute (governed path only)** · server · `attributeSiteLinks` stamps
   `?agent=<slug>` and `?_fuid=<id>` into every `ryan-realty.com` URL in the merged body
   (fragment-safe, admin links skipped) · merged body · attributed body ·
   `lib/crm/merge.ts:320-350`, called at `lib/comms/sendGovernedSms.ts:51-55` · failure:
   none (pure string fn) · server.
2. **Mint** · server · `instrumentSmsLinks` regex-finds http(s) URLs (`shortLinks.ts:87`),
   strips trailing punctuation (`:34,94`), skips untrackables — its own tracker,
   `/api/track/`, unsubscribe/opt-out/email-preferences/agency-disclosure (`:29-31,95`) —
   mints one code per unique URL via `createShortLink` (7-char no-confusables alphabet
   `:18-26`, insert into `crm_short_links` `:59-66`, 4 retries on `23505` collision
   `:57,68-73`), then rebuilds the body in a single left-to-right positional pass so an
   inserted short link can never be re-matched (`:107-123`) · body + personId/broker ·
   tracked body · failure: fail-open — mint error sends the ORIGINAL body untracked
   (`:124-128`); a single failed code leaves that one link bare (`:78-80`) · server.
3. **Send** · server/cron · Twilio send from the broker's line or the A2P messaging
   service, tracked body in the message · `lib/comms/sendGovernedSms.ts:63-65`;
   `app/api/cron/crm-sequence-engine/route.ts:410-413`; the four action surfaces (§2) ·
   failure: send failure is the sending process's problem — orphan `crm_short_links` rows
   simply never get clicked · server.
4. **Tap — INCEPTION** · CRM person · taps `/r/<code>` in their message thread · the
   texted link · an HTTPS GET · — · person may never tap (terminal (f), §7) · mobile.
5. **Middleware screen** · edge · allowlisted preview bots pass (`GOOD_BOT_RE`,
   `middleware.ts:154-155,214`); CLI/library UAs 403 with `x-bot-screen`
   (`:174-175,220,515-519`); humans pass · UA + path · request reaches the route or dies ·
   `middleware.ts:204-220,515-519,587-589` · false-positive 403 on a real human is
   possible only if their UA matches `BAD_BOT_RE` (no real phone browser does) · any.
6. **Sanitize + classify** · route · code stripped to `[A-Za-z0-9]`, max 16 chars
   (`app/r/[code]/route.ts:20`); UA classified — `BOT_UA_RE` match OR missing/blank UA →
   redirect-only, no record (`:21-23`; `lib/data/crm/shortLinks.ts:43-47`) · raw params ·
   `{clean, log}` · empty cleaned code → straight to homepage redirect (`:24-25,33`) ·
   any.
7. **Resolve** · route → DAL · single select on `crm_short_links` by code
   (`shortLinks.ts:144-150`); unknown code → `null` → target stays `HOME`
   (`route.ts:24-28`); thrown error caught and warned, target stays `HOME` (`:29-31`) ·
   clean code · `{targetUrl, personId, broker, channel}` or null · DB outage degrades to
   homepage redirect — the tap NEVER 500s · server.
8. **Record (human hits only)** · DAL · upsert `crm_timeline` `sms_click` row —
   `dedupe_key: sms_click:{personId}:{code}`, `ignoreDuplicates` so repeat taps of the
   same link collapse to one row; insert error is warned, never swallowed silently, never
   blocks the redirect (`shortLinks.ts:161-176`) · then bump `click_count`
   (+1 read-modify-write), `last_click_at`, `first_click_at`-if-null (`:178-186`) ·
   resolved row · timeline row + counters · both writes are awaited BEFORE the redirect
   returns (§8, §10 defect 1) · server.
9. **Redirect — COMPLETION** · route · 302 to `target_url` if it matches `^https?://`,
   else homepage (`route.ts:28,33`) · resolved target · person lands on the promised
   page; on governed-path site links the URL carries `?agent=` + `_fuid=`, so the
   attribution bridge cookies the browser (90-day `rr_agent_attribution`) and the
   identity bridge stitches their anonymous sessions (`lib/crm/merge.ts:338-348`) ·
   mobile.
10. **(Post-completion consumption)** · brokers/admin · the `sms_click` row surfaces as
    "Text link clicked" in the person activity feed
    (`lib/data/crm/getContactActivityFeed.ts:53-55`) and as SMS-engagement counts on the
    prospecting (`lib/data/prospecting/engagement.ts:76-95`), expired
    (`lib/data/expired/dashboard.ts:124-146,217`), and FSBO
    (`lib/data/fsbo/dashboard.ts:113-129,193`) dashboards · desktop/admin.

## 6. Decision points

- **Trackable vs untrackable (mint):** unsubscribe/opt-out/email-preferences/
  agency-disclosure links and its own tracker URLs are NEVER wrapped
  (`lib/data/crm/shortLinks.ts:29-31,95`) — the carrier-mandated opt-out rail must not
  sit behind a tracker that could fail. Compliance branch, not an optimization.
- **Mint failure → fail-open:** the text always sends; tracking is sacrificed, never the
  message (`shortLinks.ts:124-128`).
- **Middleware: good bot / bad bot / human** (`middleware.ts:214,220`): preview bots
  through (so iMessage/WhatsApp cards unfurl), CLI automation 403'd, humans through.
- **Route: human vs preview** (`app/r/[code]/route.ts:23`; `shortLinks.ts:43-47`): both
  get the redirect; only humans get recorded. Missing UA = bot (real browsers always send
  one, `:45`).
- **Known vs unknown code** (`route.ts:24-28`): unknown/invalid/errored → fail-open 302
  to the homepage; a mistyped link never dead-ends.
- **Valid target check** (`route.ts:28`): non-`https?://` target → homepage. Belt over
  the anti-open-redirect suspenders: the target comes ONLY from the DB row written at
  compose time, never from a query param (`route.ts:5-8`).
- **Timeline dedupe vs counter increment** (`shortLinks.ts:161-173` vs `:178-186`):
  repeat taps of the same link collapse to one timeline row (matches the `email_click`
  grain, `app/api/track/e/click/route.ts:23-25`) while `click_count` increments every
  human hit.
- **Compliance gates:** voice canon — the route emits no public copy (a redirect has no
  body); the only prose is the internal timeline title "Clicked a link you texted"
  (`shortLinks.ts:167`, admin-facing, out of canon scope per CLAUDE.md §2). §0 — no
  figures rendered. Suppression/quiet-hours/A2P gates all live upstream in the send
  processes (`lib/comms/sendGovernedSms.ts:30-36`); a click has no send to gate.

## 7. Completion

Done-when (observable), for a human tap on a valid code: the browser received a 302 to
the DB-stored `target_url`, AND `crm_timeline` holds an `sms_click` row with
`dedupe_key = sms_click:{personId}:{code}`, AND that code's `click_count` incremented
with `last_click_at` fresh and `first_click_at` set (`app/r/[code]/route.ts:27-33`;
`lib/data/crm/shortLinks.ts:161-186`). The click is thereafter visible on the person
activity feed and the three engagement dashboards (§5 step 10).

Artifacts at completion: the timeline row; the bumped counter triplet; on governed-path
site targets, the attribution/identity cookies set by the landing page's bridges.

Terminal states:

- **(a) Human click recorded** — the done-when above. Repeat taps: redirect + counter
  bump, no new timeline row (by grain design).
- **(b) Preview prefetch** — 302 served, zero writes (`shortLinks.ts:157-159`).
- **(c) Unknown/mangled code** — 302 to homepage, zero writes (`route.ts:24-28`).
- **(d) CLI automation** — 403 at the middleware, route never runs
  (`middleware.ts:515-519`).
- **(e) Resolve error** — warned, 302 to homepage; the tap survives a DB outage
  (`route.ts:29-31`).
- **(f) Never tapped** — the `crm_short_links` row idles forever with
  `click_count = 0`; no expiry exists (a fact, not a defect — old texts must keep
  resolving, §11).

## 8. Time & performance

- **Time-to-answer budget:** the visitor's "question" is the tap itself; the answer is
  the target page. The route's own cost for a human click is one DB read plus two
  sequential awaited writes BEFORE the 302 is returned
  (`shortLinks.ts:145-186` fully awaited from `route.ts:27`) — the person is staring at
  a blank in-app browser for the whole round-trip chain. Prefetch/unknown paths pay one
  read or none. No latency percentile has been measured for `/r/*` — named gap, no
  number claimed (§0).
- **Core Web Vitals:** n/a — the route renders no page (302 only, `runtime='nodejs'`,
  `revalidate = 0`, `route.ts:13-14`). CWV accrues to the TARGET route and is owned by
  the process that owns that page.
- **What "slow" means and who sees it:** the delay between tap and target-page paint,
  felt by the single hottest lead in the funnel at their hottest moment — a person
  acting on a text from their broker. Slow here taxes exactly the wrong visitor. The
  bookkeeping-before-redirect ordering (§10 defect 1) is the controllable share of that
  delay; the rest belongs to the target page's process.

## 9. Variants

- **Six mint surfaces, one click path** (§2): governed composer 1:1, sequence-engine
  cron, prospecting, expired, FSBO, send-doc. The click-side behavior is byte-identical
  for all six — same route, same DAL function. Differences are mint-side only: the
  governed path alone runs `attributeSiteLinks` first (so only ITS targets carry
  `?agent=`/`_fuid=` — `lib/comms/sendGovernedSms.ts:51-55`), and the four
  prospecting-family actions hardcode `broker: 'matt'`
  (`app/actions/prospecting.ts:237`, `expired-outreach.ts:143`,
  `fsbo-dashboard.ts:185`, `send-doc.ts:291`) while the composer and cron pass the real
  slug. No split — the process is the click, and the click does not diverge.
- **Channel headroom:** `crm_short_links.channel` defaults `'sms'`
  (`shortLinks.ts:64`; snapshot) — a future channel reuses the whole path unchanged.
- **The email sibling** (`/api/track/e/click`, `app/api/track/e/click/route.ts:17-73`):
  same job, different channel and mint mechanism (signed token carrying the URL vs DB
  code; extra writes to `email_events` + newsletter ledger; no route-level bot filter).
  This is the MERGE→track-outbound-engagement argument (§0 verdict), not a variant of
  this file's path.

## 10. Current implementation map

- **Route:** `app/r/[code]/route.ts` (the only page-adjacent surface; renders nothing).
- **Registers/design languages:** none — no UI exists on this process. Nothing to
  inherit, nothing to amnesia.
- **DAL:** `lib/data/crm/shortLinks.ts` — all four fns (`isLikelyBotUserAgent`,
  `createShortLink`, `instrumentSmsLinks`, `resolveAndLogShortLinkClick`), sole toucher
  of `crm_short_links` (`docs/DAL_INDEX.md` §lib/data/crm/shortLinks.ts; grep this run
  confirms no other file references the table). DAL boundary G1 holds.
- **Actions/crons:** the six mint surfaces (§2); consumers
  `lib/data/prospecting/engagement.ts:76-95`, `lib/data/expired/dashboard.ts:124-146`,
  `lib/data/fsbo/dashboard.ts:113-129`, `lib/data/crm/getContactActivityFeed.ts:53-55`.
  No cron of its own; no dead paths found.
- **Known defects (evidence, this run):**
  1. **Bookkeeping before redirect:** the timeline upsert + counter update are awaited
     before the 302 returns (`route.ts:27` awaiting `shortLinks.ts:161-186`) — the
     hottest lead pays for the machine's bookkeeping. Log-after-respond (`after()` /
     `waitUntil`) would cut the human-perceived cost to one read.
  2. **Non-atomic counter:** `click_count` is read-modify-write (`shortLinks.ts:147,182`)
     — two concurrent taps can lose an increment. Harmless today only because no surface
     reads the column (defect 4).
  3. **Broker-thread legibility split:** the governed path stores the READABLE body in
     the `sms_out` timeline row while sending the tracked one
     (`sendGovernedSms.ts:59-61,71`); the sequence engine and all four action surfaces
     store the TRACKED body — `/r/<code>` soup in the broker's thread
     (`crm-sequence-engine/route.ts:410,423`; `expired-outreach.ts:143,152`;
     `fsbo-dashboard.ts:185,193`; `prospecting.ts:237,319`; `send-doc.ts:291,301`). One
     surface got the rule; five didn't.
  4. **Write-only analytics:** `click_count`/`first_click_at`/`last_click_at` are read
     by no surface (grep this run: only `shortLinks.ts` touches the table) — per-code
     and repeat-click intelligence exists but is invisible; dashboards count deduped
     timeline rows, so a person who taps the same link five times reads as 1.
  5. **Hot signal hidden in the person view:** the person-detail center timeline filters
     `sms_click` out (`app/admin/(protected)/crm/[id]/person-view-model.ts:155`) but —
     unlike email engagement, which folds into its `email_out` row
     (`buildEmailEngagement`, `:127-143,168-169`) — never folds it into the `sms_out`
     row. The click shows only in the activity feed. An admin-surface defect recorded
     here as evidence; the fix belongs to the Admin Product OS.
  6. **Identity stitch dies with FUB ids:** the governed path passes only
     `fub_legacy_id` to `attributeSiteLinks` (`sendGovernedSms.ts:51-55`), so
     post-cutover native contacts (no legacy id) get no `_pid` param even though the
     mechanism exists and prefers it (`lib/crm/merge.ts:344-348`) — their click lands
     attributed to the broker but cannot stitch the anonymous web session. The
     machine_objective (§11) silently degrades for every new contact.
  7. **Dead column:** `message_sid` is never populated (§4) — schema intent
     (click→message join) unrealized.
  8. **No unit tests on the rewrite:** the positional-rebuild, punctuation, and
     untrackable-exclusion logic in `instrumentSmsLinks` has no dedicated test file
     (no `shortLinks.test.ts` exists); only the governed path's wiring is tested
     (`lib/comms/governed.test.ts:100,190`).
- **Duplicate/parallel paths that should die:** none — one mint function, one redirect
  route. The email tracker is a parallel-by-channel sibling (§9), duplication of JOB not
  of code path; that is the §0 merge proposal, not a kill.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes.** The job is irreducible: texted links must be short (segment
economics are why this is in-house at all — `shortLinks.ts:6-8`), must land somewhere
real forever, and the tap is the highest-intent engagement signal the machine can
harvest at zero cost to the visitor. It is the purest instance of the program's founding
directive #3 (decisions.md 2026-08-11: "one lead-generation machine that never acts like
it" — the machine outcome exists ONLY as a side effect of serving the tap) and the
enabling mechanism for directive #5 (continuity: this redirect is where CRM identity
crosses into the web session).

**Ideal shape:** for the visitor, one step — tap, page. Keep exactly that. Machine-side:
record AFTER responding (kill defect 1), make the counter atomic or drop it (decide
defect 4 — either a surface reads per-code/repeat-click data or the columns go), stitch
identity for native contacts (defect 6 — pass `crm_people.id` through), and make all six
mint surfaces store the readable body (defect 3). None of these changes the process
shape; they close the gap between the shape and its implementation.

**Immutable external contract:** every minted `/r/<code>` URL is printed into a text
that lives in a client's message thread indefinitely. The `/r/` namespace and every
existing code must resolve forever — no P5 rename, no expiry, no cleanup job may touch
them. This is the SEO-equity carve-out's harder sibling: a 301 can rescue a search
engine, but nothing can rewrite a sent text.

**Destination implication:** NOT a destination. Invisible infrastructure with no page,
no nav presence, no design register — it appears in no IA tree P5 draws. Its dual
objective governs the route's behavior and what it hands the destination page, not a
page of its own:

- `visitor_objective`: "The link in your text opens the page you were promised,
  instantly — never a dead end, even mistyped, even years later."
- `machine_objective`: "Record the tap as a person-level `sms_click` engagement signal
  and deliver the destination page a recognized, broker-attributed visitor (attribution
  and identity params surviving the redirect intact)."
- `exits`: the DB-stored `target_url` (any node in the site graph — the texted page IS
  the exit); `https://ryan-realty.com` on unknown code or resolve failure. A redirect
  has no chrome and no other doors.

**Data gaps blocking correctness:** none blocking — the chain (mint → send → tap →
record → consume) is complete and closed. Named measurement gaps: no `/r/*` latency
percentile exists; repeat-click depth is captured but unreadable (defect 4); native-
contact session stitching is dark (defect 6). No GA4 device split is possible or needed
— the channel is structurally mobile (§3).

## 12. Acceptance checks

Persist; never delete. Production is `ryan-realty.com`; a browser UA is required to get
past the middleware bot screen (BAD_BOT_RE includes `curl/` —
`middleware.ts:174-175`). Use
`UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'`.

1. **Upstream CLI screen:** `curl -sI https://ryan-realty.com/r/ZZZZZZZ | head -1` →
   `403` (default curl UA; header `x-bot-screen: bad-ua`). Proves terminal (d).
2. **Fail-open on unknown code:**
   `curl -sI -A "$UA" https://ryan-realty.com/r/ZZZZZZZ | grep -i '^\(HTTP\|location\)'`
   → `302` + `location: https://ryan-realty.com`. Zero rows written (unknown code
   short-circuits before any write — `shortLinks.ts:150`).
3. **Mint E2E (governed path):** send a 1:1 CRM text to a TEST person whose body
   contains a `https://ryan-realty.com/...` URL. Verify: (a) the Twilio-delivered body
   contains `ryan-realty.com/r/<code>`; (b)
   `SELECT code, target_url, broker, channel FROM crm_short_links WHERE person_id = :pid
   ORDER BY created_at DESC LIMIT 1` — `target_url` carries `?agent=<slug>` (and
   `_fuid=` when the person has `fub_legacy_id`), `channel='sms'`; (c) the person's
   `sms_out` timeline row body shows the READABLE URL, not `/r/` (the governed-path
   legibility rule, `sendGovernedSms.ts:60,71`).
4. **Human click E2E:** with the code from check 3:
   `curl -sI -A "$UA" https://ryan-realty.com/r/<code> | grep -i location` → the exact
   `target_url`. Then:
   `SELECT count(*) FROM crm_timeline WHERE dedupe_key = 'sms_click:' || :pid || ':<code>'`
   → 1; `SELECT click_count, first_click_at, last_click_at FROM crm_short_links WHERE
   code = '<code>'` → `click_count ≥ 1`, both timestamps set.
5. **Dedupe grain:** repeat check 4's curl. Timeline count stays 1; `click_count`
   incremented by exactly 1.
6. **Preview-prefetch neutrality:** `curl -sI -A "WhatsApp/2.23.20" https://ryan-realty.com/r/<code>`
   → `302` to the target (GOOD_BOT allowlist passes it through the middleware,
   `middleware.ts:155`), AND `click_count` unchanged, no new timeline row (route-level
   filter — `route.ts:23`).
7. **Anti-open-redirect:** `curl -sI -A "$UA" 'https://ryan-realty.com/r/<code>?u=https://evil.example'`
   → `location` is still the DB `target_url` (the route reads only the path param —
   `route.ts:19-20`).
8. **Untrackable exclusion:** compose (to the test person) a body containing an
   `unsubscribe` URL → the delivered body keeps that URL bare, and
   `SELECT count(*) FROM crm_short_links WHERE person_id = :pid AND target_url ILIKE
   '%unsubscribe%'` → 0 (`shortLinks.ts:29-31`).
9. **Governed wiring unit tests:** `npx vitest run lib/comms/governed.test.ts` — green
   (asserts merge → attribute → instrument → send ordering, `:100,190`).
10. **Consumer surfaces:** the test person's activity feed shows "Text link clicked"
    (`getContactActivityFeed.ts:55`); for a prospecting/expired/FSBO test lead, the
    dashboard SMS-click column equals the deduped timeline count
    (`lib/data/prospecting/engagement.ts:76-95`, `lib/data/expired/dashboard.ts:217`,
    `lib/data/fsbo/dashboard.ts:193`).
11. **Cron mint parity:** after any sequence-engine SMS step fires
    (`vercel.json` `13,28,43,58 * * * *`),
    `SELECT count(*) FROM crm_short_links csl JOIN crm_timeline t ON t.person_id =
    csl.person_id AND t.kind = 'sms_out' AND t.source = 'sequence' AND t.body LIKE
    '%' || csl.code || '%'` ≥ 1 — drip texts carry tracked links
    (`crm-sequence-engine/route.ts:410`).

Cleanup after checks 3–8: delete the test person's `crm_short_links` and `crm_timeline`
test rows.
