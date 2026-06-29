# FUB cutover readiness — 2026-06-29 (disconnect scheduled 2026-06-30)

Full readiness pass driven by the `crm-e2e` guardian. **Verdict: cutover-ready.**
Battery: **32 pass · 1 warn (anthropic-credits, marketing-only) · 0 fail.**

## Every FUB function → native CRM equivalent

| FUB function | Native equivalent | Status |
|---|---|---|
| Inbound calls / texts | Twilio (`/api/twilio/*`) → `crm_timeline`, recordings, voicemail | ✅ live (cutover 2026-06-24) |
| Email send/receive | Gmail DWD sync (3 mailboxes) + send via Gmail/Resend | ✅ green |
| Site lead forms | LP form actions → `ensureNativeLead` → `crm_people` | ✅ native (new leads born `fub_legacy_id NULL`) |
| FB Lead Ads | `/api/meta/lead-webhook` → `sendEvent`→`ensureNativeLead` (native), independent of the legacy FUB REST dual-write | ✅ native |
| Inbound-call leads | Twilio → `findOrCreatePersonByPhone` | ✅ (8/day observed) |
| Expired/FSBO detection | `detect-expired-listings` / `detect-fsbo-listings` crons | ✅ green |
| Nurture / action plans | CRM master sequences (Seller/Buyer/Expired/FSBO) **ACTIVE** + `crm-sequence-engine` cron | ✅ 4/4 active+normalized |
| Auto-enroll new leads | `crm-auto-enroll` cron (0 eligible unenrolled) | ✅ green |
| Suppression / opt-outs (TCPA) | `lib/crm/suppressions.ts` fail-closed gate in front of every send | ✅ blocks confirmed |
| Tasks / Deals / Inbox | admin CRM surfaces (auth-redirect + no anonymous leak) | ✅ green |
| A2P / outbound SMS | brand APPROVED, campaign VERIFIED (2026-06-23) | ✅ |
| Historical data | full FUB backfill imported + reconciled (this session) | ✅ no drop-off |

## What changed in this pass
- Retired the stale `cron.fub-delta` + `fresh.fub-delta` battery checks (the FUB
  sync routes were deleted at cutover prep, commit 60f3d787; intake is native now).
- Refreshed `web.compliance-cta-reachable` to the current SMS consent text +
  multi-step-form awareness (was greppping the pre-2026-06-23 wording).
- Removed a stray synthetic test contact (#52267 DELETE-ME).
- Disabled the two FUB automations still sending blanked "archived" templates
  (Web Inquiry Option 01, Nurture Contact Generic) — moot after disconnect, but
  stops the bad sends until then.

## ⚠️ One item for Matt to confirm BEFORE the disconnect

**Portal direct-integration leads (Zillow Premier Agent / Realtor.com).** There is
**no native CRM intake path** for these: no portal email parser, and `gmail-sync`
only attaches mail to existing contacts (it won't create a lead from a portal
notification). No active portal *lead* emails were found in Matt's inbox in the
last 10 days (only consumer marketing + FUB digests), so this may already be a
non-issue. BUT if a paid Zillow/Realtor feed routes leads **directly into FUB via
FUB's API integration** (which wouldn't appear in Gmail), those leads will drop
at disconnect.

- **If Matt has an active Zillow/Realtor → FUB feed:** re-point it before tomorrow
  (portal → a lead email address we parse → `ensureNativeLead`, or a portal
  webhook). Flag it and I'll build the parser tonight.
- **If not:** nothing to do — all live sources are native.

## Non-blocking cleanup (post-cutover)
- `meta/lead-webhook` and a few readers still make FUB REST calls (legacy
  dual-write). They'll error harmlessly once FUB is off (the native path is
  independent), but should be stripped in a follow-up.
- FUB-redacted historical **text bodies** (~2,170) become unrecoverable once FUB
  is gone — only register FUB for content + re-run the comms import if those
  bodies matter (otherwise they stay metadata-only).
