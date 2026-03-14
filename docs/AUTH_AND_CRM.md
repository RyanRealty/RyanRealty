# Auth and CRM

## Where is “user” name and email set?

- **Logged-in visitor (header “Welcome, …”, account pages)**  
  Comes from **Supabase Auth**: Google profile or the email/password account they signed in with. They can edit display name and see email on **Account → Profile**. There is no single “global user”; each visitor has their own.

- **Site-wide business name and contact email (footer, copyright)**  
  Set in **.env.local** (and in Vercel for production):
  - `NEXT_PUBLIC_SITE_OWNER_NAME=Ryan Realty`
  - `NEXT_PUBLIC_SITE_OWNER_EMAIL=hello@ryanrealty.com`  
  If set, the footer shows the name and a mailto link. If not set, the footer uses “Ryan Realty” and no contact email.

## Sign-in (Google, Facebook, Apple)

- Auth is handled by **Supabase Auth** with OAuth providers.
- **Setup:**
  1. In [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Providers, enable Google (and optionally Facebook, Apple).
  2. Add the provider’s Client ID and Secret (from Google Cloud Console, Facebook Developer, etc.).
  3. In Authentication → URL Configuration, set **Site URL** to your app URL (e.g. `https://yourdomain.com` or `http://localhost:3000`).
  4. Add **Redirect URLs**: `http://localhost:3000/**`, `https://yourdomain.com/**`, etc.

- **Env:** Set `NEXT_PUBLIC_SITE_URL` to the same value as Site URL (e.g. `http://localhost:3000` in dev, `https://yourdomain.com` in prod). Required so the “Sign in with Google” redirect lands back on your app.

## Saved searches

- Logged-in users can **save** the current search (listings or city/subdivision page) with a name.
- Saved searches appear under **My saved searches** (header dropdown when signed in) and on `/account/saved-searches`.
- Data is stored in the `saved_searches` table (RLS: users see only their own rows). Run `npx supabase db push` to apply the migration.

## CRM follow-up

- When a user signs in (OAuth callback), the app can send their info to your CRM so you can follow up.
- **Env:** Set `CRM_WEBHOOK_URL` to your CRM’s webhook or API endpoint (e.g. Zapier, Make, or your CRM’s “incoming lead” URL).
- **Payload** (POST, JSON):  
  `{ "source": "ryan_realty", "user_id": "...", "email": "...", "name": "...", "created_at": "..." }`
- If `CRM_WEBHOOK_URL` is not set, no request is sent. Failures are ignored so sign-in still succeeds.
