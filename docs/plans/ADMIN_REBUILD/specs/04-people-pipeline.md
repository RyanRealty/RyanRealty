# Spec 04 — People: Contacts List · Pipeline Board · Person Data

> **Status:** authored 2026-07-16. Gates coding for the People area of the admin rebuild.
> **Upstream:** `00-REASONING-AND-ARCHITECTURE.md` (RC1–RC7, C1–C5, §4 forced decisions, §5 IA).
> **Evidence base:** `audit-reports/crm-people.md` (every claim below cites its `file:line`).
> **This spec conforms to §4; it does not re-litigate it.**

This spec owns the `PEOPLE` destination of the target IA (`00 §5`): one responsive
contacts **list**, one **pipeline board** (a mode of that same surface), and the
**person data core** — the fields, inline edits, custom fields, merge, saved views,
and the person-scoped timeline. The **person workspace** (respond + send CMA/BPO/
newsletter in one place) is speced in `03-inbox-conversations.md` (the composer +
conversation model) and `05-send-center.md` (the send paths). Where those seams meet,
this spec names the boundary and defers, never duplicates.

---

## 0. The job this area serves (tie to C2 loop)

In the core loop (`00 §1 C2`), People is where the broker **finds the human** and
**reads their state** before responding, and where the pipeline as a whole is
triaged. The three surfaces map to three verbs:

- **List** — *find* one contact fast (search), or *select many* for a bulk touch.
- **Board** — *see the pipeline* as columns and *move* a person between stages.
- **Person data** — *read and correct* who this person is (name, phones, emails,
  stage, tags, custom fields) so every downstream send merges the right values.

The owner's pains this area is on the hook for (`00 §2`, `crm-people.md §0`):
- "behaves completely differently on mobile vs desktop" → **RC3**: this spec deletes
  the fork. One tree.
- "bloated / duplicated / confusing" → **RC4**: this spec collapses the ×3/×5 widget
  duplication to one canonical home each (§7).
- "slow to load" → **RC2 + RC4 + §4.6**: this spec kills the ~85-query list fan-out
  and the ~50-query person fan-out.
- Silent mobile write failures → **RC6**: this spec bans void-returning mutation
  wrappers; every write returns a typed result the UI renders (§5.2, §8).

---

## 1. Keep / Rebuild / Delete ledger

Explicit, per the audit. **Nothing on the kept-core list is discarded.**

### 1.1 KEEP (reuse verbatim or with additive changes only)

| Kept item | Evidence it is solid | How this spec uses it |
|---|---|---|
| **`buildCrmPeopleQuery` AST→SQL compiler** with broker scope clamped inside (invariants 1–3) | `buildCrmPeopleQuery.ts:12–24, 270–315`; `crm-people.md §10` | The ONE query path for list rows, board columns, every count, every bulk id-set. Untouched. |
| **`CRM_PEOPLE_SELECT` projection + `select` override** | `buildCrmPeopleQuery.ts:50–52, 279` | List and board read the same compiler; board passes a superset select for card fields. |
| **Bulk-job framework** (2-mode selection, preflight count + suppression estimate, chunked worker, progress poller) | `BulkActions.tsx` (977 lines); `crm-people.md §1.4, §10` | Reused as-is; made available responsively (§3.5) instead of `max-md:hidden`. |
| **Broker RBAC scope** (`scopeBroker`, `isPersonInScope`, `requirePersonInScope`, self-scoping `listCrmPeople`, self-guarding `getCrmPersonFull`) | `scope.ts:34–53`; `crm-people.md §2.4, §10` | The authorization substrate for every read and write in this area. Extended, not replaced (§5.5 collaborators fix). |
| **`getSendTarget`** primary-phone/email resolver | `getSendTarget.ts:30–56` | Kept; its jsonb-sort correctness depends on the contact-point mirror this spec makes single-writer (§2.3). |
| **`mergePeopleCore`** — the ONE merge path | `crm.ts` merge core; memory `reference_crm_merge_core.md` | The single merge implementation behind the one canonical merge entry point (§5.4). |
| **`getContactConversation`** cursor pagination (50/page) | `getContactConversation.ts`; `crm-people.md §3.2, §10` | The pagination model the person timeline adopts (§5.6) — replaces the capped-100 reader. |
| **`getPeopleListSignals`** (Last Visit + Last Activity per row) | `getPeopleListSignals.ts:41–63` | Kept; moved off the blocking path into a streamed region (§3.7). |
| **Mobile Edit sheet** field-diff + dirty-track + pending + error banner | `MobileEditSheet.tsx`; `crm-people.md §3.2, §10` | Its interaction model (per-row diff, dirty tracking) becomes the **one** edit pattern for all form factors — not deleted, promoted. |
| **`getCrmStageCounts`** scoped counting through the compiler | `getCrmStageCounts.ts:21–38` | Kept; wrapped in the cached/lazy count layer (§2.2, §3.6) so it leaves the blocking path. |
| **`addRelationshipContactAction`** dedupe-before-create with ambiguity refusal | `crm-person-detail.ts:463–491`; `crm-people.md §10` | Kept as the relationship-add path. |

### 1.2 REBUILD (same capability, new interaction/render/data-integrity)

| Rebuild | From (audit) | To |
|---|---|---|
| **One responsive list tree** | dual desktop `PeopleListView` (793 lines) + mobile `MobilePeopleRoot`, CSS-toggled, both SSR'd (`crm-people.md §1.3, §1.5, §8`) | One `PeopleList` that adapts by container query. Mobile-first. §3. |
| **Search box on every form factor** | desktop has none (3-click filter panel); mobile-only `ContactsSearch` (`§1.3.1, §1.2`) | Always-visible search input, compiler `q` field, partial-match. §3.2. |
| **Inline row edit (stage) + compliant quick-text/-call** | row is navigate-only; stage edit = 5 clicks through bulk machinery; raw `sms:`/`tel:`/`mailto:` bypass Twilio (`§1.3.2, §1.3.6`) | Inline stage popover (optimistic); Text/Call/Email route into the compliance-gated composer. §3.4. |
| **Pipeline board (one system)** | pipeline exists only as a sidebar stage-strip + `?stage=` filter + a "Pipeline" saved-view collection (`PeopleSidebar.tsx:85`); no board | List⇄Board toggle on the same surface; drag-to-restage. §4. |
| **Inline person edit, all fields, all form factors, no silent swallow** | name editable mobile-only; 5 mobile wrappers swallow errors to `console.error`+void (`§2.2.1, §2.3`) | Every field inline-editable everywhere; every mutation returns `{ok,error?,entity?}`; UI renders the error. §5.2, §8. |
| **Contact-point single source of truth** | 3 writers, only 2 mirror to jsonb; delete-then-insert non-atomic (`§2.4`) | One `writeContactPoints` mutation, atomic RPC, always mirrors; a DB trigger as fail-safe. §2.3. |
| **Person timeline pagination** | newest-100 cap, no load-more, exact tab badges that lie (`§2.2.2`) | Cursor-paginated timeline; badges are exact head-counts AND load-more reaches the full set. §5.6. |
| **Saved-view / stage / sequence count layer** | ~40 view COUNTs + ~8 stage COUNTs + 5×N discarded sequence COUNTs per render, uncached, blocking (`§1.1, §6`) | Cached + lazy + batched; zero sequence counts on the list; §2.2, §3.6. |
| **Column config persistence** | per-browser localStorage keyed by view id, resets in private mode (`§1.3.4`) | Server-stored per-user pref (`crm_user_prefs`), synced across devices. §2.4. |
| **One create surface** | `/crm/new` page and `AddPersonDialog` with divergent field sets (`§4`) | One `AddPersonForm` (a sheet), one field set, reachable from list + board + shell FAB on every form factor. §3.8. |

### 1.3 DELETE (dead / placebo / duplicate — remove, do not port)

| Delete | Evidence |
|---|---|
| `ContactActivityFeed.tsx` — zero importers | `crm-people.md §9` |
| `NextStepCard.tsx` — zero importers; `getContactNextStep` fetched only for a boolean | `§2.2 (rail), §9` |
| PersonSidebar **Social Profile** + **Groups** sections — fed `[]` permanently | `§2.2.1, §9` |
| **Lead Score** default column — no model, permanent em-dash | `§1.3.3, §9` |
| "How it works" span, `→/←` keyboard hint (no handler), "SEE ALL" span | `§2.2.2, §2.2.4, §3.2 (Homes), §9` |
| `?view=mobile` production test-harness route | `§3.1, §9` |
| `openTasks = tasks.filter((t)=>t)` no-op | `§9` |
| The **duplicate** bulk icon strip (rendered twice) | `§1.3.5` |
| **"Automations" rail widget** (duplicate of Action Plans, same enrollments) | `§2.2.4` |
| **2 of 3** market-report-subscription editors; **2 of 3** saved-search widgets; **2 of 3** CMA/BPO surfaces on the person page (collapse to one each — §7) | `§2.2.5, §7` |
| Desktop native `sms:`/`tel:`/`mailto:` links | `§1.3.2` |
| `deleteCrmPersonAction`'s dead `?flash=` round-trip | `§1.3.8, §9` |

---

## 2. Data model

Source of truth for a person is **`crm_people`** (schema snapshot L1773–1808). This
spec adds **only additive, back-compatible** migrations. No column is dropped; no
existing reader breaks.

### 2.1 Reused tables (no schema change)

- **`crm_people`** — the person row. Fields this area reads/writes: `name`,
  `first_name`, `last_name`, `stage`, `source`, `assigned_broker`, `tags` (text[]),
  `emails`/`phones` (jsonb mirrors — see §2.3), `addresses`, `custom` (jsonb),
  `price`, `timeframe`, `lender_name`, `background`, `neighborhood_slug`,
  `subdivision`, `pond_id`, `deleted`, `last_activity_at`, `fub_created_at`.
- **`crm_contact_points`** (L1583–1593) — `(person_id, kind, value, label,
  is_primary, status)`. **Promoted to the single source of truth for phones/emails**
  (§2.3).
- **`crm_saved_views`** (L1910–1927) — `ast` (jsonb), `owner_email`, `is_shared`,
  `is_protected`, `position`. Read via `getCrmSavedViews`.
- **`crm_stages`** (L2017+) — the pipeline columns (active, ordered).
- **`crm_field_definitions`** (L1692–1701) — custom-field defs (`key,label,type,
  options,position,hide_if_empty`). Values live in `crm_people.custom`.
- **`crm_timeline`** — the immutable activity ledger (notes, calls, system events).
  Message rows are read through the **conversation model** owned by spec 03 (§5.6).
- **`crm_conversation_state`** (L1595–1606) — per-person unread/assigned tracking;
  read by the list row "needs reply" dot (§3.3).
- **`crm_people_collaborators`** (L1810–1817) — extended to actually grant scope (§5.5).

### 2.2 New: `crm_list_count_cache` — the count layer (kills the fan-out · §4.6)

The list/sidebar/board must never run 40 view-COUNTs + 8 stage-COUNTs synchronously
on every render (`crm-people.md §1.1, §6`). Two mechanisms, both additive:

**(a) `unstable_cache` wrapper (primary).** All reference counts resolve through one
DAL function `getCrmListCounts(access)` returning `{ stages: CrmStageCount[], views:
{id,count}[], total }`. Internally it is wrapped in `unstable_cache` **keyed by the
broker scope slug** (`scopeBroker(access) ?? '*'`) and a hash of the active view set,
with:
- **TTL 60s** (a 3-broker shop does not need second-accurate badge counts), and
- **tags** `['crm-counts', 'crm-counts:'+scope]` invalidated by any person-mutating
  action (stage change, create, delete, bulk job completion) so a visible change
  reflects within one interaction, not 60s.

Scope is in the **cache key**, never omitted — a count keyed without scope would leak
one broker's book into another's badge (the exact reason `getCrmSavedViews` is
documented "NOT cached", `getCrmSavedViews.ts:19–22`; caching becomes safe *only*
with scope in the key).

**(b) `crm_list_count_cache` table (durable fallback / cross-request warm).**

```sql
-- migration: additive, back-compatible
create table if not exists public.crm_list_count_cache (
  scope        text        not null,          -- broker slug or '*' for superuser
  kind         text        not null,          -- 'view' | 'stage' | 'total'
  key          text        not null,          -- view id / stage key / 'all'
  count        integer     not null,
  computed_at  timestamptz not null default now(),
  primary key (scope, kind, key)
);
```

A single cron (`crm-count-warm`, every 5 min, `isAuthorizedCron` fail-closed) recomputes
counts per scope through `buildCrmPeopleQuery(countOnly)` and upserts. The DAL reads
the table first (cheap single round-trip), falls back to a live compile on a miss.
The blocking render never runs N live COUNTs.

**Sequence counts are removed from this area entirely.** The list only needs sequence
**id + name** for the bulk "Apply Automation" picker (`crm-people.md §1.1`,
`page.tsx:177–179`). Add `listCrmSequenceOptions()` returning `{id,name}[]` with **no**
enrollment counts. The 5×N enrollment COUNTs move to the sequences settings surface
(spec `crm-settings-automation.md`), computed lazily there.

### 2.3 New: contact-point single-writer + mirror trigger (kills the 3-writer drift)

Today three writers touch phones/emails and only two mirror to the jsonb cache
(`crm-person-detail.ts:189–205, 260–279` mirror; `crm.ts:1228–1251`
`addCrmContactPointAction` **does not**). A phone added via the mobile "Add phone"
flow is invisible to the list columns and can cause `getSendTarget` to text the wrong
number (`crm-people.md §2.4`).

**Fix — one writer + a DB fail-safe:**

1. **One mutation module** `lib/data/crm/contactPoints.ts` exporting the ONLY
   contact-point writer:
   ```ts
   writeContactPoints(personId: number, kind: 'phone'|'email',
     rows: ContactPointInput[]): Promise<{ ok: true } | { ok: false; error: string }>
   ```
   It performs the replace **atomically** via a Postgres RPC `crm_replace_contact_points(p_person_id, p_kind, p_rows jsonb)`
   (delete + insert in one transaction — fixing the non-atomic delete-then-insert
   that can wipe every phone on a failed insert, `crm-person-detail.ts:167–187`),
   then rebuilds the `crm_people.{phones|emails}` jsonb mirror from the resulting
   rows **carrying `isPrimary` + `normalized`** (the fields `getSendTarget`/send paths
   sort on). `savePhoneNumbersAction`, `saveEmailRowAction`, and
   `addCrmContactPointAction` all become thin wrappers over this one function.

2. **DB trigger fail-safe** (belt-and-suspenders, additive):
   ```sql
   -- Any future writer that inserts/updates/deletes crm_contact_points
   -- re-syncs the jsonb mirror, so the mirror cannot drift even if a new
   -- code path forgets to call writeContactPoints.
   create or replace function public.crm_sync_contact_point_mirror()
     returns trigger language plpgsql security definer as $$ ... $$;
   create trigger trg_crm_contact_point_mirror
     after insert or update or delete on public.crm_contact_points
     for each row execute function public.crm_sync_contact_point_mirror();
   ```
   With the trigger, `crm_contact_points` is the **source of truth** and the jsonb is
   a **derived cache** that is *structurally* impossible to leave stale.

### 2.4 New: `crm_user_prefs` — per-user UI state (kills localStorage drift)

Column config, board-column collapse, and list density are per-browser localStorage
today (`crm-people.md §1.3.4`) — not synced across the phone/desktop the same broker
uses, silently lost in private mode. Additive table:

```sql
create table if not exists public.crm_user_prefs (
  user_email text not null,
  key        text not null,          -- 'people.columns' | 'people.board.collapsed' | ...
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_email, key)
);
```

Read via `getCrmUserPref(email,key)`; written via `setCrmUserPrefAction` (optimistic).
Column choices now follow the broker between the driveway phone and the desk.

### 2.5 Conversation-model seam (§4.1 conformance)

The person timeline (§5.6) surfaces two row families:
- **Message rows** (SMS/email) — read from the **conversation/message model** defined
  in `03-inbox-conversations.md` via its DAL (`getConversationMessagesForPerson`).
  This spec **does not** define `conversation`/`message`; it consumes them.
- **Non-message activity** (notes, calls, system events, tasks) — read from
  `crm_timeline` (the untouched immutable ledger, per §4.1's "non-message timeline
  kinds are untouched").

The person timeline reader (§5.6) merges the two by `created_at` under one cursor.
**Cross-spec dependency: §5.6 depends on spec 03's message DAL.**

---

## 3. Surface A — The one responsive Contacts List

**Route:** `/admin/crm` (replaces the dual tree at `app/admin/(protected)/crm/page.tsx`).
**One component `PeopleList`**, authored mobile-first, adapting by container query.
No `md:hidden` twin. No second SSR tree. (`00 §4.3`; kills RC3.)

### 3.1 Layout (one tree, adapts by width)

```
┌─ header ────────────────────────────────────────────────┐
│ [≡ views]  All People ▾   [ 🔍 search…            ]  [+] │   ← search ALWAYS visible
├─ toolbar ───────────────────────────────────────────────┤
│ List | Board     Filters ▾   Sort ▾   ⋯    [n selected]  │
├──────────────────────┬──────────────────────────────────┤
│ views rail (≥ lg)    │  rows (list)  /  columns (board)  │
│  All People    (n)   │  ▸ streamed region (Suspense)     │
│  ▸ Stages            │                                   │
│  ▸ Pipeline          │                                   │
│  ▸ Neighborhoods     │                                   │
│  ▸ My / Shared views │                                   │
└──────────────────────┴──────────────────────────────────┘
```

- **Phone (< md):** views rail collapses into the `[≡ views]` sheet (a `Sheet`, not a
  separate tree). Header search stays inline. Toolbar List/Board toggle stays. Rows
  are single-line cards. Bulk selection enters via long-press / a "Select" affordance.
- **Tablet (md):** rail is a collapsible left column; rows gain the Last-Activity and
  tag columns.
- **Desktop (lg+, progressive enhancement of the SAME tree):** rail pinned open; rows
  become a multi-column table with the column-chooser; board shows all stage columns
  side by side. This is *more columns of the same component*, not a second component.

### 3.2 Search — always visible, partial-match, one compiler path

- The header search input is present on **every** form factor (fixes desktop's missing
  box, `crm-people.md §1.3.1`).
- Typing debounces (250ms) and drives the compiler's **`q`** field
  (`buildCrmPeopleQuery.ts:162–170`) — which searches `name` + `emails::text` +
  `phones::text` via `ilike %q%`. This **replaces** the current `listCrmPeople`
  free-text path that does exact-match `eq('value', q)` `.limit(200)` on
  `crm_contact_points` and returns **zero rows for a partial email** (`§1.2`).
- Result: `bob@gm` returns Bob; no 200-row truncation; the field label matches its
  behavior (kills the "Name contains" lie, `§1.2`).
- Search state lives in the URL (`?q=`) so it is shareable and survives refresh, but a
  keystroke does **not** trigger a full page navigation fan-out — the rows region is a
  streamed client-router transition, counts come from cache (§3.6).

### 3.3 Row anatomy (responsive, one row component)

One `PersonRow` renders progressively:
- **Always:** avatar · name · stage pill · a "needs reply" dot from
  `crm_conversation_state.status` · Last Activity (relative).
- **≥ md adds:** primary phone, primary email, tags (truncated), assigned broker,
  source, Last Visit (from `getPeopleListSignals`).
- **Board card variant:** avatar · name · stage-implicit (column) · price/timeframe ·
  next-task chip.

Name renders "Lead bob@gmail.com" only when `name` is null — and that is now editable
inline from the row (§3.4) so it can be corrected without opening the person.

### 3.4 Inline row actions — compliant, low-click

Every row exposes (via a `⋯` popover on phone, hover-actions on desktop):
- **Text / Call / Email** → open the **compliance-gated composer** for that person
  (routes into the conversation composer owned by spec 03, which enforces quiet hours,
  suppression fail-closed, A2P). **No raw `sms:`/`tel:`/`mailto:`** anywhere (kills the
  untracked-native-link defect, `crm-people.md §1.3.2`).
- **Change stage** → inline stage popover; optimistic (§8). Single-tap-to-open,
  single-tap-to-pick = 2 taps, vs today's 5-click bulk path (`§1.3.6`).
- **Add note** → quick-note popover, optimistic.
- **Open** → the person workspace.

The bulk machinery is no longer the only way to change one person's stage.

### 3.5 Bulk actions — responsive (not `max-md:hidden`)

The bulk-job framework is **kept** (`crm-people.md §1.4, §10`) and made available on
every form factor (removes `barClassName="…max-md:hidden"`, `§1.4`). On phone the
selection bar docks above the tab bar; the 16 actions live in an action sheet. Merge
stays constrained to 2–10 explicitly-checked ids. Selection has two modes (checked ids
vs whole-view "matching"), preflight count + suppression estimate, chunked worker,
progress poller — unchanged. The **duplicate** always-on icon strip above the table is
deleted (`§1.3.5`); the icons live only in the selection bar.

### 3.6 The count-fan-out fix in the render (§4.6)

- The list shell (header, toolbar, rail chrome) **renders instantly**.
- Rows are wrapped in `<Suspense>` and stream (the slow query stops blocking first
  paint — today there is no streaming, `crm-people.md §6`).
- View + stage **counts** come from `getCrmListCounts(access)` (§2.2): cached (60s +
  tag-invalidated), scope-keyed, batched, streamed into badge slots **after** first
  paint (badges show a thin skeleton for ≤ ~200ms, then fill). The list is fully usable
  before any count resolves.
- **Zero** sequence enrollment counts run (§2.2). Pickers that consume tags / templates
  / report-areas / ponds / neighborhoods are **lazy** — fetched when the bulk dialog
  that needs them opens, not on every list render (fixes "fetched whether or not the
  user opens the dialog", `§1.1`).

Net: the ~85-round-trip list render (`§1.1`) becomes: 1 access check + 1 rows query
(paged) + 1 cached counts read + (streamed) signals. Everything else is on-demand.

### 3.7 Signals (Last Visit / Last Activity)

`getPeopleListSignals(rowIds)` (`getPeopleListSignals.ts:41–63`) is **kept** but moved
into the streamed rows region — it is inherently serial (needs the row ids first), so
it resolves *after* the rows paint and hydrates the two columns in place, rather than
blocking the whole page (`crm-people.md §1.1 step 3`).

### 3.8 Add Person — one surface, reachable everywhere

One `AddPersonForm` (a `Sheet`) with a single field set (name, phones, emails, stage,
source, broker [superuser], note). Reachable from the list header `[+]`, the board, and
the shell FAB — **on every form factor** (fixes mobile's "no path to create", `§1.5`,
and the two-divergent-create-surface defect, `§4`). The `/admin/crm/new` full-page
route becomes a thin redirect to the list with the sheet open (`?new=1`) for deep-link
compatibility, then is deleted once no inbound links remain.

### 3.9 List states

| State | Behavior |
|---|---|
| **Loading (streamed)** | Shell + rail chrome instant; rows skeleton (12 placeholder rows) inside Suspense; count badges skeletoned. A `crm/[id]/loading.tsx` of the **person** shape is added so list→person shows the right skeleton (fixes wrong-shaped skeleton, `§1.6`). |
| **Empty (no contacts)** | "No contacts yet" + `[+ Add person]`. |
| **Empty (search/filter no match)** | "No contacts match *bob@gm*" + Clear. Never a spinning void. |
| **Populated** | Rows + working pagination (§3.10). |
| **Pending/optimistic** | Inline stage/note edits patch the row instantly (§8). |
| **Partial** | Signals column shows "—" until its streamed query resolves; never blocks the row. |
| **Error (rows query)** | Inline retry banner in the rows region; shell stays usable. |
| **Offline** | Cached last render shown read-only; a "reconnecting" chip; mutations queue and replay with their idempotency key (§8). |
| **Permission-denied** | Restricted brokers never *see* a view/action the capability map forbids (nav generated from the map, `00 §4.4`) — so no dead-ends. |
| **Over-limit (bulk)** | Preflight count + suppression estimate shown before enqueue (kept framework). |

### 3.10 Pagination

Replace Previous/Next-only links (`§1.3.7`). Page size selector (25/50/100), a page
indicator ("51–100 of 20,142"), and jump-to-page. `PAGE_SIZE` default stays 50. Sort is
the compiler's deterministic order (`last_activity_at desc, fub_created_at desc, id asc`
— `buildCrmPeopleQuery.ts:299–306`).

### 3.11 List acceptance criteria (writer→store→reader→outcome)

- **AC-L1 (search):** typing `bob@gm` → compiler `q` ilike → `crm_people` rows →
  Bob (partial email) appears. Proven: a contact whose only match is a partial email
  substring is returned (today returns 0, `§1.2`).
- **AC-L2 (one tree):** at any viewport, the DOM contains exactly one `PersonList`
  instance (no `md:hidden` twin). Proven by a render test asserting a single tree +
  a bundle check that the mobile fork components no longer exist.
- **AC-L3 (compliant quick-text):** row Text → composer opens → send → a
  `crm_timeline`/message row exists AND the suppression/quiet-hours gate ran. Proven:
  no `sms:`/`tel:`/`mailto:` href renders in the row (grep gate).
- **AC-L4 (inline stage):** row stage popover → pick "Active" → optimistic pill flips →
  `crm_people.stage='Active'` persisted → cached counts tag-invalidated → the stage
  badge reflects it within one interaction. 2 taps.
- **AC-L5 (count layer):** the list render issues **0** sequence-enrollment COUNTs and
  **0** synchronous per-view COUNTs on the blocking path (counts come from
  `getCrmListCounts` cache/stream). Proven by a query-count assertion in a render test.
- **AC-L6 (bulk on phone):** at 390px, select 3 rows → Batch Email → preflight count
  shows → enqueue → progress poller completes. Bulk is reachable on phone.

---

## 4. Surface B — Pipeline Board (one system)

**The board is a *mode* of the People surface, not a separate route** — a `List | Board`
toggle in the toolbar (§3.1). It reads the **same** `buildCrmPeopleQuery` compiler, the
**same** scope clamp, the **same** saved-view/filter context. This is the "one list,
one board" of the IA (`00 §5`). It unifies today's three scattered pipeline
representations — the sidebar stage-strip, the `?stage=` filtered list, and the
"Pipeline" saved-view collection (`PeopleSidebar.tsx:85`) — into one board.

> **Scope boundary:** this is the **contact-stage** board (columns = `crm_stages`,
> cards = `crm_people`). The **deals** board (`components/admin/crm/deals/DealsBoard.tsx`,
> columns = `crm_deal_stages`, cards = `crm_deals`) belongs to `deals-tc.md` /
> Transactions. They are different systems and this spec does not merge them.

### 4.1 Structure

- **Columns** = active `crm_stages` in config order (Lead, Hot, Nurture, Active, …).
- **Cards** = `crm_people` rows for the current filter/saved-view, grouped by `stage`,
  ordered by the compiler's order within each column.
- **Column header** = stage label + **cached** scoped count (from `getCrmListCounts`,
  §2.2 — the same 8 stage counts, now cached/lazy, not 8 live COUNTs per render).
- Each column paginates independently (cursor / "load more") so a 5,000-lead "Lead"
  column does not load all cards at once.

### 4.2 Restage by drag (optimistic + idempotent · §4.2)

- **Drag a card** from column A to column B → the card moves **optimistically**
  (`useOptimistic`) the instant it is dropped; a "saving" shimmer on the card.
- Server: `setPersonStageAction(personId, stage, idempotencyKey)` — in-body auth guard
  (§4.4), scope check (`requirePersonInScope`), `update crm_people set stage=…`. Setting
  a stage is **naturally idempotent** (stage=B twice = B); the idempotency key
  additionally collapses a double-drop into one write and one timeline entry.
- On resolve: the action **returns the updated card** (not `revalidatePath`); the board
  patches local state. Column counts tag-invalidate (§2.2).
- On error (scope denied / DB): the card **snaps back** to column A with a toast +
  Retry (no silent swallow, §8).
- `dnd-kit` is code-split behind `next/dynamic` (`00 §4.6`) — the board island loads
  on demand, not on every People render.

### 4.3 Responsive board (one tree)

- **Phone (< md):** columns are a horizontally-scrolling snap carousel, one column
  ~90% viewport width; drag works via long-press + auto-scroll at edges. A "move to…"
  sheet is the tap-only fallback (accessibility + no-drag preference) so restage never
  *requires* a drag on a phone.
- **Tablet (md):** 2–3 columns visible, horizontal scroll for the rest.
- **Desktop (lg+):** all active stage columns visible side-by-side — **progressive
  enhancement of the same board**, not a second component.
- Column collapse state persists via `crm_user_prefs` (`people.board.collapsed`, §2.4).

### 4.4 Board states

| State | Behavior |
|---|---|
| Loading | Column headers instant (cached counts); card lists skeleton per column, streamed. |
| Empty column | "No contacts in *Nurture*" placeholder; still a drop target. |
| Empty board (filtered) | "No contacts match this view" + Clear filter. |
| Pending/optimistic | Card moves instantly on drop; shimmer until confirmed. |
| Success | Shimmer clears; counts update. |
| Error | Card snaps back; toast + Retry. |
| Offline | Drops queue with idempotency key; replay on reconnect; card shows "queued". |
| Permission-denied | A restricted broker can only drag **their own** cards; a card outside scope is not draggable (and the action would refuse anyway — defense in depth). |
| Over-limit | Columns lazy-load; no attempt to render 5,000 cards at once. |

### 4.5 Board edge cases

- **Concurrent restage (two brokers move the same card):** last write wins on the
  scalar `stage`; the second broker's board reconciles on its next count-tag refresh.
  No lost update beyond the intended last-writer semantics (stage is a single scalar).
- **Card filtered out by its own move:** if the active saved-view filters by
  `stage=Lead` and you drag a card to `Active`, the card leaves the view — it animates
  out with a "moved to Active — Undo" toast (Undo = idempotent restage back).
- **Stage renamed/deactivated mid-session (settings change):** the board reads
  `crm_stages` fresh per load; a deactivated stage column disappears and its cards land
  in an "Unstaged" column rather than vanishing.
- **Drag onto the same column:** no-op; no write, no timeline entry (idempotency + a
  same-stage short-circuit).

### 4.6 Board acceptance criteria

- **AC-B1 (one system):** the board and the list share one compiler call and one scope
  clamp — proven by asserting both derive rows from `buildCrmPeopleQuery` with the same
  AST for a given saved-view.
- **AC-B2 (optimistic restage):** drag Lead→Active → card moves before the network
  resolves → `crm_people.stage='Active'` persisted → column counts update. Timing: card
  visually moves < 100ms after drop.
- **AC-B3 (idempotent):** two rapid drops of the same card to the same column produce
  exactly **one** `crm_people` update and **one** stage-change timeline row (same
  idempotency key).
- **AC-B4 (scope):** a restricted broker cannot drag a card outside their book; the
  action refuses even if the client is tampered with (in-body `requirePersonInScope`).
- **AC-B5 (tap fallback):** on a phone with drag disabled, "move to…" sheet performs the
  same restage.

---

## 5. Surface C — Person data (fields · inline edit · custom fields · merge · saved views · timeline)

**Route:** `/admin/crm/[id]` — one responsive `PersonWorkspace` (replaces the dual
desktop 3-column tree + `mobile-detail.tsx`). Authored mobile-first. The *respond +
send* half of this workspace (composer, CMA/BPO/newsletter/saved-search send) is speced
in `03` and `05`; **this spec owns the person *data*: the identity fields, inline edit,
custom fields, merge, the saved-view panel's canonical placement, and the timeline
reader.**

### 5.1 Person data render (kills the ~50-query fan-out · §4.6)

- The workspace **shell** (name, avatar, stage, primary contact points, tab bar)
  renders from one fast read and paints instantly.
- Each region — **Fields**, **Timeline**, **Tasks/Appointments**, **Send** — is its own
  `<Suspense>` boundary reading a **cached** DAL function. The current four sequential
  await-stages / 28-way `Promise.all` / ~50 queries (`crm-people.md §2.1`) is replaced
  by independent streamed regions; the slowest never blocks the shell.
- **No `router.refresh()` on inline edit.** Every edit returns its changed entity and
  patches local state (§8) — the whole-pipeline re-run per edit (`§2.1`) is gone.
- `getPersonDetailExtras`'s serial signed-URL-per-file loop (`§2.1`,
  `getPersonDetailExtras.ts:133–150`) moves into the Files region and generates URLs
  lazily on expand, not on page load.

### 5.2 Inline edit — every field, every form factor, no silent swallow

The mobile Edit-sheet interaction model (per-row diff, dirty tracking, pending label,
error banner — the domain's best edit surface, `crm-people.md §3.2, §10`) becomes the
**one** edit pattern everywhere. Editable inline (all form factors):

| Field | Store | Notes |
|---|---|---|
| **Name** | `crm_people.name/first/last` via `updatePersonNameAction` | Now editable on **every** form factor (was mobile-only, `§2.2.1`). Fixes "Lead bob@gmail.com" without a phone. |
| **Phones** | `crm_contact_points` (kind=phone) via `writeContactPoints` (§2.3) | Atomic replace; mirror auto-synced. |
| **Emails** | `crm_contact_points` (kind=email) via `writeContactPoints` | Same. |
| **Stage** | `crm_people.stage` | Same action as board restage (one path). |
| **Tags** | `crm_people.tags` (text[]) via add/remove | Array **union/diff**, never full replace (concurrent-safe). |
| **Custom fields** | `crm_people.custom[key]` | §5.3. Editable on every form factor (was desktop-only / mobile read-only, `§2.2, §3.2`). |
| Source, timeframe, price, lender, background, address | respective `crm_people` columns | Inline. |

**Every mutation returns `{ ok: true; entity } | { ok: false; error }`.** The client
renders the error inline (banner/toast) and reverts the optimistic patch. **The five
void-returning `console.error` wrappers are deleted** (`updateStageForm`, `addTagForm`,
`removeTagForm`, `addTaskForm`, `assignBrokerForm`, `form-actions.ts:35–54`) — a failed
stage/tag/assign/task on the phone can no longer look identical to success
(`crm-people.md §2.3, RC6`). `TagChips` and enrollment pause/resume/stop must **read the
result** (they ignore it today, `§2.2.1, §2.2.4`).

### 5.3 Custom fields (single canonical panel)

- Defs from `crm_field_definitions` (`key,label,type,options,position,hide_if_empty`),
  values in `crm_people.custom`. One `CustomFieldsPanel` renders every def once, typed
  by `type` (text/number/select/date), respecting `hide_if_empty`.
- **Protection:** add `is_protected boolean default false` to `crm_field_definitions`
  (additive; the current hardcoded protected list migrates into it — the definition
  management lives in `crm-settings-automation.md`). Protected fields render read-only;
  editing a protected field is refused server-side, not merely hidden.
- Editing writes `crm_people.custom[key]` optimistically; the compiler already supports
  `custom->>key` filters (`buildCrmPeopleQuery.ts:171–186`) so an edited custom value is
  immediately filterable/saved-view-able.

### 5.4 Merge — one canonical entry point

- **One merge affordance**, labeled clearly ("Merge duplicate…"), reached from the
  person workspace **and** the list bulk selection (2–10 ids) — both call the single
  `mergePeopleCore` path (memory `reference_crm_merge_core.md`; kept-core). The
  mystery-meat "+" icon in Relationships (`§2.2.1`) is deleted; the sidebar-dialog and
  bulk-merge (`§7.6`) collapse to this one flow.
- Merge is scope-checked (both parties in the caller's book, or superuser), atomic,
  and verifies no orphaned `crm_contact_points`/timeline/enrollments post-merge (the
  memory's orphan-check discipline).

### 5.5 Collaborators actually grant access (fixes decorative feature)

Today `isPersonInScope` checks `assigned_broker === slug` only; a collaborator gets
**no** ability to open or act on the lead (`crm-people.md §2.4`) — the whole
collaborators feature is decorative for restricted brokers. Fix: extend the scope
predicate to also honor `crm_people_collaborators`:

```ts
// isPersonInScope-equivalent, now collaborator-aware
ok = slug === null                       // superuser
  || assignedBroker === slug             // owner
  || collaboratorSlugs.includes(slug)    // explicit collaborator
```

`getCrmPersonFull` and `requirePersonInScope` consult the collaborator set. Adding
Rebecca as a collaborator on Matt's lead now genuinely lets her open and act on it. The
scope clamp in `buildCrmPeopleQuery` gains an OR for collaborated person-ids (bounded,
resolved once per request) so collaborated leads also appear in her list/board.

### 5.6 Timeline — cursor pagination, badges that don't lie

Replace the newest-100 cap with counts-that-lie (`crm-people.md §2.2.2`):

- The timeline reads two sources merged by `created_at` under **one cursor** (§2.5):
  message rows from spec-03's conversation DAL, non-message activity from `crm_timeline`.
- **Tab badges are exact head-counts** (cached, cheap `count:'exact', head:true`), and
  the tab content is **cursor-paginated with "load more"** so the tab can actually reach
  every row its badge promises. Today "Texts 342" filters an in-memory 100 (`§2.2.2`);
  now the badge and the loadable content agree.
- Star toggle stays optimistic-with-revert (the one good optimistic mutation today,
  `§2.2.2`); scope-checked via the owning row (`crm-person-detail.ts:293–303`, kept).
- The two hand-synced tab→kind maps (`PersonCenterColumn.TAB_KINDS` vs
  `getPersonDetailExtras.TIMELINE_TAB_KINDS`, `§2.2.2`) collapse to one exported
  constant.
- `ConversationFeed`'s snapshot-once bug (never re-syncs on prop change → a sent text
  doesn't appear until reload, `§3.2`) is fixed by the optimistic layer: the composer's
  send patches the feed's local state directly (the message bubble appears in "sending"
  then confirmed), and the feed subscribes to prop changes. A sent message is **always**
  visible immediately (removes the false "did it send?" that invites a duplicate).

### 5.7 Person data states

| State | Behavior |
|---|---|
| Loading | Shell instant; each region streamed with its own skeleton. |
| Empty (new lead, no activity) | Fields show placeholders; timeline "No activity yet". |
| Populated | Fields + paginated timeline. |
| Pending/optimistic | Field edits patch inline; message bubbles show "sending". |
| Success | Edit confirmed inline (subtle check); no page refresh. |
| Partial | A slow region (e.g. Files signed-URLs) resolves independently; the rest is usable. |
| Error | Per-field inline error + revert; per-region retry; never a blank page. |
| Offline | Read-only cached view; edits queue with idempotency key. |
| Permission-denied | Out-of-scope lead 404s (kept `getCrmPersonFull` guard) — but collaborators now pass (§5.5). |
| Over-limit | Timeline paginates; never loads the full history at once. |

### 5.8 Person data acceptance criteria

- **AC-P1 (name edit everywhere):** on a 390px phone AND a desktop, edit name → 
  `updatePersonNameAction` → `crm_people.name` persisted → header + list row reflect it.
  No device-hop required (fixes `§2.5` "fix a wrong name: not possible on desktop").
- **AC-P2 (no silent swallow):** force a stage-change action to fail (scope reject) →
  the UI shows an error + reverts the optimistic pill. Proven: no code path returns
  `void` after `console.error` for a failed mutation (grep gate on `form-actions`).
- **AC-P3 (contact-point SoT):** add a phone via the mobile flow → `crm_contact_points`
  row created → jsonb mirror auto-synced (trigger) → the list Phone column shows it AND
  `getSendTarget` returns it as primary. Proven: a phone added by *any* of the three
  writers is visible in the list and selected by the send path (fixes `§2.4`).
- **AC-P4 (atomic phones):** simulate an insert failure mid-replace → the person still
  has their original phones (no wipe). Proven against the RPC's transactional rollback.
- **AC-P5 (custom field roundtrip):** set custom field "Buyer budget"=800000 → 
  `crm_people.custom['buyer_budget']=800000` → a saved view filtering
  `custom->>buyer_budget` includes the person.
- **AC-P6 (timeline honesty):** a person with 342 texts shows badge "342" AND
  "load more" reaches all 342 (not a frozen 100). Proven by paging to the last row.
- **AC-P7 (collaborator access):** add Rebecca as collaborator on Matt's lead → Rebecca
  can open it, it appears in her list, and she can send from it. Proven end to end
  (fixes the decorative-collaborators defect, `§2.4`).
- **AC-P8 (sent message visible):** send a text from the person Comms tab → the bubble
  appears immediately in "sending" then "delivered"; no reload needed (fixes `§3.2`).

---

## 6. Cross-cutting: the optimistic + idempotent mutation contract (§4.2)

Every mutation in this area uses **one** client primitive and **one** server contract.

**Client** (`usePersonMutation` / `useListMutation` hooks):
```ts
// on submit:
const key = crypto.randomUUID()          // idempotency key
startTransition(() => {
  applyOptimistic(patch)                  // row/card/field updates instantly
  disableControl(); clearInputIfSend()
})
const res = await action(payload, key)
if (res.ok) reconcile(res.entity)         // patch real values in
else { revertOptimistic(); showError(res.error) /* + Retry */ }
```

**Server** (every action under `app/actions/**` this area owns):
```ts
export async function setPersonStageAction(
  personId: number, stage: string, idempotencyKey: string
): Promise<{ ok: true; entity: PersonCard } | { ok: false; error: string }> {
  const access = await requireAdmin('crm.write')     // §4.4 in-body guard (defense in depth)
  const scope = await requirePersonInScope(personId, access)
  if (!scope.ok) return { ok: false, error: 'Not in your book' }
  // idempotency: a duplicate key is a no-op returning the original result
  // (persisted in crm_mutation_keys or short-circuited for naturally-idempotent writes)
  // ...update, return the changed entity — NO revalidatePath of the page.
}
```

- **Naturally-idempotent writes** (stage set, custom-field set, tag union) rely on the
  operation's idempotency + the key to collapse duplicate *timeline entries*.
- **Non-idempotent writes** (contact-point replace) go through the transactional RPC
  and record the idempotency key so a double-submit is a no-op.
- **Actions return the changed entity**; the client patches local state. The universal
  `router.refresh()` tax (`crm-people.md §2.1, RC2`) is gone.

This is the same contract spec 03/05 use for sends; this spec applies it to
list/board/field mutations so the *whole* People area feels instant and cannot
double-apply.

---

## 7. Duplicated widget → single canonical home (the register, resolved)

Per `00 §4.7` (one canonical surface per concept). Mapping every duplicate from the
audit's register (`crm-people.md §2.2.5, §7`) to its one home:

| Concept | Duplicates today | **Canonical home** |
|---|---|---|
| Market-report subscription | ×3 on one page (ContactSendCenter tab, ContactQuickActions sheet, standalone panel) | **One** panel in the person **Send** region (owned by `05-send-center.md`). This spec deletes the other two person-page copies. |
| Saved searches / listing alerts | ×3, backed by **two tables** (`getListingAlertsForLead` vs `getContactListingAlerts`) that can disagree | **One** panel reading the unified **`listing_alerts`** pipeline (per `00 §4.8`, kept spine). The second table's widget is deleted. Canonical placement: person **Send/Signals** region. |
| Automations / action plans | ×5 desktop + 1 mobile; "Automations" widget duplicates "Action Plans" | **One** enrollments panel. The duplicate "Automations" rail widget is deleted (`§2.2.4`). |
| CMA / BPO send | ×3 (OwnedHomeCard, ContactCmaCard/BpoCard, ContactSendCenter tabs) | **One** send path in the person **Send** region (owned by `05`). Keep `lib/cma/send.ts` + `lib/bpo/send.ts` libs (kept-core); collapse the surfaces. |
| Newsletter | 1 (fine) | Person **Send** region. |
| Contact create | ×2 divergent field sets | **One** `AddPersonForm` (§3.8). |
| Merge | ×2 (sidebar dialog + bulk) | **One** `mergePeopleCore` flow (§5.4). |
| Bulk icon strip | ×2 (always-on + selection bar) | **One** — selection bar only (§3.5). |
| Timeline tab→kind map | ×2 hand-synced | **One** exported constant (§5.6). |
| `BROKER_HEADSHOT` literal map | ×3 files | **One** shared constant. |
| Message renderer | `EventCard` (desktop) vs `ConversationFeed` (mobile) | **One** renderer (the responsive tree, §5.6). |
| Contact-point storage | 2 representations, 3 writers, 2 mirror | **One** writer + trigger (§2.3). |
| Flash/feedback | URL `?flash=`/`?error=` + sonner + "no feedback" | **One** — the optimistic layer's inline result + toast (§6). The dead `?flash=` on delete is removed. |

Concepts whose canonical home is in another spec (Send region: CMA/BPO/market-report/
newsletter/saved-search; Inbox: conversation composer) are **referenced, not
duplicated** here. This spec's job for them is to **delete the person-page duplicates**
and leave exactly one link into the canonical home.

---

## 8. Responsive behavior summary (one tree, not a fork · RC3)

- **One component per surface** (`PeopleList`, `PersonWorkspace`), authored mobile-first.
  Layout adapts by **container query / CSS**, not by mounting a second tree. There is no
  `md:hidden` twin and no second SSR pass (kills the double render + double JS,
  `crm-people.md §6, §8`).
- **Progressive enhancement on larger screens** = more columns of the *same* component:
  the list gains table columns + the pinned rail; the board shows all stage columns at
  once; the person workspace spreads its streamed regions into 2–3 columns. None of
  these is a separate file.
- **Capability parity is structural:** because there is one tree, a capability cannot be
  "desktop-only" or "mobile-only" by accident — the feature-parity matrix
  (`crm-people.md §8`) collapses to a single column. Name-edit, CMA-send, log-call,
  bulk actions, and custom-field edit are available on every form factor (each was
  device-locked before).
- **Design tokens:** all surfaces use `@/components/ui/*` and the two-color token system
  (navy/cream). The off-brand hex literals on mobile action circles (`#7595e8`,
  `#4ad09f`, `#4ab8e8`, etc., `§3.2`) are deleted in favor of tokens.

---

## 9. Exhaustive edge cases (specific to real data)

| Edge case | System behavior |
|---|---|
| **Group text from a list row where a raw number later resolves to a contact** | The row Text opens the conversation composer (spec 03). If the number later resolves to a person, the conversation model (spec 03, §4.1) rebinds the participant; this spec's list row then shows the resolved name on next render. No duplicate person is created by the list. |
| **Lead with no phone** | Row Text/Call are disabled with an honest "No phone on file — add one" affordance that opens the phone editor inline. `getSendTarget.phone === ''` (kept behavior). Never a raw `sms:` to an empty number. |
| **Suppression / quiet-hours block on a row quick-text** | The composer (spec 03) enforces the fail-closed suppression + quiet-hours gate; the list never sends directly, so it cannot bypass compliance. The block surfaces as the composer's honest blocked state. |
| **Merge-token with no value** | Kept fail-closed refusal (send libs, `00 §3`); the send region refuses rather than sending a `{{first_name}}` literal. This spec does not weaken it. |
| **MLS sync overwriting a person edit** | `crm_people` is **not** MLS-synced (MLS writes `listings`), so a manual person edit is never clobbered by an MLS sync. (The FUB native cutover means `fub_created_at` is the origin-date source; edits write live columns, untouched by any import.) |
| **Concurrent broker edits (same field)** | Scalar fields: last-write-wins. Tags: union/diff (both edits survive). Phones: atomic RPC serializes; the second writer's mirror reflects the merged set. Stage: last-write-wins (single scalar). No full-array phone replace race (the current delete-then-insert race, `§2.4`, is gone). |
| **Duplicate submit (double-tap send / double-drop restage)** | Idempotency key collapses to one write + one timeline row (§6). |
| **Timeout on a 30–60s build (CMA)** | Owned by spec 05; from this area's view the person Send region shows the optimistic "sending" state and the timeline logs the outcome when the build resolves; a timeout marks the optimistic row failed with Retry (never a silent hang). |
| **Expired session mid-edit/mid-send** | The in-body `requireAdmin` guard (§4.4) returns unauthorized; the client shows a re-auth prompt and preserves the pending edit + its idempotency key so it can replay after re-auth (no lost work, no double-apply). |
| **Metric/count with no live writer** | Not rendered as `$0`/`—` — the count layer only surfaces counts backed by a live compiler query (`getCrmListCounts`); the dead Lead-Score column is deleted, not shown empty (`00 §4.5`, `§1.3.3`). |
| **Saved view with a corrupt stored AST** | `getCrmSavedViews`'s existing `validateSegment` guard returns `count: null` for that view (kept, `getCrmSavedViews.ts:65–84`); the badge shows "—" and opening the view surfaces "This view's filter is invalid" rather than crashing the list. |
| **A person dragged to a stage that the active saved-view filters out** | Card animates out with "moved to X — Undo" (§4.5). |
| **Restricted broker opens a deep-linked person outside their book** | 404 (kept guard) — unless they are a collaborator (§5.5), in which case it opens. |
| **Contact shared by >200 people via a phone/email search** | The compiler `q` path returns **all** hits (no 200-cap, `buildCrmPeopleQuery.ts:17–19`); pagination handles volume. |
| **Private-mode / new-device column config** | Reads from `crm_user_prefs` (server), so the broker's columns follow them; no silent reset (`§1.3.4`). |
| **Soft-deleted person** | `deleted=true` rows never appear (compiler invariant 2, `buildCrmPeopleQuery.ts:286`); delete shows an inline confirmation (the dead `?flash=` is replaced by the optimistic toast, `§1.3.8`). |

---

## 10. Error handling & compliance

- **Auth (§4.4):** every mutating action in this area calls `requireAdmin(capability)`
  **in-body** (not relying on the layout gate) — stage set, tag add/remove, name/phone/
  email/custom edit, merge, delete, restage, add-person, saved-view CRUD, pref set. The
  nav + row/board actions are generated from the same capability map, so a shown control
  never dead-ends (`00 §4.4`, kills RC5). A mechanical gate (`ci:admin-authz`) fails the
  build if an `app/actions/**` mutation in this area omits the guard.
- **TCPA / suppression / quiet-hours (fail-closed):** this area never sends directly.
  Row/person Text/Call/Email route into the compliance-gated composer (spec 03) whose
  suppression chokepoint + quiet-hours + A2P gates are kept-core (`00 §3`). The deleted
  raw `sms:`/`tel:`/`mailto:` links (`§1.3.2`) were the one bypass; removing them closes
  it.
- **Data accuracy (§C4):** the counts shown (stage/view/total) resolve through the ONE
  compiler under the caller's scope, so a badge equals exactly what opening the filter
  shows (kept invariant, `getCrmStageCounts.ts:7–18`). No count is shown that lacks a
  live writer.
- **No silent failure (RC6):** every mutation returns a typed result; the UI renders
  errors. The five void wrappers are deleted (§5.2). Enrollment/collaborator/tag
  mutations must read their result (they ignore it today, `§2.2.1, §2.2.4`).

---

## 11. Performance targets (§4.6)

| Metric | Today (audit) | Target |
|---|---|---|
| List render DB round-trips (blocking path) | ~85 (`§1.1`) | 1 access + 1 rows + 1 cached-counts read; signals + pickers streamed/lazy |
| Person render DB round-trips (blocking path) | ~40–55 across 4 await-stages (`§2.1`) | shell = 1 read; each region streamed + cached |
| Trees rendered per route | 2 (desktop + mobile SSR'd, `§8`) | 1 |
| Re-render on inline edit | full page fan-out via `router.refresh()` (`§2.1`) | local state patch; 0 page re-fetch |
| Sequence COUNTs on list | 5×N discarded (`§1.1`) | 0 |
| First paint | blocked on slowest query, no streaming (3 `loading.tsx` for 150 pages, `§6`) | shell instant; regions stream; `[id]/loading.tsx` of the right shape added |
| Heavy islands | `dnd-kit`/charts always shipped | code-split behind `next/dynamic` (board island on demand) |

---

## 12. Open questions for Matt (genuine decisions, not defaults)

1. **Board default stages vs. a dedicated board pipeline.** The contact board columns =
   active `crm_stages` (Lead/Hot/Nurture/Active/…). Do you want the board to show *all*
   active stages as columns, or a curated subset (e.g. hide "Closed"/"Lost" behind a
   collapsed column)? Default if unanswered: all active stages, with Closed/Lost
   collapsed.
2. **Count freshness vs. cost.** Badge counts cache at a 60s TTL + tag-invalidation on
   mutation (near-instant on your own change, ≤60s on another broker's). Acceptable, or
   do you want counts always live (higher DB cost, no cache)?
3. **Collaborator visibility in the list.** §5.5 makes collaborated leads openable AND
   makes them appear in the collaborator's list/board. Do you want collaborated leads to
   show in Rebecca's *default* "All People", or only under a "Shared with me" view?
   Default: a "Shared with me" view, not mixed into her main book.
4. **Merge from the bulk list.** Keep bulk-merge (2–10 checked) as a second entry point
   into `mergePeopleCore`, or make merge person-workspace-only? Default: keep both,
   one implementation.
5. **`/admin/crm/new` deep links.** Any external bookmarks/automations that POST to or
   link `/admin/crm/new`? If none, it's deleted after the redirect-compat window;
   confirm nothing depends on it.
6. **Custom-field protection source.** §5.3 proposes a data-driven `is_protected` column
   on `crm_field_definitions`. Confirm which fields are protected (the current hardcoded
   list) so the migration seeds them correctly.
