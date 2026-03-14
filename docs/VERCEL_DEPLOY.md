# Vercel deployment and staying in sync

## How Vercel gets your code

Vercel deploys from your **Git repository** (e.g. GitHub/GitLab/Bitbucket). It does **not** see uncommitted or unpushed changes on your machine.

- **Commit** = save changes locally (Git).
- **Push** = send those commits to the remote (e.g. `origin` on GitHub).
- **Vercel** = builds and deploys when it sees a **new push** on the branch it’s connected to (often `main` or `master`).

So: if your latest work isn’t committed and pushed, Vercel will keep serving the last version it saw.

---

## Step-by-step: Get the latest code onto Vercel

1. **Commit your changes**
   ```bash
   git add .
   git status   # optional: check what will be committed
   git commit -m "Your message, e.g. Auth, profile, email sign-in"
   ```

2. **Push to the remote**
   ```bash
   git push origin main
   ```
   (Use your branch name if different, e.g. `master`.)

3. **Vercel**
   - Vercel will detect the push and start a new deployment.
   - In the Vercel dashboard: **Project → Deployments** to see status and logs.

---

## If the deployment fails (errors)

1. **Vercel dashboard**
   - Open your project → **Deployments**.
   - Click the failed deployment → **Building** or **Logs**.
   - Read the error message (e.g. missing env var, build timeout, TypeScript error).

2. **Reproduce the build locally**
   ```bash
   npm run build
   ```
   If this fails, fix the errors; then commit, push, and redeploy.

3. **Environment variables**
   - Vercel → **Project → Settings → Environment Variables**.
   - Add the same vars you use in `.env.local` for production (e.g. `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).
   - **Or sync from .env.local:** From the project root, run `npm run vercel:env` after linking Vercel (`vercel link`) and logging in (`vercel login`). This pushes each variable from `.env.local` to Vercel **Production**. For Preview use: `node scripts/sync-vercel-env.mjs preview`.
   - **Redeploy** after changing env vars (Deployments → ⋮ on latest → Redeploy).

4. **Build timeouts**
   - If a page takes too long during build, it can timeout. We set `dynamic = 'force-dynamic'` on heavy admin pages (e.g. banners, sync) so they aren’t built at deploy time. If another page times out, add the same export to that page.

---

---

## Production vs localhost: why they can look different

**Production should look like localhost** — same layout, same listings, same header/footer. If it doesn’t:

1. **Stale or empty data**  
   The root layout and homepage are set to `dynamic = 'force-dynamic'`, so they render on every request using live Supabase data. If you still see old or empty content, **redeploy** after the change (Deployments → ⋮ → Redeploy).

2. **Wrong or missing `NEXT_PUBLIC_SITE_URL`**  
   In Vercel → Settings → Environment Variables, set `NEXT_PUBLIC_SITE_URL` to your live URL with no trailing slash, e.g. `https://ryanrealty-ryanrealtys-projects.vercel.app` or `https://ryan-realty.com`. Redeploy after changing env vars.

3. **You’re signed in locally**  
   On localhost you may be signed in (header shows “Account”); on production you’re usually not (header shows “Sign in”). That’s expected.

4. **Supabase redirect URLs**  
   For sign-in to work in production, add your Vercel URL to Supabase → Authentication → URL Configuration → Redirect URLs (see `docs/SUPABASE_AUTH_URLS.md`).

---

## Cron and background jobs

These API routes run on a schedule (Vercel Cron) or via manual trigger. Each validates `Authorization: Bearer <CRON_SECRET>` (set in Vercel env).

| Route | Purpose | Suggested schedule |
|-------|---------|--------------------|
| `/api/cron/sync-full` | Full/delta MLS sync from Spark | Every 15–30 min |
| `/api/cron/market-report` | Generate weekly market report (HTML + banner) | Weekly |
| `/api/cron/refresh-place-content` | Refresh geo/place content | Daily or weekly |
| `/api/cron/optimization-loop` | Analyze GA4/Search Console; write findings to `optimization_runs` | Weekly |

In Vercel: **Project → Settings → Cron Jobs** (or `vercel.json`), add each URL with the desired schedule. Set `CRON_SECRET` in Environment Variables and pass it as `Authorization: Bearer <CRON_SECRET>` when invoking the route.

---

## Quick checklist

- [ ] Code committed (`git status` clean or only intended changes).
- [ ] Code pushed (`git push origin main` or your branch).
- [ ] Vercel env vars set (especially `NEXT_PUBLIC_SITE_URL` = your Vercel URL).
- [ ] Supabase Redirect URLs include your Vercel URL (see `docs/SUPABASE_AUTH_URLS.md`).
