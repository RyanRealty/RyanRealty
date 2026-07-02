# EMAIL SEND AUDIT — "archived emails still going out" (2026-07-02)

> Investigation of Matt's report: "somewhere I'm still sending out archived emails, why" /
> "emails keep sending to Brian Keith and others, must stop ASAP." DIAGNOSIS ONLY — nothing was
> disabled or mutated during this audit. Every claim below is backed by a live query or a
> read-only FUB API pull run in this session.

---

## THE ANSWER (smoking gun — confirmed)

**Follow Up Boss is still sending automated nurture emails ("FUB/Beacon") to your contacts through
your connected Gmail account. Our CRM is NOT sending them — it only READS them back.**

- The emails have subject/body "archived" (a legacy FUB nurture template, id 28, which no longer
  exists in FUB — it's from before the June template rebuild). Body = just your signature block.
- They go out on a **fixed per-contact cadence** (Brian Keith always ~15:43–15:44 UTC; Laurie
  McAdam always ~15:00 UTC; Nadean always ~18:53 UTC) — the signature of a scheduled automated
  campaign, not manual sends.
- FUB's own `/v1/emails` API records each of these with `campaignOrigin: "FUB/Beacon"`,
  `emailTemplateId: 28`, `userId: 1` (Matt), `emailAccountId: 528627` (your connected Gmail),
  `status: "Sent"`, `actionPlanId: null`. **FUB sends them via your Gmail**, so they land in your
  Gmail "Sent" folder, and our read-only `crm-gmail-sync` cron ingests them into the CRM timeline
  as `source='gmail'` `email_out` rows — which is why they *look* like the CRM is sending them.
- **Timestamp proof (FUB email time == CRM ingest time, to the second):**
  | Contact | FUB `/v1/emails` sent time | CRM timeline "archived" row |
  |---|---|---|
  | Brian Keith (FUB 27005 / crm 18197) | 2026-07-02 **15:44:01** | 2026-07-02 **15:44:02** |
  | Laurie McAdam (FUB 27022 / crm 42467) | 2026-07-02 **15:00:54** | 2026-07-02 **15:00:55** |
  | Nadean TaberMartinez (FUB 27007 / crm 18199) | 2026-06-28 **18:53:56** | 2026-06-28 **18:53:56** |

**Our-code-clean confirmation:** none of the 14 affected contacts is driven by our send paths.
Our sequence engine has 1 running enrollment (Laurie, next send 2026-07-03 01:58, a DIFFERENT
template — "We have your home value request") and the others are `stopped` / `suppressed` /
`paused_reply` / not enrolled at all. Several affected contacts (Brian Keith, Nadean, Kungfumailman)
have NO enrollment in any of our sequences, yet still receive the "archived" emails — proving the
sends are FUB, not us. Nothing on our side was disabled because nothing on our side is sending.

## THE STOP (what Matt does — pick one)

**A. Fastest total stop (recommended, instant, total):** revoke FUB's access to your Google account.
Go to **https://myaccount.google.com/connections** (or `myaccount.google.com/permissions`) →
find **Follow Up Boss** → **Remove access**. This severs FUB's OAuth send grant on your Gmail
(emailAccountId 528627). FUB can no longer send a single email as you. Instant and complete.
- Trade-off: FUB also loses read access to your Gmail. Since the CRM cutover, FUB is READ-ONLY
  reference — you don't need FUB's Gmail integration anymore, so this is clean.

**B. Alternative (keeps FUB↔Gmail connected):** turn off the FUB campaign in the FUB UI. The sends
carry `campaignOrigin: "FUB/Beacon"` — in FUB, go to the **Beacon / smart-campaign or automated
email area** and disable the active nurture campaign(s) using the legacy templates. (FUB Action
Plans are NOT the culprit — all affected contacts show 0 action-plan enrollments; this is a
Beacon/smart-campaign, so pausing action plans alone will NOT stop it.) If the campaign can't be
located quickly, use option A — it's guaranteed.

**C. We touch nothing programmatically.** Per policy we do not disable FUB via the API. The
FUB account still exists as read-only reference; the stop is a UI/Google action you take.

## Should our side ALSO change? (data-quality follow-up — recommend, do NOT execute without Matt)

The `crm-gmail-sync` cron is behaving correctly (it faithfully records what's in your Gmail Sent
folder). But it mislabels FUB's automated drips as your sends, with the confusing title "archived",
which is what made this look like the CRM was sending. Two optional cleanups (Matt's call):

1. **Filter FUB-automation emails out of the ingest** (or don't label them `email_out`): the
   gmail-sync could detect these (subject == "archived", or a FUB tracking header / footer) and
   either skip them or file them under a distinct kind so they don't read as broker-authored sends.
   Best done AFTER option A/B stops the source — otherwise we're papering over live sends.
2. **Clean up the 48 already-ingested "archived" rows** (14 contacts, 2026-06-01 → 2026-07-02, all
   `source='gmail'`, `dedupe_key LIKE 'gmail:rfc:%'`). They pollute those contacts' timelines with a
   meaningless "archived" email_out. RECOMMEND a targeted delete of
   `crm_timeline WHERE kind='email_out' AND lower(title)='archived' AND source='gmail'` — **but only
   after Matt approves**, and ideally after the source is stopped so they don't just re-accrue.

---

## FULL PATH INVENTORY (every way the CRM can send email to contacts)

Ranked by likelihood of being Matt's "archived emails." Legend: **CONTACTS** = external
leads/subscribers; **INTERNAL** = Matt or brokers only.

### 1. FUB/Beacon via Matt's Gmail — ✅ THE CULPRIT (external, active, ongoing)
- **What:** legacy FUB nurture campaign, template 28, subject "archived", sent by FUB through your
  connected Gmail (emailAccountId 528627, `campaignOrigin: "FUB/Beacon"`).
- **Active?** YES — latest send 2026-07-02 15:44. 48 sends since 2026-06-01, 14 contacts, 7 in last 7d.
- **Our code's role:** NONE for sending. `crm-gmail-sync` (`app/api/cron/crm-gmail-sync`) is
  read-only — `syncMailboxWindow` in `lib/crm/gmail.ts` uses only `messages.list` + `messages.get`
  (lines 165, 181, 199). The `messages.send` at line 361 is a DIFFERENT function (`sendCrmEmail`)
  not called by the sync cron.
- **Off-switch:** Matt — Google connections → remove FUB (option A), or disable the FUB Beacon
  campaign (option B). No env flag / cron on our side stops it, because it isn't our send.

### 2. CRM sequence engine — INTERNAL RISK, but NOT firing to these contacts
- **Route:** `app/api/cron/crm-sequence-engine` (every 15 min). Sends via **Gmail** (`sendCrmEmail`).
- **State (live):** 4 active sequences (Buyer/Seller/FSBO/Expired Master), 21 enrollments total,
  **1 running** (Laurie 42467, next 2026-07-03 01:58), 0 due right now.
- **Is it sending the "archived" emails?** NO. Its templates are the June set ("We have your home
  value request", etc.), not "archived". The affected contacts are stopped/suppressed/unenrolled.
- **Known latent bug (not this incident):** the engine does NOT exclude `crm_people.deleted` or
  `stage IN ('Trash','Archive','Closed')` from the send loop, and the 2026-06-13 first-touch-rewrite
  migration bulk-reset non-terminal enrollments to `step_index=0, status='running'` with no
  per-(enrollment,step) send-ledger. Worth fixing, but it is NOT the source of Matt's report.
- **Off-switch:** set `crm_sequences.status='paused'`, or remove the cron from `vercel.json`
  (lines 31–34). No env flag.

### 3. crm-auto-enroll — INTERNAL RISK, not firing here
- **Route:** `app/api/cron/crm-auto-enroll` (every 15 min). Enrolls NEW contacts (trailing 7 days,
  hard epoch floor 2026-06-10) into a master sequence by tag. Hard-stop fail-closed; one master
  sequence per person ever. Does NOT check `deleted`/`stage` (same latent gap as #2).
- **Culprit?** NO — the affected contacts are old (pre-epoch) and not being enrolled.
- **Off-switch:** remove cron `vercel.json` (lines 35–38).

### 4. crm-scheduled-sends → bulk email-cohort — CONTACTS, but empty/idle
- **Route:** `app/api/cron/crm-scheduled-sends` (every 5 min) claims due `crm_scheduled_sends`
  rows and enqueues an `email-cohort` bulk job → sends via **Resend**.
- **State (live):** `crm_scheduled_sends` total 0. Nothing queued. Cohort sends have strong
  per-recipient dedupe (`bulk:email-cohort:<jobId>:p:<personId>:sent`) and exclude soft-deleted.
- **Culprit?** NO — no scheduled rows exist.
- **Off-switch:** remove cron; drain-off = remove `crm-bulk-worker` cron.

### 5. crm-market-report-send — CONTACTS, active but 1 subscriber
- **Route:** `app/api/cron/crm-market-report-send` (daily 16:00 UTC) → `lib/crm/market-report-send.ts`,
  sends via **Resend** to `crm_report_subscriptions`.
- **State (live):** 1 subscription total, 1 active, last send 2026-06-30 16:00. Cadence-gated,
  suppression fail-closed, one-click unsubscribe.
- **Culprit?** NO — subject is a market report, not "archived"; 1 subscriber, not the 14 contacts.
- **Off-switch:** deactivate the `crm_report_subscriptions` row, or remove the cron. No env flag.

### 6. saved-search-alerts — CONTACTS, but tables empty
- **Route:** `app/api/cron/saved-search-alerts` (daily 14:00 UTC) + `app/actions/saved-search-alerts.ts`,
  sends via **Resend** to `saved_searches` (signed-in) + `guest_search_alerts` (guests).
- **State (live):** `saved_searches` total 0, `guest_search_alerts` total 0. Nothing to send.
- **Gate:** `SIGNED_IN_ALERTS_ENABLED = true` (hardcoded in route, not env); guest path always runs.
- **Culprit?** NO — both tables empty.
- **Off-switch:** flip `SIGNED_IN_ALERTS_ENABLED` to false in code / remove cron; suppression blocks
  per-recipient.

### 7. Newsletter — CONTACTS, MANUAL only
- **`app/actions/newsletter.ts` / `contact-newsletter.ts`.** Sends via **Resend** to
  `newsletter_subscribers` / one CRM person. **No cron exists** (grep-confirmed) — fires only from
  the admin UI. `newsletter_recipients` total 0. Not an automated source.

### 8. Internal-only Resend digests/alerts — NOT contacts (ruled out)
All go to `matt@ryan-realty.com` or broker emails, never to leads:
- `detect-fsbo-listings` → `lib/fsbo-alert.ts` → Matt.
- `detect-expired-listings` / `sync-delta` → `lib/expired-alert.ts` → Matt.
- `marketing-daily-digest`, `analytics-daily-digest`, `gbp-monthly-digest`,
  `marketing-optimization-report` → Matt/admin.
- `daily-broker-digest`, `weekly-pipeline-digest` → brokers/Matt (and NOT scheduled in vercel.json).
- `crm-task-reminders` → iMessage/Twilio to brokers, no email.
- `seller-lead-attribution` / `marketing-measurement-loop` → no send (data only).

### Core sender note
`lib/resend.ts` has **no global email kill-switch** (no `EMAIL_ENABLED` / `RESEND_ENABLED` / dry-run
flag). The only universal Resend lever is unsetting/rotating `RESEND_API_KEY` in Vercel (kills ALL
Resend email, including internal digests). This does NOT affect the FUB/Beacon culprit, which sends
via Gmail, not Resend.

---

## Which stops need Matt vs which we can flip on approval

| Path | Who stops it | How |
|---|---|---|
| **1. FUB/Beacon (the culprit)** | **MATT** (UI/Google) | Google connections → Remove FUB (option A) OR disable the FUB Beacon campaign (option B) |
| 2. Sequence engine | We can, on approval | Pause `crm_sequences` or remove cron (not the culprit) |
| 3. Auto-enroll | We can, on approval | Remove cron (not the culprit) |
| 4. Scheduled sends / cohort | We can, on approval | Idle now; remove cron (not the culprit) |
| 5. Market-report send | We can, on approval | Deactivate subscription / remove cron (not the culprit) |
| 6. Saved-search alerts | We can, on approval | Code flag / remove cron (tables empty; not the culprit) |
| 7. Newsletter | N/A | Manual only |
| 8. Internal digests | We can, on approval | Unset `RESEND_API_KEY` (internal only; not the culprit) |

**Bottom line:** the stop is entirely on Matt's side (FUB/Google). No CRM cron or env flag stops
these because the CRM is not the sender — it only ingests FUB's Gmail sends. Optional follow-ups
(filter the ingest, delete the 48 polluting rows) await Matt's go-ahead.
