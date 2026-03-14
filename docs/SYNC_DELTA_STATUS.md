# Delta sync (2-min ingest) — status and how to see it

The **ingest sync that runs every two minutes** is the **Inngest “delta sync”** function. It fetches only listings that changed recently and updates your database. Its status appears on the **Sync** page (`/admin/sync`).

---

## Will it run non-stop? What if it fails?

- **How it runs:** The ingest does **not** run as one long process. Inngest triggers the delta-sync function **every 2 minutes** (cron `*/2 * * * *`). So as long as Inngest is connected and your app is deployed, you get a new run every 2 minutes. If a run fails, the next run is still scheduled 2 minutes later (Inngest retries failed runs up to 2 times, then marks the run as failed).
- **How you know if it fails:**
  1. **Sync page (`/admin/sync`)** — **Last run** shows the time of the last *completed* delta run. If the ingest has stopped or is failing, **Last run** will not update. The page now shows a **stale-ingest warning** (amber box) when the last run was more than **10 minutes ago**, so you can see at a glance that the 2‑min ingest may have stopped.
  2. **Inngest dashboard** — [app.inngest.com](https://app.inngest.com): failed runs appear there with error details. Recommended: enable **Failure notifications** in your Inngest app (e.g. email or Slack) so you are alerted when a run fails instead of discovering it later on the sync page.
- **Avoiding surprise data drift:** Check the Sync page periodically, or rely on Inngest failure notifications. If you see the stale-ingest warning or “Last run” not updating, fix the cause (e.g. Spark API, Supabase, or Inngest connection) and optionally trigger **Run ingest now** once things are fixed to catch up.

---

## Where you see the status

On **Admin → Sync** (or **Admin → Sync & history**):

1. **Delta sync (2-min ingest) status** — Shows:
   - **Run ingest now** — Button to trigger one delta sync immediately (super_admin only). Same as the 2-min cron run; results appear in the run log after it completes.
   - **Last run:** Time of the most recent completed delta run, or **Never** if none have run.
   - **Runs in log:** How many delta runs appear in the sync run log below.

2. **Sync run log** — Merged list of **Delta** (2-min) and **Full** (Smart Sync / cron) runs. Each Delta row is one run of the 2-min ingest.

3. **Source vs database** — The line that used to say “Last delta sync (2-min Inngest)” is now summarized in the status card above.

All of this data comes from the **sync_checkpoints** table in Supabase. Rows are written only when the Inngest delta sync **completes** a run (sync_type = `delta`, status = `completed`).

---

## Why you might see no data

If **Last run** is “Never” and **Runs in log** is 0, it means **no delta sync run has completed yet**. Common causes:

1. **Inngest is not running**  
   The 2-min job is triggered by Inngest (cron `*/2 * * * *`). If Inngest is not active, the function never runs and nothing is written to `sync_checkpoints`.

2. **Inngest not connected in production**  
   On Vercel (or similar), you must:
   - Sign up at [inngest.com](https://www.inngest.com) and create an app.
   - Set **INNGEST_EVENT_KEY** and **INNGEST_SIGNING_KEY** in your project env.
   - Deploy; Inngest Cloud will call your `/api/inngest` endpoint and run the cron.

3. **Running only locally**  
   Locally, start the Inngest dev server so the cron can trigger:
   ```bash
   npx inngest dev
   ```
   Keep it running in a terminal. Your Next.js app must be running as well. After a few minutes, delta runs should appear on the sync page.

4. **Delta sync is failing before checkpoint**  
   If the function runs but errors (e.g. Spark API or Supabase) before it inserts the checkpoint, no row is written. Check the Inngest dashboard (Cloud or dev UI) for failed runs.

---

## How to get the 2-min ingest running

| Environment | What to do |
|-------------|------------|
| **Local** | Run `npx inngest dev` and keep it running. Your app must be running (e.g. `npm run dev`). |
| **Production (e.g. Vercel)** | 1) Create an app in Inngest Cloud. 2) Add env vars **INNGEST_EVENT_KEY** and **INNGEST_SIGNING_KEY**. 3) Deploy. Inngest will invoke `/api/inngest` and run the 2-min cron. |

After the first successful delta run, **Last run** and **Runs in log** on the sync page will show data.

---

## Getting notified when the ingest fails

To avoid losing sync without noticing:

1. **Inngest Cloud** — In your [Inngest app](https://app.inngest.com), go to **Settings** (or **Alerts**) and enable **Failure notifications** (email and/or Slack). You’ll get notified when any run of the delta-sync function fails after retries.
2. **Sync page** — Visit **Admin → Sync** regularly. If the last delta run is older than 10 minutes, a warning is shown so you can investigate (Inngest dashboard, env vars, Spark/Supabase status).

---

## Summary

- **Status** = last completed delta run + number of delta runs in the log (from `sync_checkpoints`).
- **No data** = no completed delta runs ⇒ usually Inngest not running or not connected.
- **Stale warning** = last run &gt; 10 min ago ⇒ ingest may have stopped; check Inngest and env.
- **Fix:** Run `npx inngest dev` locally, or connect the app to Inngest Cloud and set the env keys in production. Enable failure notifications in Inngest so you know immediately if a run fails.
