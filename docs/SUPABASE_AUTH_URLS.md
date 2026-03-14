# Step-by-step: Add auth URLs in Supabase

So sign-in (Google + email) works on **localhost** and on **Vercel**, you must add both URLs in Supabase.

---

## 1. Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Log in and select your **Ryan Realty** project (the one whose URL and anon key are in your `.env.local`).

---

## 2. Go to URL Configuration

1. In the left sidebar, click **Authentication**.
2. Click **URL Configuration** (under Authentication).

You’ll see:

- **Site URL** (single value)
- **Redirect URLs** (list of allowed redirect URLs)

---

## 3. Set Site URL

Use your **production** URL (so after sign-in in production you land on the right place):

- **Value:** `https://ryanrealty-ryanrealtys-projects.vercel.app`  
  (or your custom domain, e.g. `https://ryan-realty.com`, with **no trailing slash**)

Type it in the **Site URL** field and leave it saved.  
(For local dev we only need Redirect URLs; see below.)

---

## 4. Add Redirect URLs

In **Redirect URLs**, add **one URL per line**. Add these exactly (copy-paste and adjust if you use a custom domain):

**For local development:**

```
http://localhost:3000/auth/callback
http://localhost:3000
```

**For Vercel (production):**

```
https://ryanrealty-ryanrealtys-projects.vercel.app/auth/callback
https://ryanrealty-ryanrealtys-projects.vercel.app
```

**If you use a custom domain later**, add those too, e.g.:

```
https://www.ryan-realty.com/auth/callback
https://www.ryan-realty.com
```

So your full list might look like:

```
http://localhost:3000/auth/callback
http://localhost:3000
https://ryanrealty-ryanrealtys-projects.vercel.app/auth/callback
https://ryanrealty-ryanrealtys-projects.vercel.app
```

5. Click **Save** at the bottom of the URL Configuration section.

---

## 5. Check Providers (optional)

- Under **Authentication** → **Providers**:
  - **Google:** Enabled and Client ID/Secret set if you use Google sign-in.
  - **Email:** Enabled if you use email/password or magic link.

---

## Summary

| Setting        | Value (example) |
|----------------|------------------|
| **Site URL**   | `https://ryanrealty-ryanrealtys-projects.vercel.app` |
| **Redirect URLs** | `http://localhost:3000/auth/callback`, `http://localhost:3000`, `https://ryanrealty-ryanrealtys-projects.vercel.app/auth/callback`, `https://ryanrealty-ryanrealtys-projects.vercel.app` |

After saving, sign-in should work on both localhost and Vercel. If you still get “Unable to exchange external code”, double-check that the **exact** Vercel URL (no typo, no trailing slash in the callback path) is in Redirect URLs.
