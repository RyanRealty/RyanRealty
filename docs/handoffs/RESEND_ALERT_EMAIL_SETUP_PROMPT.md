# Agent prompt — turn on listing-alert email delivery (Resend)

Copy everything below the line and give it to the agent.

---

You are working in the Ryan Realty Next.js repo. Your job is to make the **listing-alert emails actually deliver** to real recipients and then activate the alert cron. Right now the capture works (anonymous visitors on `/search`, and the city/community page CTAs, sign up for "listing alerts" → they become FUB buyer leads and rows in `public.guest_search_alerts`), but **no alert email can reach a real inbox yet** because the sender is Resend's shared sandbox. Do the work below, verify each step, and report what still needs Matt (DNS access, a mailing address, the go-ahead to activate).

## Background (read these files first, do not guess)
- `lib/resend.ts` — `DEFAULT_FROM` falls back to `'Ryan Realty <onboarding@resend.dev>'` (the sandbox, which only delivers to the Resend account owner). `sendEmail` now also accepts a `headers` field.
- `app/actions/saved-search-alerts.ts` — `runGuestSearchAlerts` builds + sends the guest alert email (subject `Listings for <search>`, a `List-Unsubscribe` header, and a footer line `Ryan Realty, Bend, Oregon` that is a **placeholder** for the CAN-SPAM physical address). `runSavedSearchAlerts` is the signed-in equivalent.
- `app/api/cron/saved-search-alerts/route.ts` — the cron entry (Bearer `CRON_SECRET`) that runs both passes. It is **NOT** scheduled in `vercel.json` yet.
- `vercel.json` — the `crons` array. `/api/cron/saved-search-alerts` is intentionally absent.

## Tasks

1. **Verify a sending domain at Resend.**
   - In the Resend dashboard (resend.com/domains), add a sending domain — prefer a subdomain like `mail.ryan-realty.com` (keeps the root domain's reputation separate).
   - Resend will show DNS records to add: an SPF `TXT`, a DKIM `TXT` (e.g. `resend._domainkey`), and a `MX` for bounce handling, plus an optional `DMARC` `TXT`. Identify where `ryan-realty.com` DNS is hosted (check the domain in Vercel → Domains, or the registrar/Cloudflare). **Adding these records needs DNS access — if you do not have it, produce the exact records as a copy-paste list for Matt and stop at this step.**
   - After the records propagate, click **Verify** in Resend and confirm the domain shows "Verified" with SPF + DKIM green.

2. **Set the from-address env var.**
   - Set `RESEND_FROM` in the Vercel **production** environment (and preview, if previews should send) to a branded, DKIM-aligned address on the verified domain, e.g. `Ryan Realty <alerts@mail.ryan-realty.com>`.
   - Confirm `RESEND_API_KEY` is already set in prod (it is used by `lib/resend.ts`).
   - Redeploy so the env var takes effect. Do NOT hardcode the address in `lib/resend.ts`; the env override is the design.

3. **Fix the CAN-SPAM physical address.**
   - Every commercial email legally needs a valid physical postal address. The brand record (`lib/brand/contact.ts`) only has `Bend, Oregon` — there is no street/PO box. **Get the real mailing address from Matt** and replace the placeholder footer line `Ryan Realty, Bend, Oregon` in `runGuestSearchAlerts` (and add the same footer + the `List-Unsubscribe` header to `runSavedSearchAlerts`, which currently lacks both). Do not invent an address.

4. **Schedule the cron — but confirm with Matt first.**
   - Add `{ "path": "/api/cron/saved-search-alerts", "schedule": "0 14 * * *" }` (daily, or hourly `0 * * * *` if you want the per-frequency gates to fire) to the `crons` array in `vercel.json`.
   - **IMPORTANT:** scheduling this cron also activates the **dormant signed-in** saved-search alerts (`runSavedSearchAlerts`), which have never run. Confirm Matt wants both turned on before committing this. Check there is no second scheduler already hitting the route.

5. **Test deliverability before declaring done.**
   - Trigger the route manually against the deployed URL with `Authorization: Bearer $CRON_SECRET` and `?dryRun=1` first to confirm it runs without sending, then a real run to a test inbox you control (insert a test `guest_search_alerts` row with your own email + a real filter set such as `{"city":"Bend","maxPrice":"800000"}`, or sign up through `/search` while signed out).
   - Verify the email lands in the **inbox** (not spam), that DKIM/SPF/DMARC pass (view the raw headers or run it through mail-tester.com), and that the one-click `List-Unsubscribe` works and the `/alerts/unsubscribe` confirm page deactivates the row.
   - Clean up any test rows you inserted.

## Out of scope / already done (do not redo)
- FUB lead creation + tagging (`audience:buyer` + `buyer:warm` + `source:idx-registration`) and the **broker notification** (a FUB task with a phone reminder on every signup) are already wired in `app/actions/search-alert-capture.ts`. Do not duplicate them.
- The capture UI, the `guest_search_alerts` table + RLS, the unsubscribe flow, and the cron's matching/dedup logic are already built and reviewed.

## Report back
For each task: done / blocked-on-Matt (with the exact DNS records or the mailing address you need) / verified. End with whether real alert emails now deliver, and whether the cron is scheduled (and that Matt approved activating the signed-in alerts).
