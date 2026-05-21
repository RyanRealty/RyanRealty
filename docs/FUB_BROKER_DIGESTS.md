# FUB broker digests

Two Vercel-cron-scheduled emails that keep Matt, Paul, and Rebecca informed
without doing manual work.

## Daily new-leads digest

- **Route:** `/api/cron/daily-broker-digest`
- **Schedule:** `0 15 * * *` (15:00 UTC = 08:00 PT during DST)
- **Recipients:** every active broker in `public.brokers` (Matt, Paul, Rebecca)
- **What it sends:** one email per broker, listing every FUB person assigned to
  them whose `created` timestamp falls in the last 24 hours.

Subject: `Your new leads today, YYYY-MM-DD`

Top of email: one-paragraph summary. Example: "You got 4 new leads. 2 are
sellers, 1 is a buyer, 1 unclassified."

Lead card: name, email, phone, address, source, audience, last activity
relative time, link to open in Follow Up Boss.

## Weekly pipeline-health digest

- **Route:** `/api/cron/weekly-pipeline-digest`
- **Schedule:** `0 15 * * 1` (Monday 15:00 UTC = 08:00 PT during DST)
- **Recipients:** Matt only (override via `WEEKLY_DIGEST_EMAIL`)
- **What it sends:** weekly pipeline summary.

Subject: `Ryan Realty pipeline, week of YYYY-MM-DD`

Body contents:

1. **Key insight** at the top (e.g. expired-listing detection cadence pulled
   from `public.expired_listing_intake`).
2. **New leads this week** broken out by audience (seller, buyer, unclassified).
3. **By source** (top 10 sources of new leads).
4. **Smart list movement** week-over-week — current count and delta vs. last
   week's snapshot. Snapshots persist in `marketing_channel_daily` with
   `metric='smart_list_snapshot'`.
5. **Activity totals** — conversations, appointments, active deals, pipeline
   value.

## Auth and env

- Both routes require `Authorization: Bearer $CRON_SECRET`. Vercel cron sends
  this automatically. Manual invocation needs the same header.
- `RESEND_API_KEY` must be set. Sender defaults to
  `Matt Ryan <matt@ryan-realty.com>` (override via `RESEND_FROM`).
- `FOLLOWUPBOSS_API_KEY` powers the FUB People API queries.
- Optional: `FOLLOWUPBOSS_BROKER_USER_MAP` (e.g.
  `matthew-ryan:1,paul-stevenson:3,rebecca-peterson:2`) to skip the FUB-side
  email-lookup. Without it, the route resolves each broker's FUB user id by
  searching `/v1/users?email=<broker.email>`.

## Manual run

```bash
# Daily, dry run, no email sent
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/daily-broker-digest?dryRun=true"

# Single broker only
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/daily-broker-digest?broker=matthew-ryan"

# Weekly, dry run
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://ryanrealty.vercel.app/api/cron/weekly-pipeline-digest?dryRun=true"
```

## Brand voice

Templates live at `lib/digest-email-templates.tsx`. All copy follows
`marketing_brain_skills/brand-voice/voice_guidelines.md` §4.7: sentence case,
no em-dashes, no banned cliches, direct and kind. Numbers carry units. The
footer renders `541.213.6706` (dotted) and `ryan-realty.com` (hyphenated).
