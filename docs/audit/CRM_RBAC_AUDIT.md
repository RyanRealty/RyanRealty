# CRM broker RBAC audit (Phase 10.1)

**Status:** audit only. No access behavior is changed by this document. This is the read-only map Matt needs before deciding the enforcement policy, because changing who-can-see-what is security-sensitive and must not be blind-shipped.

**Scope:** every `/admin/crm` (the `(protected)` group) + `/admin/console` CRM surface, every CRM server action, and every CRM cron that reads `crm_people` / `crm_timeline` / `crm_tasks` / `crm_sequence_enrollments`. For each: does it scope reads/writes by the current user's own `assigned_broker` (server-side), or does it expose ALL brokers' data?

**Method:** line-level reads of the guard chain and every consumer. Cited inline. Nothing here is inferred from naming.

---

## 1. The guard model as it exists today

### 1.1 The admin gate is is-admin + role, not per-broker scope

Both CRM layouts gate identically:

- `app/admin/(protected)/layout.tsx:29-36` — `getSession()` -> `getAdminRoleForEmail(email)`; redirect if no session or no admin role.
- `app/admin/console/layout.tsx:22-25` — same chain.

`getAdminRoleForEmail` (`app/actions/admin-roles.ts:37-53`) returns `{ role: 'superuser' | 'broker' | 'report_viewer', brokerId }`. The **superuser** is the hardcoded `isSuperuserAdmin(email)` short-circuit (line 41); `broker`/`report_viewer` come from the RLS-locked `admin_roles` table read via the service role.

**Key fact: the layout gate is purely "is this an admin." It does NOT carry a per-broker data scope into the page.** A signed-in `broker` (Rebecca, Paul) clears the same gate a `report_viewer` or `superuser` clears. Whatever scoping happens has to happen per-read, inside each action — it is not enforced by the layout.

### 1.2 `getCrmAccess()` is the only per-broker scope signal, and it is advisory

`app/actions/crm.ts:44-50`:

```ts
export async function getCrmAccess(): Promise<CrmAccess | null> {
  const session = await getSession()
  const email = session?.user?.email?.trim().toLowerCase() ?? null
  const role = await getAdminRoleForEmail(email)
  if (!role || !email) return null
  return { email, role: role.role, brokerSlug: CRM_BROKER_BY_EMAIL[email] ?? null }
}
```

`brokerSlug` resolves the caller's own slug from `CRM_BROKER_BY_EMAIL` (`lib/crm/constants.ts:13-17`: only `matt`, `rebecca`, `paul` are mapped). `requireCrmAccess()` (`app/actions/crm.ts:88-92`) only asserts `access != null` — it returns the access object but **does not itself apply any `assigned_broker` filter**.

So `getCrmAccess` gives every read the *information* needed to scope (the caller's `brokerSlug`, or `null` for a superuser / unmapped admin), but **each individual function decides whether to use it.** The result is inconsistent: some reads scope, some take the scope as an optional argument the caller may omit, and several ignore it entirely.

**The single most important consequence:** Matt's email maps to `matt`, so `getCrmAccess().brokerSlug` for Matt is `'matt'`, NOT `null`. The "superuser sees all" path keys on `brokerSlug == null`, which is only true for an admin whose email is NOT in `CRM_BROKER_BY_EMAIL`. Today there is no such admin. **There is effectively no "owner sees the whole book" identity** — Matt is scoped to `matt`-assigned leads on every read that uses `brokerSlug`, the same as Rebecca and Paul, and "all brokers" is reachable only by the explicit `?broker=all` URL override on the contacts list. (`role === 'superuser'` is read in a few list-page UI branches, but the data-layer reads key on `brokerSlug`, not `role`.)

---

## 2. Surface-by-surface categorization

Legend:
- **(a) broker-scoped** — server-side filters to the caller's own `assigned_broker`.
- **(b) intentionally all-brokers** — a shared/observability view where all-brokers is the design intent.
- **GAP** — leaks other brokers' data and probably should scope.

### 2.1 Reads — lists and dashboards

| Surface | Function (file:line) | Scopes by `assigned_broker`? | Category |
|---|---|---|---|
| Contacts list `/admin/crm` | `listCrmPeople` (`crm.ts:105-175`) via page `crm/page.tsx:39-46` | Filters `assigned_broker` only if `filters.broker` is set. Page passes `effectiveBroker = sp.broker==='all' ? undefined : sp.broker \|\| defaultBroker`, and `defaultBroker = role==='broker' ? brokerSlug : undefined`. A `broker` lands on own leads by default, but ANY caller can pass `?broker=all` to load every broker's book. | **(a) scoped by default, but client-overridable** — see GAP-1 |
| Console leads `/admin/console/leads` | `listCrmPeople` via `leads/page.tsx:74-80` (`broker: access?.brokerSlug ?? undefined`) | Yes — server passes the caller's own slug; no URL override on this route. | (a) broker-scoped |
| Command palette (⌘K) | `consoleSearchLeads` (`console.ts:11-23`) | Yes — `broker: access.brokerSlug ?? undefined`. | (a) broker-scoped |
| Stage chips / counts | `getCrmStageCounts(brokerSlug)` (`crm.ts:523-535`) — console page passes `access?.brokerSlug` | Yes when caller passes its slug. | (a) broker-scoped (caller-dependent) |
| Saved-view counts | `getCrmSavedViewsWithCounts(brokerSlug)` (`crm.ts:546-565`) — console passes slug | Yes when caller passes its slug. | (a) broker-scoped (caller-dependent) |
| Home dashboard | `getCrmHomeDashboard(broker?)` (`crm.ts:229-283`) | Only if caller passes `broker`. `withBroker` no-ops when arg is undefined. | (a) scoped iff caller passes — see GAP note |
| Broker command center | `getBrokerCommandCenterData` (`broker-command-center.ts:95-377`) | Yes — `isSuperuser` short-circuits; otherwise `crmSlug`-scopes tasks (line 232) + active clients (line 258), and broker-display-name-scopes deals (line 135). | (b/a) intentional: superuser all, broker own |
| Broker action queue | `getBrokerActionQueue` (`crm.ts:1386-1440`) | Yes — `if (access.brokerSlug) q.eq('crm_people.assigned_broker', brokerSlug)`. | (a) broker-scoped |
| New leads / activity feed | `getRecentNewLeads` (`crm.ts:629-649`), `recentActivityPeople` (`crm.ts:576-602`) | Yes — `getRecentNewLeads` self-scopes; `recentActivityPeople` filters in-app on `brokerSlug` when the dashboard passes `feedSlug`. | (a) broker-scoped |
| CRM overview KPI strip | `getCrmOverview` (`crm.ts:186-205`) | **No** — every count (`total`, `sellers`, `buyers`, `hardStops`, `openTasks`) is global, no `assigned_broker` filter. Rendered as the headline stat strip on `/admin/crm` for every broker. | **GAP-2** |
| **Tasks page** `/admin/crm/tasks` | `listCrmOpenTasks(broker?)` (`crm.ts:1029-1054`) via `tasks/page.tsx:53-55` | **No default scope** — page reads `broker` from the URL `?broker=` only. With no param it returns ALL brokers' open tasks; the page advertises "open across the book" and renders a broker filter that defaults to "All". | **GAP-3** |
| **Inbox page** `/admin/crm/inbox` | `listCrmConversations` (`crm.ts:671-699`) via `inbox/page.tsx:20-42` | **No** — fetches every broker's inbound + outbound conversations. The page filters the "Assigned" tab client-side by `assignedBroker === slug` (line 40), but the "Inbox" and "Sent" tabs render ALL brokers' messages. | **GAP-4** |
| Global inbox feed | `listCrmInbox` (`crm.ts:497-515`) | **No** — global inbound feed, no scope. (Currently unreferenced by a page, but exported.) | GAP (latent) |
| **Approvals page** `/admin/crm/approvals` | `getAwaitingApprovals` (`crm.ts:1161-1190`) | **No** — reads every `awaiting_broker` enrollment across all brokers; renders each with a Send/Skip/Dismiss button and the `assignedBroker` label. | **GAP-5** |
| **Workflows board** `/admin/crm/workflows` | `getWorkflowBoard` (`crm.ts:1497-1536`) | **No** — reads all active enrollments across all brokers; exposes `personName` + `assignedBroker` for every lead in every sequence. | **GAP-6** |
| **Pipeline (deals)** `/admin/crm/deals` | `listCrmDeals` (`crm.ts:712-723`) | **No** — every `crm_deals` row with the embedded `crm_people.name`, no scope. | **GAP-7** |
| Sequences page `/admin/crm/sequences` | `listCrmSequences` (`crm.ts:817-837`) | N/A — sequence definitions + aggregate enrollment counts, no per-person data. | (b) intentionally shared (config) |
| Health board `/admin/crm/health` | `getSuppressionCounts`, `getCrmSignalFreshness`, `getCrmLeadVolume`, `getCrmContactTotal` | **No** (by design) — system vital-signs (mirror on/off, A2P, suppression footprint, lead volume), not per-lead data. The page header documents this as a global observability surface. | (b) intentionally all-brokers |
| Broker licenses card | `listBrokerLicenses` (`crm.ts:865-873`) | Page-level: the contacts page filters to own-license for a broker, full roster for superuser (`crm/page.tsx:52-54`). The action itself returns all. | (b) intentional, page-filtered |

### 2.2 Reads — the contact detail (the highest-value leak)

| Surface | Function (file:line) | Scopes? | Category |
|---|---|---|---|
| **Lead command center** `/admin/console/leads/[id]` | `getCrmPersonFull(id)` (`crm.ts:326-393`) | **No** — takes only `id`. Loads the person, full `crm_timeline` (100 rows + merged `visitor_events`), `crm_tasks`, `crm_contact_points`, `crm_suppressions`, `crm_sequence_enrollments`, `fub_person_geo`, `cma_deliveries`, and visitor sessions. **No `assigned_broker` check anywhere.** | **GAP-0 (highest risk)** |
| `/admin/crm/[id]` | redirect only (`crm/[id]/page.tsx:16-18`) -> `/admin/console/leads/[id]` | Inherits GAP-0. | GAP-0 |
| Detail side-panels | `getContactMemberships`, `getContactActivityFeed`, `getContactBehaviorSummary`, `getContactRelationships`, `getContactListingAlerts`, `getGuestSearchAlertsForLead`, `getViewedListingsForLead`, `getNewsletterMembershipForLead`, `getNextRecommendation` — all keyed off `person.id` / `fub_legacy_id` from the page (`leads/[id]/page.tsx:272-282`) | **No** — every one takes the person id with no broker check; they trust that the page already authorized the lead. | GAP-0 (same root) |

`getCrmPersonFull` is the root: every other panel on the page is fed the `person.id` it returns, so once the page renders one broker can read another broker's entire 360 by visiting `/admin/console/leads/<any id>`.

### 2.3 Mutations — the write side

The write side is **inconsistent**: a few actions enforce broker ownership, most do not.

| Action (file:line) | Ownership check? | Category |
|---|---|---|
| `completeCrmTaskAction` (`crm.ts:1121-1141`) | **Yes** — `if (role !== 'superuser' && brokerSlug && task.assigned_broker !== brokerSlug) return not authorized` (line 1131). | (a) scoped |
| `setEnrollment` (`crm.ts:1192-1227`) — backs `approveEnrollmentAction`, `skipFirstTouchAction`, `dismissEnrollmentAction`, `pauseEnrollmentAction`, `resumeEnrollmentAction`, `confirmNextStepAction` | **Yes** — re-reads the enrollment's `crm_people.assigned_broker` and refuses if `owner !== brokerSlug` for a non-superuser (lines 1202-1210). | (a) scoped |
| `addCrmNoteAction` (`crm.ts:408-431`) | **No** — `requireCrmAccess()` only; writes a note/timeline to any `personId`. | **GAP-W** |
| `sendCrmEmailAction` (`crm.ts:434-483`) | **No** — sends a 1:1 email to any `personId` (suppression-gated, but not broker-gated). | **GAP-W** |
| `sendCrmSmsAction` (`crm.ts:762-805`) | **No** — same; texts any `personId`. | **GAP-W** |
| `updateCrmStageAction` (`crm.ts:919-942`) | **No** — restages any `personId`. | **GAP-W** |
| `addCrmTagAction` / `removeCrmTagAction` (`crm.ts:944-983`) | **No** — tags/untags any `personId`. | **GAP-W** |
| `addCrmTaskAction` (`crm.ts:985-1016`) | **No** — adds a task to any `personId`. | **GAP-W** |
| `assignCrmBrokerAction` (`crm.ts:876-917`) | **No** — reassigns any `personId` to any broker. (Reassignment is arguably a superuser-only op; today any admin can move any lead.) | **GAP-W (elevated)** |
| `setSequenceEnrollment` (`crm-membership.ts:68-118`) | **No** — enroll/unenroll any `personId`. | GAP-W |
| `setNewsletterSubscription` (`crm-membership.ts:132-200`) | **No** — sub/unsub any `personId` (compliance-gated, not broker-gated). | GAP-W |
| `setListingAlertsPaused` (`crm-membership.ts:213-236`) | **No** — pause/resume any `personId`'s alerts. | GAP-W |
| `linkContacts` / `unlinkContacts` / `setRelationshipType` (`crm-relationships.ts`) | **No** — relate/unrelate any two `personId`s. | GAP-W |
| `createCrmContactAction` (`crm.ts:1061-1119`) | N/A — creates a new contact; defaults assignment to the caller's own slug (line 1069). | (a) fine |

**The write-side asymmetry is the dangerous part:** the read side at least lands a broker on their own list by default, but the mutation actions take a raw `personId` from a form and trust it. Because they are `'use server'` functions (public POST endpoints), a broker who knows or guesses a `personId` can note/email/text/restage/retag/reassign another broker's lead with no ownership check. `completeCrmTaskAction` and the enrollment actions show the intended pattern — the other mutations simply never adopted it.

### 2.4 Crons — system-keyed, correctly NOT broker-scoped

| Cron | Auth (file:line) | Broker scope | Category |
|---|---|---|---|
| `crm-sequence-engine` | `CRON_SECRET` bearer (`crm-sequence-engine/route.ts:36`) | Processes every due enrollment across all brokers; stamps each send with the lead's own `assigned_broker` (lines 235, 319, 376). | (b) correct — a system process acts for the whole book |
| `crm-auto-enroll` | `CRON_SECRET` (`crm-auto-enroll/route.ts:21`) | Enrolls all eligible leads, carrying each lead's `assigned_broker` (line 59). | (b) correct |
| `crm-smart-followups` | `CRON_SECRET` (`crm-smart-followups/route.ts:29`) | Operates on all leads, defaulting `assigned_broker` to `matt` where absent (line 101). (Orphaned per the buildout — schedule-or-delete, separate from RBAC.) | (b) correct |

Crons are not a broker-scoping concern: they are authenticated by the shared secret and act as the system, not as a logged-in broker. No change recommended here for RBAC. (`isAuthorizedAdminOrCron` in `lib/auth/guards.ts:63-67` correctly fuses the two for any dual-mode endpoint.)

---

## 3. The GAP register, with the exact minimal scoping change

The fix in every case is the same shape: derive the caller's scope from `getCrmAccess()` server-side and apply it as a filter on the query the action already runs. Below, "scoped predicate" means: when `access.brokerSlug` is non-null **and** the policy says a broker is restricted, add `.eq('assigned_broker', access.brokerSlug)` (or the embedded-table equivalent `.eq('crm_people.assigned_broker', …)`); when it is null (a future unmapped owner/superuser identity) apply no filter.

> **Policy decision Matt must make first (this audit does not assume it):** today Matt's email maps to `matt`, so Matt is treated as a broker, not an owner. Pick ONE before any scoping ships:
> - **Option A — Matt is the owner/superuser:** make the all-brokers path key on `role === 'superuser'` (not `brokerSlug == null`), so Matt keeps seeing everything while Rebecca/Paul get scoped. Cleanest, matches the "a superuser sees the whole book" line in the buildout (§10.1).
> - **Option B — Matt is just another broker:** keep keying on `brokerSlug`, accept that Matt sees only `matt`-assigned leads, and reach "all" via the explicit override. Higher privacy, but Matt loses the at-a-glance whole-book view.
>
> Every fix below is written against a `scopeBroker(access)` helper that encodes whichever option is chosen, so the policy lives in one place.

### GAP-0 — Contact 360 detail leaks any lead by id (HIGHEST RISK — FLAGGED)

- **Where:** `getCrmPersonFull(id)` (`crm.ts:326-393`); consumed by `/admin/console/leads/[id]` and (via redirect) `/admin/crm/[id]`.
- **Leak:** a broker visiting `/admin/console/leads/<any id>` reads another broker's full record — every timeline message (inbound/outbound SMS + email bodies), tasks, contact points, suppressions, enrollments, home address + geo, and CMA history. This is the broadest and most sensitive exposure because it is one URL away and returns everything about a person.
- **Minimal change (no behavior applied here):** after the `person` row loads, gate before returning the bundle:
  ```ts
  const access = await getCrmAccess()
  if (!access) return EMPTY            // already enforced by the page, but make the action self-guard
  if (scopeBroker(access) && person.assigned_broker !== scopeBroker(access)) {
    return EMPTY_PERSON_FULL           // page already calls notFound() on a null person
  }
  ```
  The page (`leads/[id]/page.tsx:253-254`) already does `if (!person) notFound()`, so returning an empty bundle for an out-of-scope lead produces a clean 404 with no new UI. Because every side-panel reader is fed `person.id` from this same bundle, gating here closes the whole panel set at once.
- **Why first:** highest blast radius, lowest fix cost (one function), and it is reachable by a single hand-typed URL.

### GAP-1 — Contacts list `?broker=all` override is client-trusted

- **Where:** `crm/page.tsx:40` — `effectiveBroker = sp.broker === 'all' ? undefined : …`. Any signed-in admin can append `?broker=all` and `listCrmPeople` then runs with no `assigned_broker` filter.
- **Minimal change:** clamp the override server-side — `const allBrokersAllowed = scopeBroker(access) === null` (i.e. only an owner/superuser may drop the filter); if a restricted broker passes `?broker=all`, ignore it and fall back to their own slug.

### GAP-2 — `getCrmOverview` KPI strip is global

- **Where:** `getCrmOverview` (`crm.ts:186-205`), rendered as the headline stats on `/admin/crm`.
- **Minimal change:** accept an optional `brokerSlug` (mirroring `getCrmStageCounts`) and add `.eq('assigned_broker', brokerSlug)` to the `crm_people`/`crm_tasks` head-counts when scoped; have the page pass `access.brokerSlug` through `scopeBroker`.

### GAP-3 — Tasks page defaults to all brokers

- **Where:** `listCrmOpenTasks(broker?)` (`crm.ts:1029-1054`) + `tasks/page.tsx:53-55`, which reads `broker` from the URL and defaults to none.
- **Minimal change:** inside `listCrmOpenTasks`, default to the caller's own scope instead of "all": `const effective = broker ?? scopeBroker(access); if (effective) q = q.eq('assigned_broker', effective)`. Restricted brokers can't widen past their own slug.

### GAP-4 — Inbox shows all brokers on the Inbox/Sent tabs

- **Where:** `listCrmConversations` (`crm.ts:671-699`) — fetches everything; `inbox/page.tsx` only scopes the "Assigned" tab client-side.
- **Minimal change:** add an optional `brokerSlug` arg and, when scoped, filter both queries by the embedded owner — `.eq('crm_people.assigned_broker', brokerSlug)` on the inbound and outbound selects (both already inner-join `crm_people`). Page passes `scopeBroker(access)`.

### GAP-5 — Approvals queue shows all brokers' pending first-touches

- **Where:** `getAwaitingApprovals` (`crm.ts:1161-1190`) — reads every `awaiting_broker` enrollment with a Send/Skip/Dismiss button.
- **Note:** the *write* is already protected (`setEnrollment` refuses an out-of-scope lead), so this is a read-exposure (names, sources, prepared message bodies) not a write hole. Still, a broker shouldn't see another broker's queued leads.
- **Minimal change:** the query already inner-joins `crm_people`; add `if (scopeBroker(access)) q = q.eq('crm_people.assigned_broker', scopeBroker(access))`.

### GAP-6 — Workflow board shows all brokers' enrollments

- **Where:** `getWorkflowBoard` (`crm.ts:1497-1536`) — every active enrollment with `personName` + `assignedBroker`.
- **Minimal change:** the enrollment query inner-joins `crm_people`; add `.eq('crm_people.assigned_broker', scopeBroker(access))` when scoped. (Sequence *definitions* stay shared.)

### GAP-7 — Pipeline/deals shows all brokers

- **Where:** `listCrmDeals` (`crm.ts:712-723`), `/admin/crm/deals`.
- **Caveat:** `crm_deals` has no `assigned_broker` column; scope would route through the embedded `crm_people.assigned_broker` (add the embed to the select + filter) OR via the broker who owns the linked person. Confirm the column model before writing the filter — this is the only GAP whose fix needs a schema check first (read `docs/DATABASE_SCHEMA_SNAPSHOT.md` for `crm_deals` before implementing). Lower priority: deals are pre-contract pipeline and Vault is the system of record post-contract.

### GAP-W — Mutation actions trust a raw `personId`

- **Where:** `addCrmNoteAction`, `sendCrmEmailAction`, `sendCrmSmsAction`, `updateCrmStageAction`, `addCrmTagAction`, `removeCrmTagAction`, `addCrmTaskAction`, `assignCrmBrokerAction` (`crm.ts`), plus the membership + relationship actions.
- **Minimal change (one shared guard):** add a helper next to `requireCrmAccess` —
  ```ts
  async function requirePersonInScope(personId: number, access: CrmAccess):
    Promise<{ ok: true } | { ok: false; error: string }> {
    const slug = scopeBroker(access)
    if (!slug) return { ok: true }                 // owner/superuser: unrestricted
    const sb = createServiceClient()
    const { data } = await sb.from('crm_people')
      .select('assigned_broker').eq('id', personId).maybeSingle()
    if (!data || data.assigned_broker !== slug) return { ok: false, error: 'not authorized for this contact' }
    return { ok: true }
  }
  ```
  Call it right after `requireCrmAccess()` in each mutation, exactly the way `completeCrmTaskAction` (line 1131) and `setEnrollment` (lines 1202-1210) already do their inline checks. `assignCrmBrokerAction` is the one to weigh separately — reassigning a lead may warrant superuser-only, a policy call for Matt.

---

## 4. Recommended rollout

Sequence by blast radius vs. breakage risk. None of this is applied yet.

1. **Decide the policy (Option A vs B) and land `scopeBroker(access)` as a single pure helper.** Unit-test it (owner -> null, mapped broker -> own slug). Everything else depends on it. Zero behavior change until a caller uses it.

2. **Close the write holes first (GAP-W).** Mutations are the real damage path (a broker texting/restaging/reassigning another broker's client), and the fix is one shared `requirePersonInScope` guard that mirrors code already proven in `completeCrmTaskAction`. Low regression risk because the legitimate flow (a broker acting on their own lead) is unaffected; only cross-broker writes start refusing. Verify each action's happy path still passes with a vitest using a same-slug fixture and a cross-slug fixture.

3. **Close GAP-0 (contact 360).** Single function, highest read exposure, clean 404 on out-of-scope. Watch for one breakage: the broker command center, approvals, workflows, and pipeline all deep-link to `/admin/crm/<id>` — if those lists are scoped (step 4) the links a broker sees will already be in-scope, so the 404 only fires on hand-typed or stale URLs. Do step 4's list-scoping in the same release to avoid a broker clicking a card and hitting a 404.

4. **Scope the all-brokers read surfaces (GAP-1..7).** Each is a one-line predicate on a query that already inner-joins `crm_people` (except GAP-2 overview and GAP-7 deals). Ship them together so the navigation stays consistent (a broker's list, approvals, workflows, tasks, inbox, and the cards they click all show the same scoped set). **The one thing that breaks if mis-sequenced:** scoping a list before scoping the detail it links to is fine (detail 404s safely); scoping the detail before the lists means a broker still *sees* cross-broker cards that now 404 on click — so do lists + detail together.

5. **Leave the intentional all-brokers surfaces alone:** health board, sequence definitions, the crons. They are observability/config/system, not per-broker data, and scoping them would break the health view and the engine.

6. **Hold `assignCrmBrokerAction` for a separate decision.** Lead reassignment is plausibly an owner-only operation; bundling it into the broker-scope pass would let a broker reassign within their own book but not steal — confirm with Matt whether reassignment is broker-self-service or owner-only.

### What could break (summary)

- A broker who relied on `?broker=all` or the global tasks/inbox/approvals views to triage the whole shop will suddenly see only their own book. If that whole-shop visibility is desired for Matt, that is exactly what Option A preserves — so the policy choice in step 1 is what determines whether this is a "fix" or a "regression" for Matt specifically.
- Deep links to out-of-scope leads (bookmarks, old emails, cross-broker references) will 404 after GAP-0. Acceptable and expected, but worth a heads-up so a broker doesn't read it as a bug.
- `crm_deals` (GAP-7) needs a schema confirm before its filter can be written; don't ship it blind.

---

## 5. The one-line answer for Matt

There is **no server-side broker-scope enforcement layer** — the admin gate is "is-admin" only, and `getCrmAccess()` merely *offers* the caller's slug that each read/write may or may not use. Result: the lead-detail 360 (`getCrmPersonFull`) and the global tasks / inbox / approvals / workflows / pipeline views expose every broker's leads, and most mutation actions will act on any `personId` with no ownership check. **The highest-risk single GAP is GAP-0: any broker can open any lead's full record by visiting `/admin/console/leads/<id>`.** Fix order: land a `scopeBroker` policy helper, close the write holes, close GAP-0, then scope the list surfaces in one release.
