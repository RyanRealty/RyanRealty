# Switch to a New Supabase Database

Use this when you created a **new** Supabase project and want the app (and CLI) to use it instead of the old one. The code is already built; you only need to point the app at the new project and bring the new database up to date.

---

## 1. Get the new project’s credentials

In the [Supabase Dashboard](https://supabase.com/dashboard):

1. Open the **new** project (the one you want to use).
2. Go to **Project Settings** → **API**.
3. Copy:
   - **Project URL** → use for `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **Project Settings** → **Database** and note your **Database password** (needed for linking the CLI).

---

## 2. Point the app at the new database

**Local**

- Edit `.env.local` and set:
  - `NEXT_PUBLIC_SUPABASE_URL=` (new Project URL)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (new anon key)
  - `SUPABASE_SERVICE_ROLE_KEY=` (new service_role key)
- Restart the dev server so it picks up the new env.

**Vercel (production)**

- In Vercel: Project → **Settings** → **Environment Variables**.
- Update the same three variables for the environments you use (e.g. Production, Preview).
- Redeploy (e.g. push a commit or “Redeploy” from the Deployments tab) so new values are used.

---

## 3. Link the Supabase CLI to the new project

So `npx supabase db push` runs against the **new** project:

1. In the dashboard URL for your **new** project you’ll see:  
   `https://supabase.com/dashboard/project/XXXXXXXX`  
   The **project ref** is `XXXXXXXX`.

2. In the project root, run:
   ```bash
   npx supabase link --project-ref XXXXXXXX
   ```
   Use the ref of the **new** project. When prompted, enter the **new** project’s database password (Project Settings → Database).

If you had previously linked to another project, this replaces that link; `db push` will now apply to the new database.

---

## 4. Apply all migrations to the new database

In the project root:

```bash
npx supabase db push
```

This applies every migration in `supabase/migrations/` to the new project. You only need to run it once per new database (or after pulling new migrations).

---

## 5. Seed base data (optional but recommended)

**Cities, communities, settings**

```bash
npx tsx scripts/seed.ts
```

Requires `.env.local` to have the new `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from step 2).

**Brokers and About page (optional)**

- Open the **new** project in Supabase Dashboard → **SQL Editor**.
- Paste the contents of `supabase/seed_brokers_and_about.sql` and run it.

---

## 6. Auth URL configuration (new project)

In the **new** Supabase project:

1. Go to **Authentication** → **URL Configuration**.
2. Set **Site URL** (e.g. `https://yoursite.com` or `http://localhost:3000` for dev).
3. Add **Redirect URLs** (e.g. `https://yoursite.com/auth/callback`, `http://localhost:3000/auth/callback`).

Without this, sign-in and callbacks may fail.

---

## 7. Pull listing data into the new database

The new database starts with no listings. To fill it from Spark:

1. Ensure `SPARK_API_KEY` (and `SPARK_API_BASE_URL` if needed) are set in `.env.local` and in Vercel.
2. Open the app → **Admin** → **Sync**.
3. Run **Smart Sync** and let it run (listings phase, then history). This can take a while for a full sync.

---

## Summary checklist

| Step | What |
|------|------|
| 1 | Get new project URL, anon key, service_role key, DB password from dashboard |
| 2 | Update `.env.local` and Vercel env vars (all 3 Supabase vars) |
| 3 | `npx supabase link --project-ref <new-ref>` |
| 4 | `npx supabase db push` |
| 5 | `npx tsx scripts/seed.ts` (+ optional `seed_brokers_and_about.sql` in SQL Editor) |
| 6 | Set Auth → URL Configuration in the new project |
| 7 | Admin → Sync → Smart Sync to pull listings |

After this, the app and CLI both use the new database. You do **not** need to re-run the build phases or master plan.
