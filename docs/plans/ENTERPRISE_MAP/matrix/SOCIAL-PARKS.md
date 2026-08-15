# Social platform park / token dispositions

**Updated:** 2026-08-15 (corrects the 2026-08-08 RECONNECT reads — see EVIDENCE-LOG 2026-08-15 + `process_escape_ledger`)  
**Authority:** live auth tables + heartbeat `sync_logs` + env (no secrets in this file)

| Platform | INT | Auth table | Token state (verified 2026-08-15) | Disposition | Owner |
|----------|-----|------------|-------------|-------------|-------|
| TikTok | INT-011 | tiktok_auth | refresh_token on file; heartbeat rolls the 24h token daily (**refreshed 12:00Z, valid to 2026-08-16 12:00Z**) | **KEEP** — self-renewing | S5 |
| YouTube | INT-012 | youtube_auth | refresh_token on file; 1h Google TTL, **auto-refreshes** (live renew verified) | **KEEP** — self-renewing | S5 |
| X | INT-013 | x_auth | rotating refresh_token on file; 2h TTL, **auto-refreshes** (live renew verified) | **KEEP** — self-renewing | S5 |
| GBP | INT-009 | google_business_profile_auth | refresh_token on file; 1h Google TTL, **auto-refreshes** (live renew verified) | **KEEP** — self-renewing | S5 |
| LinkedIn | INT-010 | linkedin_auth | access token expired 2026-07-09; **refresh_token NULL** (provider issued none) — cannot self-renew | **PARKED** per Matt 2026-08-15 | S5 |
| Threads | INT-014 | threads_auth n=0 | NOT_CONNECTED | **PARKED** until product prioritizes Meta Threads publish | S5 |
| Nextdoor | INT-015 | nextdoor_auth n=0 | NOT_CONNECTED; no client key in .env.local | **PARKED** — no ops demand | S5 |
| Pinterest | INT-016 | pinterest_auth n=0 | NOT_CONNECTED; no client key | **PARKED** — no ops demand | S5 |

## Park law

- PARKED means: do not invent connect work, do not treat as broken production, do not leave as silent UNKNOWN, **do not ask Matt to reconnect it**.
- A short `expires_at` on a row that holds a refresh_token is provider TTL design, not a dead connection — the daily 12:00Z token-heartbeat renews it. Liveness authority is the heartbeat's `sync_logs`, never `expires_at` alone.
- There is no standing RECONNECT class. A new OAuth grant happens only if Matt decides a parked platform matters.
- TikTok/YouTube/X/GBP KEEP does not imply publish is unblocked; public social publish remains approval-gated.

## Explicit park stamp (MAP close)

INT-014, INT-015, INT-016 are **PARKED** as of 2026-08-08. Reopen only with Matt GO + credentials.
