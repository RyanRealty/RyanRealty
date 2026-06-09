# Wire 16 westside cross-cutting smart lists in FUB UI — ~20 minutes

The 16 list shells already exist in FUB (created via API on 2026-05-26). They're empty until two things happen:

1. The westside CSV gets imported (waiting on Matt's approval).
2. Each list gets its tag filter set in the FUB UI (this runbook).

Both can happen in any order. Lists with filters set but no import yet just show 0 matches — they go live automatically when the import lands.

## Why this is a UI runbook (not a script)

`scripts/westside-bend-fub-smart-lists.mjs --apply` PUTs `{ conditions: { all, none } }` against `/v1/smartLists/{id}` and gets HTTP 200, but the conditions never persist. `GET /v1/smartLists/{id}` returns only `id, created, name, isFub2, description, defaultSmartListId` — no `conditions`, `criteria`, `filters`, `rules`, `filter`, `query`, `definition`, `segments`, or `tags` field is exposed. Every `GET /v1/people?smartListId=N` returns all 13,278 people, confirming the filter never applied. This matches the prior finding in [docs/FUB_CLEANUP_FINAL_2026-05-17.md](../FUB_CLEANUP_FINAL_2026-05-17.md): "POST /v1/smartLists returns 500 — undocumented schema issue. Smart lists also have to be built in the UI." The FUB API can create + rename smart lists but cannot set filter conditions. Don't waste another session on this.

## Mandatory realtor + compliance excludes — every list below except the two "industry" lists

Per Matt's 2026-05-17 directive ([docs/FUB_SMART_LISTS_STARTER_PACK.md](../FUB_SMART_LISTS_STARTER_PACK.md)), every smart list MUST exclude:

- tag `industry:realtor`
- tag `Realtor`
- tag `Real Estate`
- tag `compliance:hard-stop`
- tag `do_not_email`
- tag `Bounced`
- tag `Unsubscribed`
- stage `Real Estate Agent`

Without these excludes, one blast hits 2,316+ industry contacts and 694 hard-blocked records. Sender reputation gone in one click. Set this exclude group on EVERY list below except `Industry Realtors — West Side` (135) and `Broker Recruit Pool` (136).

## Per-list flow (~60 seconds each)

1. Click the list in the left sidebar (or People → Smart Lists, find by name).
2. Right panel, click `Add a filter`.
3. **Include tag(s):** type `Tags`, pick from dropdown, click blue `+`, type the tag from the table below, click the matching suggestion. If the list needs TWO include tags (AND), repeat — add a second `Tags` filter row.
4. **Exclude realtors:** add 7 more filter rows. Each one: `Tags` → click `+` → switch operator to `does not contain` → enter the exclude tag.
5. **Exclude stage:** add one more filter row. `Stage` → `is not` → `Real Estate Agent`.
6. Click `Update List` (top right). Re-click if it stays blue.
7. Verify count near the list name matches the "Expected" column below (post-import).

For sharing + adding to collections, see the bottom section.

## The 16 lists

### Tier 1 — populated immediately after import

| FUB id | List name | Tag filter(s) (include ALL) | Realtor excludes? | Expected count |
|---|---|---|---|---|
| 130 | Homeowner DB — West Side All | `import:westside-2026-05` | yes | 7,525 (7,765 minus 240 realtors) |
| 131 | Likely Sellers — Hot | `seller-score:hot` | yes | ~340 |
| 132 | Likely Sellers — Warm | `seller-score:warm` | yes | ~3,023 |
| 145 | Likely Sellers — Cool | `seller-score:cool` AND `import:westside-2026-05` | yes | ~2,541 |
| 133 | Out-of-State Owners | `geo:out-of-state` AND `import:westside-2026-05` | yes | ~813 |
| 134 | High Equity Owners | `equity:high` AND `import:westside-2026-05` | yes | ~3,832 (add `equity:very-high` second filter row → ~5,277 total if you want both) |
| 137 | Needs Enrichment — West Side | `contact:needs-enrichment` AND `import:westside-2026-05` | yes | ~4,993 |
| 142 | Rate Locked Owners | `lifecycle:rate-locked` AND `import:westside-2026-05` | yes | ~990 |

### Tier 2 — industry lists (NO realtor excludes — these target realtors on purpose)

| FUB id | List name | Tag filter(s) (include ALL) | Realtor excludes? | Expected count |
|---|---|---|---|---|
| 135 | Industry Realtors — West Side | `industry:realtor` AND `import:westside-2026-05` | **NO** | ~240 |
| 136 | Broker Recruit Pool | `audience:broker-recruit` | **NO** | ~240 |

### Tier 3 — demographic + life-event lists (populate after BatchData runs)

These are zero today. They go live the moment BatchData enrichment runs and the import CSV gets re-pushed. Set the filters now so they auto-populate — no second pass needed.

| FUB id | List name | Tag filter(s) (include ALL) | Realtor excludes? | Expected count (post-BatchData) |
|---|---|---|---|---|
| 138 | Empty Nest Owners | `demo:empty-nest` AND `import:westside-2026-05` | yes | ~500–1,200 (depends on match rate) |
| 139 | Life Event — Recently Divorced | `life:recently-divorced` AND `import:westside-2026-05` | yes | ~50–200 |
| 140 | Life Event — Recently Moved | `life:recently-moved` AND `import:westside-2026-05` | yes | ~100–400 |
| 141 | Retirement Age Long-Term | `demo:age-55-plus` AND `tenure:long-term` AND `import:westside-2026-05` | yes | ~700–1,500 |
| 143 | Has Mobile Phone | `contact:mobile-phone` AND `import:westside-2026-05` | yes | varies w/ BatchData match |
| 144 | BatchData Enriched | `enrich:batchdata-matched` AND `import:westside-2026-05` | yes | up to 5,969 (full eligible pool) |

## Set sharing on each new list

API-created shells default to private. Until you flip this, the lists don't appear in collection editors and other team members can't see them.

For each of the 16 lists above:

1. Open the list.
2. Click `Edit` next to the list title.
3. Check `Share smart list with` → `Share with everyone`.
4. Click `Save List`.

## Add to collections (optional but recommended)

Group the lists in the left sidebar so they're easier to find:

| Collection | Lists to add |
|---|---|
| Westside DB (new — create it) | 130, 131, 132, 145, 133, 134, 137, 142 |
| Westside — Industry | 135, 136 |
| Westside — Demographics (new — create it) | 138, 139, 140, 141, 143, 144 |

To create a collection:
1. People → Manage.
2. `+ New Collection`, name it, save.
3. Hover the row, `...` menu → `Edit Collection`, check the relevant lists, save.

## After all 16 are wired

1. Note the actual count next to each list name. Compare against "Expected" above.
2. If a list is 0 when it should have ~hundreds → import didn't land or tag is wrong. Re-check the include tag spelling (kebab-case, no typos, `:` separator).
3. If a list is way over expected → realtor excludes missing. Verify all 7 exclude rows + the stage exclude are present.

Once verified, the lists are exportable to CSV for direct outreach (door knocks, direct mail, FB CAS later if Matt re-enables). They also become the targeting pool for the Plans 69 / 73 / 74 manual enrollments described in the Background brief on each contact.

## Why this fell to a runbook (again)

FUB's smart list filter UI can't be driven reliably by API or automation. Matt or Rebecca clicks faster than any script can drive the modal. The 16 lists take ~20 minutes total. The shells are already created so the cost is just filter + sharing per list, no recreation.

## When this can become a script

If FUB ever ships a documented `conditions` payload on `POST /v1/smartLists` (the doc currently returns 500), the existing `scripts/westside-bend-fub-smart-lists.mjs` is one schema fix away from automating this. Until then: this runbook.
