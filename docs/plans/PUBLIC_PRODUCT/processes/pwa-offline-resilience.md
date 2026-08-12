# Process: pwa-offline-resilience — PWA install, offline fallback, and client-shell recovery

## 0. Meta

- Status: deepened
- Cadence: continuous — this is a machine process that runs inside every visitor's browser on every page load; no cron, no server schedule (vercel.json grep this run: zero entries touch it)
- Verdict (PROPOSAL, not a lock): **KEEP** — the recovery half (client-side stale-SW eviction + server-side `GET /clear`) is live, load-bearing, and was built against a real incident class (the apex-domain cutover trap, app/clear/route.ts:6-13); no other process covers availability of the client shell itself. The deepening finding that must reach P3: the OFFLINE half is dormant — app/sw.ts is source that never compiles (§10 defect 1) — so the KEEP carries one named sub-decision: wire the offline worker for real, or cut the dormant source and the /offline page with it. Shipping the current halfway state through P9 untouched is the one wrong answer.
- Last evidence pass: 2026-08-11 (every file:line below opened this run)

## 1. Purpose

(a) Every visit lands on a working, current site shell: a returning visitor is never stranded on a stale pre-migration service worker's cached copy of a dead site, a visitor who loses the network gets an honest recoverable state instead of a raw browser error, and a mobile regular can put Ryan Realty on their home screen. (b) The machine outcome is availability of the entire capture machine: a wedged or dead shell completes zero valuations, alerts, saves, or contacts, so this process is the precondition every other process's machine_objective silently inherits — fully serving (a) is what keeps every node of the exploration graph reachable at all.

## 2. Inception (what starts it)

Three live triggers plus one designed-but-dormant trigger. Entry channel is orthogonal (organic/paid/direct/social all inherit it — the process is mounted in the root layout, not on a route).

1. **Every page load (shell hygiene + install identity).** The root layout serves `<link rel="manifest" href="/manifest.json">` on every route (app/layout.tsx:107) and mounts `StaleServiceWorkerReset` outside `HideOnLP`, so it runs on every route including LPs and /admin (app/layout.tsx:127-130). `InstallPrompt` mounts through `PublicClientLayer` (dynamic ssr:false import at components/layout/PublicClientLayer.tsx:28, rendered inside `HideOnLP` at :51-53; the whole layer returns null on /admin at :45; layer mounted app/layout.tsx:166). Preconditions: none — unauthenticated, data-free.
2. **A wedged browser (recovery).** Trigger: a visitor's browser holds a stale service worker from the pre-cutover stack that serves an old cached shell which never runs our code — the catch-22 named at app/clear/route.ts:8-11. Entry: the visitor is TOLD the URL out-of-band ("visit https://ryan-realty.com/clear once", app/clear/route.ts:15) — a support-driven, human-relayed entry channel, the only one of its kind in the registry.
3. **Home-screen launch (installed variant).** `public/manifest.json` declares `start_url: "/"`, `display: "standalone"`, theme `#102742`, and 192/512/maskable icons (file read this run; icons exist on disk at public/icons/icon-192.png, icon-512.png, icon-maskable-512.png).
4. **DORMANT — network loss mid-session.** The designed trigger for the offline leg: a serwist worker intercepting document requests and falling back to /offline (app/sw.ts:19-28). It never fires in production because the worker is never built or registered (§10 defect 1).

## 3. Actors

- **Visitor segments:** all of them — this process is segment-agnostic; buyer, seller, owner, dreamer, and investor inherit it identically. The one segment-shaped edge: the recovery leg (trigger 2) selects for RETURNING visitors of the pre-cutover site — exactly the local, high-intent audience most valuable to the machine. Device reality from GA4 was **not queried this pass** (stated gap, not a number); the program's own truth is mobile-first 390 (decisions.md, Mobile-first).
- **Automated actors:** the browser itself is the primary executor — SW lifecycle, CacheStorage, the `Clear-Site-Data` header's wipe, the `beforeinstallprompt` election (whether and when it fires is the browser's decision; our code only listens, components/pwa/InstallPrompt.tsx:36-40). No cron, no queue, no server-side actor beyond the static /clear response.
- **One non-visitor actor in the blast radius:** a signed-in broker whose browser holds the web-push worker registered by BrokerPushOptIn (components/admin/push/BrokerPushOptIn.tsx:92) — the hygiene leg evicts it (§10 defect 3).
- **Accountable for completion:** the platform (no human in the loop); Matt owns the P3 sub-decision in §11.

## 4. Systems of record

- **The visitor's browser IS the store.** The state this process manages lives client-side only: SW registrations and CacheStorage (read/wiped by StaleServiceWorkerReset.tsx:32-40 and by the `Clear-Site-Data: "cache", "storage"` header, app/clear/route.ts:35), the `pwa_install_dismissed` cookie (1-year, components/pwa/InstallPrompt.tsx:6,15-18), and the `pwa_visits` sessionStorage counter (InstallPrompt.tsx:33-34).
- **Worker + manifest source of record — the git repo:** `public/sw.js` is hand-authored SOURCE, deliberately tracked against the generated-worker ignore rules (.gitignore:53-59 — `public/sw*` ignored, `!public/sw.js` un-ignored with the collision warning); `app/sw.ts` is the dormant serwist source; `public/manifest.json` is the install identity.
- **Explicitly NOT SoR:** the `push_subscriptions` side of /sw.js belongs to the broker-alert machinery (an admin-plane process — /sw.js:1-11 documents it as the receiving end of the W5.5 push channel), not to this one; this process touches no Supabase table and no DAL function (DAL involvement: n/a — the process manages browser state, not data).

## 5. End-to-end path (inception → completion)

**Leg A — shell hygiene (every load, every visitor):**

1. **Mount** · system · root layout renders StaleServiceWorkerReset before anything else in body (app/layout.tsx:130) · input: none · output: a client effect queued · failure: JS disabled → leg never runs (page still serves) · device: any.
2. **Probe** · browser · `navigator.serviceWorker.getRegistrations()` (StaleServiceWorkerReset.tsx:28,32) · output: registration list · branch: empty list → return, no-op — the common case ("the 99% of visitors" is the component's own claim at :23-24, not a measured stat) · failure: no SW API → early return (:28) · device: any.
3. **Evict** · browser · unregister EVERY registration, then delete EVERY CacheStorage key (:35-40) · side effect: any SW on the origin dies — the pre-cutover worker (intended), but also the broker push worker and any future first-party worker (§10 defects 3, 5) · failure: swallowed by design — cleanup never blocks the page (:48-50) · device: any.
4. **Reload once if controlled** · browser · if a SW controlled this page, the visible HTML may be the stale copy → `window.location.reload()` (:45-47); after unregistration the next load has no controller, so it fires at most once (:20-21) · output: fresh network shell · device: any.

**Leg B — install (mobile visitor, non-LP public routes):**

5. **Arm** · system · InstallPrompt mounts (PublicClientLayer.tsx:52), bails unless mobile UA and not previously dismissed (InstallPrompt.tsx:31), increments `pwa_visits` (:33-34), listens for `beforeinstallprompt` (:36-40), starts a 30s timer (:42) · device: mobile only (:20-23).
6. **Offer** · system · banner shows only when ALL hold: browser fired the event, 30s elapsed, visits ≥ 2 (:50-54, :7-8) · output: the install dialog (role="dialog", :74-77) with Install / Not now · failure: browsers that never fire `beforeinstallprompt` never see the banner — the code requires the event · device: mobile.
7. **Install or dismiss** · visitor · Install → browser-native prompt (:56-64); Not now → 1-year dismissal cookie (:66-69,15-18) · output: home-screen icon launching `start_url "/"` standalone (public/manifest.json) · device: mobile.

**Leg C — wedged-browser recovery:**

8. **Instruct** · human (Matt/support) · relays the /clear URL to the stuck visitor (app/clear/route.ts:15) · input: a complaint about a broken/frozen site · device: any.
9. **Reset server-side** · system · `GET /clear` (force-dynamic nodejs route, app/clear/route.ts:17-18) returns a minimal HTML page with `Clear-Site-Data: "cache", "storage"` — cookies deliberately preserved so sign-in survives (:35,12-13) — plus `Cache-Control: no-store` (:36) and a 1-second meta refresh to `/` (:24) · side effect: the browser unregisters all SWs and wipes cache/storage for the origin before our JS ever needs to run — this is what breaks the catch-22 a stale SW creates (:8-13) · failure: a browser that does not honor Clear-Site-Data gets only the redirect; leg A then attempts the same wipe client-side IF the served home shell is live — the two legs are deliberately complementary · device: any.
10. **Land** · visitor · arrives on `/` with a clean origin · output: the live site · completion: recovered.

**Leg D — offline fallback (DORMANT — designed, never runs):**

11. **(designed) Precache + intercept** · serwist worker · precache manifest, skipWaiting, clientsClaim, navigationPreload, defaultCache runtime caching (app/sw.ts:13-18) · **does not execute: no build emits this worker (§10 defect 1)**.
12. **(designed) Fallback** · serwist worker · a document request that fails offline is answered with /offline (app/sw.ts:19-28) — the page renders "You're offline", a Try again button that reloads only when `navigator.onLine` (app/offline/page.tsx:17-24), and a home link (:30) · **today's actual behavior on network loss: the browser's own error page; /offline is reachable only by typing the URL** · device: any.

## 6. Decision points

- **Hygiene branch (leg A):** registrations present? → evict; page controlled? → reload once (StaleServiceWorkerReset.tsx:33,45). No allowlist exists — the eviction cannot distinguish the enemy SW from our own (the load-bearing defect behind §10 items 3 and 5).
- **Install eligibility (leg B):** mobile UA ∧ no dismissal cookie ∧ event fired ∧ 30s ∧ visits ≥ 2 (InstallPrompt.tsx:31,50-54). Dismissal is sticky for a year (:17).
- **Recovery honor (leg C):** browser honors Clear-Site-Data or not — our code cannot observe which; the meta refresh redirects home either way (app/clear/route.ts:24).
- **The dormant fork (design-time):** next.config.ts:39-40 records the standing decision — "Serwist requires webpack. Next 16 defaults to Turbopack; use `next build --webpack` to enable SW. Manifest + offline page + InstallPrompt work without the service worker." The build script is plain `next build` (package.json:16), so the fork is permanently on the no-SW side today.
- **Compliance gates that bind:** /offline is `noindex, nofollow` and out of the sitemap (app/offline/layout.tsx:8-12; app/sitemap.ts grep this run: no /offline, no /clear) — correct for a fallback surface. The InstallPrompt banner and /offline copy are public copy → voice canon + `ci:brand-voice` apply (the banner's "for the fastest experience", InstallPrompt.tsx:80, is a superlative-shaped claim worth a canon pass at P9). §0: this process renders no market numbers — nothing to trace. No-public-Coming-Soon and ODS/IDX: not touched (no listing data in any leg).

## 7. Completion

- **Leg A done-when:** the served shell is current and no foreign SW controls the origin — for the common case that is the silent no-op (probe → empty → return); for the eviction case, the post-reload page with `controller === null`.
- **Leg B done-when:** the browser's install completes (prompt outcome `accepted`, InstallPrompt.tsx:59-60) or the visitor dismisses (cookie written). Both are terminal; neither is observable server-side — no analytics event fires on either outcome (repo grep this run: no `appinstalled` listener, no install telemetry).
- **Leg C done-when:** the visitor lands on `/` served fresh from the network with SW registrations and caches gone. Not observable server-side either — /clear leaves no log artifact beyond a request line.
- **Leg D (dormant) done-when:** it would be "offline navigation renders /offline instead of a browser error" — currently unreachable as designed.
- **Terminal states:** clean-shell (no-op) · evicted-and-reloaded · recovered-via-/clear · installed · dismissed-for-a-year · (dormant) offline-fallback-served.

## 8. Time & performance

- **Time-to-answer budgets, from code:** leg C resolves in ~1 second by construction (the meta refresh, app/clear/route.ts:24) plus one navigation. Leg B deliberately waits ≥30s and ≥2 loads before speaking (InstallPrompt.tsx:7-8) — the prompt is intentionally slow, correctly. Leg A's eviction path costs the affected visitor one extra full page load (the one-time reload, StaleServiceWorkerReset.tsx:45-47); its no-op path costs one microtask probe.
- **CWV reality:** not queried this pass for /offline or /clear (gap). Both are chrome-light: /clear is a 19-line static HTML string; /offline is a small client page. The process's site-wide cost rides in the root-layout bundle (StaleServiceWorkerReset is 57 lines; InstallPrompt is code-split behind ssr:false, PublicClientLayer.tsx:28).
- **What "slow" means and who sees it:** the catastrophic case is not latency but PERMANENCE — a returning visitor wedged on the dead pre-cutover shell sees a broken site forever, converts at zero, and blames the brokerage; recovery today requires a human to relay a URL (leg C step 8). That human dependency is the process's real performance ceiling.

## 9. Variants

One process, capability-split by browser rather than by channel; no split into separate processes is warranted — the legs share one purpose (the shell stays alive) and one owner:

1. **No-SW-API browser:** leg A no-ops at the guard (StaleServiceWorkerReset.tsx:28); legs B/C degrade to manifest-only install and redirect-only clear.
2. **Browsers that never fire `beforeinstallprompt`:** leg B silently never offers (the code requires the event, InstallPrompt.tsx:50-51) — home-screen install remains possible only through browser-native menus we neither trigger nor detect.
3. **Clear-Site-Data non-honoring browser:** leg C degrades to a redirect; leg A is the backstop (complementarity noted at §5 step 9). Which browsers honor the header was not verified this pass (gap).
4. **Installed standalone launch:** same shell, same legs, `display: standalone` chrome (public/manifest.json) — with no offline layer, the installed app is a browser window minus the URL bar; network loss inside it hits the same browser error page.
5. **LP visitor (`/lp/*`):** InstallPrompt hidden with the rest of the chrome (HideOnLP wrap, PublicClientLayer.tsx:51-53); the hygiene leg still runs (mounted outside HideOnLP, app/layout.tsx:127-130) — correct, since a wedged LP visitor is still wedged.
6. **Broker browser:** the one variant where leg A is actively harmful — see §10 defect 3.

## 10. Current implementation map

- **Routes today:** `/offline` (app/offline/page.tsx:8, layout at app/offline/layout.tsx:8-12) and `/clear` (app/clear/route.ts:20) — both sit `UNMAPPED` in page-inventory.json (:43, :103); this PDS claims them.
- **Components:** StaleServiceWorkerReset (components/site/StaleServiceWorkerReset.tsx:26-57; mounted app/layout.tsx:130), InstallPrompt (components/pwa/InstallPrompt.tsx:25-100; mounted via components/layout/PublicClientLayer.tsx:28,52), manifest link (app/layout.tsx:107), manifest + icons (public/manifest.json, public/icons/).
- **Workers:** `public/sw.js` — hand-authored PUSH-ONLY worker, deliberately no fetch handler so it never interposes on a request (/sw.js:1-11; skipWaiting :17-18, clientsClaim :21-22, push :25, notificationclick :53); registered ONLY by broker opt-in (components/admin/push/BrokerPushOptIn.tsx:92). `app/sw.ts` — dormant serwist source (config :13-29, fallback matcher :19-28, addEventListeners :31).
- **Registers used (behavior fact only, no naming authority under amnesia):** /offline builds on `@/components/ui/button` + `components/site/primitives` H1 + legacy-flat SiteFooter (app/offline/page.tsx:4-6); /clear is raw inline HTML; InstallPrompt uses `@/components/ui/button` (InstallPrompt.tsx:4).
- **Actions/API/crons:** none belong to this process.
- **Known defects (each verified this run):**
  1. **The offline half is dormant.** No `withSerwist`/`swSrc` wrapper exists anywhere in the repo (grep this run: zero hits outside node_modules); next.config.ts:39-40 records "Serwist disabled for Turbopack" (commit 16188c2e message says the same); the build is Turbopack `next build` (package.json:16); both serwist deps sit installed and unused at runtime (package.json:417,486). Consequence: no precache, no runtime caching, no offline fallback ever executes; /offline is reachable only by typed URL.
  2. **The P1 registry row overstates inception.** "Browser installs the serwist service worker on first visit" (process-registry.json:381-383) describes app/sw.ts's design, not production behavior — the file at /sw.js in production is the push worker, and nothing registers any SW for public visitors. The row's completion sentence is half-right (the /clear half) and half-dormant (the /offline half). Registry correction is part of this deepening.
  3. **Leg A evicts the broker push worker.** StaleServiceWorkerReset unregisters ALL registrations with no allowlist (StaleServiceWorkerReset.tsx:32-40) and runs on every route including /admin (app/layout.tsx:127-130, mounted outside both HideOnLP and the PublicClientLayer admin-bail). A broker who enables push (BrokerPushOptIn.tsx:92 registers /sw.js at scope '/') loses the registration — and with it the push subscription — on their next page load anywhere on the origin. Mechanical code-read conclusion, not reproduced live this pass; cross-process blast radius (the push channel belongs to the admin plane) but the shared cause lives in this process's component.
  4. **/sw.js filename collision is planned but unresolved.** .gitignore:53-59 and /sw.js:9-11 both record the same IOU: if serwist is ever enabled it claims `/sw.js`, and the push listeners must be folded into the built worker. Until then two unrelated worker sources share one URL by convention.
  5. **Leg A would also kill our own future SW.** Enabling serwist (or any first-party worker for visitors) without retiring or allowlisting StaleServiceWorkerReset produces a register → evict → reload cycle on every load. The eviction component and the offline ambition are mutually exclusive as written; the component's own docblock still asserts "The app itself registers no caching service worker" (StaleServiceWorkerReset.tsx:23) — true for visitors, already false for brokers.
  6. **InstallPrompt's "visits" are not visits.** `pwa_visits` lives in sessionStorage (InstallPrompt.tsx:33-34): it counts full page loads within ONE tab session and resets when the session ends — so the "returning visitor" intent behind MIN_VISITS=2 actually gates on "two hard loads in one sitting," and a genuine returning visitor starts back at zero. Client-side route changes don't increment it either (the layout-mounted component doesn't remount).
  7. **Offline retry gives no feedback.** The /offline Try again button does nothing at all when still offline (the onLine guard, app/offline/page.tsx:19-23) — a silent click is an unanswered visitor question.
  8. **No install/recovery telemetry.** Neither install outcomes, banner impressions, evictions, nor /clear hits emit any event (grep this run) — the process is invisible to measurement, so its incidence rate is unknowable from our side.
  9. **No explicit cache headers for /sw.js.** vercel.json has no header rule for it (grep this run); prod response headers not verified this pass. A long-cached SW file slows worker updates — relevant the day the collision (defect 4) is resolved.
- **Duplicate/parallel paths that should die:** none within the process — but the two-worker-sources-one-URL arrangement (defect 4) is a parallel path in waiting and dies with the P3 sub-decision.

## 11. Target shape (process-level, not pixels)

**Should this exist?** Yes. The job, derived from first principles rather than today's files: **the client shell is always alive, always current, and recovers itself** — no visitor is ever permanently wedged, no network blip ends a session dishonestly, and the install surface only promises what the shell delivers. That job exists for any site; ours has scar tissue proving it (the cutover incident the recovery leg was built for).

- **The P3 sub-decision (binary, for the process-lock package):**
  - **(A) Wire offline for real.** One worker at /sw.js serving both jobs (offline shell + broker push — fold the listeners per the .gitignore IOU), built by whatever toolchain the build actually runs, StaleServiceWorkerReset retired or allowlisted to foreign scopes only, /offline reachable by design, SW cache headers set. Cost: build-pipeline change (webpack flag or serwist-Turbopack support) + careful rollout on an origin with eviction history.
  - **(B) Cut the dormant half.** Delete app/sw.ts, both serwist deps, and /offline; keep manifest + InstallPrompt + recovery legs; the shell story becomes "always-online site with automatic stale-shell recovery" — honest and smaller. Cost: no offline resilience; installed-app UX stays a plain window.
  - Either is coherent. The status quo — dormant source, unreachable fallback page, an eviction component at war with the ambition — is the only incoherent option.
- **Ideal step count:** recovery = ZERO visitor steps (today's leg C needs a human relay; the target is automatic detection — leg A already achieves this for every case where our JS runs, so /clear remains only as the out-of-band backstop). Offline (if A): one step (retry). Install: unchanged (browser-owned).
- **Device:** mobile-first per program truth; all legs are already device-agnostic.
- **Data gaps blocking correctness:** no telemetry (defect 8) means the P3 package cannot say how often visitors are wedged, how often the banner shows, or whether install correlates with return visits — instrument-first is a legitimate rider on either branch of the sub-decision.
- **Destination implication:** NOT a destination. `/offline` and `/clear` take the `SYSTEM` sentinel in page-inventory.json at P5; the process's real surface is a contract stamped on every page (the shell loads, current, recoverable) plus two system pages.
- **Dual objective this process stamps on its pages:**
  - `visitor_objective`: "Reach a working, current Ryan Realty — automatically repaired if your browser held a stale or broken copy, and honestly told when the connection, not the site, is the problem."
  - `machine_objective`: "Keep every capture surface reachable from every visitor's browser: recover otherwise-permanently-lost visitors (a wedged shell converts at zero) and return them to the exploration graph instead of losing the session."
  - `exits`: /offline → retry (reload) + `/` (home, back into the graph); /clear → `/` (automatic, ~1s); the site-wide leg is invisible and has no exits of its own — by design, since its success is the absence of any page at all.

## 12. Acceptance checks

Persist; never delete. Run against prod (https://ryan-realty.com) unless noted. Checks 1-6 prove TODAY's truth; 7-8 are conditional on the §11 sub-decision.

1. **/clear contract** — `curl -sI https://ryan-realty.com/clear` shows `Clear-Site-Data: "cache", "storage"` and `Cache-Control: no-store, max-age=0`; `curl -s https://ryan-realty.com/clear | grep -c 'url=/'` → `1` (the 1s meta refresh). Cookie preservation: the header names cache+storage only, never `"cookies"`.
2. **/offline serves and hides** — `curl -s -o /dev/null -w '%{http_code}' https://ryan-realty.com/offline` → `200`; body contains the offline H1 and `noindex, nofollow` meta; `grep -n offline app/sitemap.ts` → no route emission; robots.txt shows no Disallow for it (noindex must stay crawlable).
3. **/sw.js is push-only** — `curl -s https://ryan-realty.com/sw.js | grep -c "addEventListener('fetch'"` → `0` (the worker must not interpose on requests), and `grep -c "addEventListener('push'"` → `1`.
4. **Manifest + icons intact** — `curl -s https://ryan-realty.com/manifest.json` parses with `start_url` `/`, `display` `standalone`, theme `#102742`; each icon URL (`/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/icon-maskable-512.png`) returns 200.
5. **Hygiene leg works (browser check, clean profile + DevTools):** (a) load the homepage → Application → Service Workers shows NO registration created by the page; (b) manually run `navigator.serviceWorker.register('/sw.js')`, reload → registration is gone and CacheStorage is empty within one load (StaleServiceWorkerReset evicted it), and the page reloaded at most once. (This same check documents defect 3: it proves the push worker cannot survive a page view.)
6. **Dormancy is intentional, not accidental** — `grep -rn 'withSerwist\|swSrc' next.config.ts` → empty, AND next.config.ts still carries the lines 39-40 dormancy comment, AND `grep -n '"build"' package.json` shows no `--webpack`. If any of the three flips without a decisions.md line, the sub-decision was made by drift — fail the check.
7. **[Post-decision A] Offline round-trip on a real phone** — build emits a fetch-handling worker at /sw.js containing both the precache manifest and the push listeners (collision resolved); DevTools offline (and airplane mode on device): navigating to any warm route renders content or /offline — never the browser error page; StaleServiceWorkerReset is deleted or provably scoped to never touch the first-party worker (unit: register own SW, reload, registration survives).
8. **[Post-decision B] The dormant half is gone** — app/sw.ts and app/offline/ absent; `grep -n serwist package.json` → empty; /offline returns 404 with no sitemap/robots residue; this PDS's §10 defect list updated in the same commit.
