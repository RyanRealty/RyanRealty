# Email send tracking (end-to-end goal)

Date: 2026-08-30
Surfaces:
- `/admin/crm/reporting/batch-emails` (grouped bulk)
- `/admin/crm/reporting/batch-emails/[jobId]` (who it reached)
- `/admin/reports/emails` (every send, 1:1 included)
- Contact record Email engagement

Production: ryan-realty.com after `npm run push` + deploy verify

Do **not** fire the River West 2,714-person send as part of this job.

## What exists when this is done

Anytime a broker sends email (1:1 composer or a People-list batch):

1. The send is recorded as a `sent` row in `email_events`.
2. Delivered / bounced land from the sending provider (Resend webhook), joined
   back to the same send even when the webhook omits `email_key`.
3. Opened / clicked land from the first-party pixel and wrapped links.
4. A click that hits ryan-realty.com still stamps `?_pid=` / `?agent=`; the
   identity bridge stitches `visitor_sessions.crm_person_id`.
5. Admin can answer, per send:
   - who it went to
   - grouped as one campaign when it was bulk
   - who bounced, delivered, opened, clicked
   - who came to the site after the send

Gmail 1:1 has no provider delivery webhook. Those rows stay **Sent** until an
open, click, or site visit — that is honest, not a fake Delivered.

## What a real user does

- People list → Batch Email → after the job finishes, **Who it reached** (or
  Reporting → Batch emails → Recipients) → filter Delivered / Bounced / Opened /
  Clicked / Visited the site after → open a person.
- 1:1 composer send → `/admin/reports/emails` shows that person with status,
  opened, clicked, and whether they hit the site after.
- Person record still shows Email engagement totals.

## Bar

- One store: `email_events`. No parallel tracker.
- PostgREST 1000-row cap: event reads and site-visit reads paginate.
- Restricted brokers only see their own batches (`scopeBroker`).
- The new job page does not `redirect()` (streamed-redirect shrink-only).
- Admin v2 tokens only. Filter is a dropdown, not a chip wall.
