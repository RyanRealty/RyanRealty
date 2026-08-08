# Social platform park / reconnect dispositions

**Updated:** 2026-08-08T21:10Z  
**Authority:** live auth tables + env (no secrets in this file)

| Platform | INT | Auth table | Token state | Disposition | Owner |
|----------|-----|------------|-------------|-------------|-------|
| LinkedIn | INT-010 | linkedin_auth | **EXPIRED** 2026-07-09 | **RECONNECT** (Matt OAuth) | S5 |
| TikTok | INT-011 | tiktok_auth | **VALID** until 2026-08-09 | **KEEP** + auto-refresh watch | S5 |
| YouTube | INT-012 | youtube_auth | **EXPIRED** 2026-08-08 | **RECONNECT** (Matt OAuth) | S5 |
| X | INT-013 | x_auth | **EXPIRED** 2026-08-08 | **RECONNECT** (Matt OAuth) | S5 |
| GBP | INT-009 | google_business_profile_auth | **EXPIRED** 2026-08-08 | **RECONNECT** (Matt OAuth) | S5 |
| Threads | INT-014 | threads_auth n=0 | NOT_CONNECTED | **PARKED** until product prioritizes Meta Threads publish | S5 |
| Nextdoor | INT-015 | nextdoor_auth n=0 | NOT_CONNECTED; no client key in .env.local | **PARKED** — no ops demand | S5 |
| Pinterest | INT-016 | pinterest_auth n=0 | NOT_CONNECTED; no client key | **PARKED** — no ops demand | S5 |

## Park law

- PARKED means: do not invent connect work, do not treat as broken production, do not leave as silent UNKNOWN.
- RECONNECT is **Matt-gated OAuth** (real account login) — agents prepare checklists only.
- TikTok KEEP does not imply publish is unblocked; public social publish remains approval-gated.

## Explicit park stamp (MAP close)

INT-014, INT-015, INT-016 are **PARKED** as of 2026-08-08. Reopen only with Matt GO + credentials.
