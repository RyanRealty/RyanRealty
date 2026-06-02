# Handoff: Google (OAuth) sign-in fails at the app callback — PKCE `code_verifier` missing

**Date:** 2026-06-02
**Owner of fix:** next coding session (Matt asked to document, not fix, in this session)
**Severity:** High — Google "Continue with Google" looks enabled but **no one can actually sign in**, and **no Follow Up Boss lead is created** on Google sign-in.

---

## ✅ RESOLVED + VERIFIED LIVE (2026-06-02 ~16:30 UTC)

The PKCE fix shipped (commits `22cca83` "initiate OAuth client-side so PKCE code_verifier survives to callback", `1a34e4e`, `28671b5`, `c87d7cc`) and is **working in production end-to-end**. Verified against live GoTrue auth logs + Follow Up Boss, not assumed:

- **`POST /token` (grant_type=pkce) → 200** at 16:16:40 for `matt@ryan-realty.com` (the exchange that previously never fired). Full live chain: `/authorize 302` → `POST /token 200 [login]` → `/callback 302` → `GET /user 200`.
- **FUB lead bridge fires:** person 21966 got a `Registration` event "Signed in (Google)" at 16:16:41 and a `Visited Website` "return" at 16:17:01 (fub_cid attribution stamped). The "no FUB lead" symptom is gone.
- **Facebook provider** is enabled and returns a valid OAuth redirect (client_id 986372590790155). Both buttons work.

### Still open (cosmetic only — NOT a code / Supabase / Google-API fix)
The Google consent screen reads "to continue to **dwvlophlbvvygjfxcrhm.supabase.co**". There is **no Google API** to change the OAuth consent-screen App name (verified live: the only programmatic surface is the IAP Brands API, which is disabled on project 725620954432 and has no update method even when enabled). Two fixes, both manual/infra:
1. Google Cloud Console → Google Auth Platform → Branding → set **App name = "Ryan Realty"** (console-only, free, ~15s). Direct URL: `https://console.cloud.google.com/auth/branding?project=ryanrealty`.
2. Supabase Custom Domain add-on → `auth.ryan-realty.com`, then update the Google OAuth client redirect URI + `NEXT_PUBLIC_SUPABASE_URL` (scrubs the supabase.co host everywhere). Needs a Supabase PAT + a Cloudflare API token + DNS. Doable fully via API once those two tokens are provided.

### Also shipped this session
`components/SignInPrompt.tsx` (commit `17f0d78`): the global social sign-in modal no longer auto-pops on `/lp/*` pages or for ad-tagged traffic (fbclid / gclid / msclkid / ttclid / any utm_*), so paid-ad clicks land on the LP's own lead form instead of being interrupted by a "Continue with Google" modal.

---

## TL;DR

Google sign-in is **correctly configured and fully working at the Supabase / GoTrue layer** (proven below). The failure is **100% app-side**: the website's `/auth/callback` route cannot complete `exchangeCodeForSession(code)` because the PKCE **`code_verifier` cookie is not present** when the callback runs. The app falls through to a generic "Could not sign in" error and the real error is swallowed.

This is **not** a Supabase setting, a Google Cloud setting, or a provider toggle. Do not "fix" it by changing Supabase/Google config.

---

## Proof that Supabase + Google work (so the fixer doesn't go down the wrong path)

1. **Direct implicit-flow OAuth test produced a valid Supabase session JWT** for the Google account (`email: matt.lists.homes@gmail.com`, `full_name: Matt Ryan`, `app_metadata.provider: google`, `sub: 72f4ce14-919f-452a-bf46-2c552b9e9a0e`). So the Google client ID `725620954432-aq83t2skspo1qgk0jjhs608etgb2o9ar.apps.googleusercontent.com` + its secret in Supabase are correct, email scope works, consent works, and the Supabase callback `https://dwvlophlbvvygjfxcrhm.supabase.co/auth/v1/callback` is registered in the Google client.

2. **GoTrue auth logs (Supabase project `dwvlophlbvvygjfxcrhm`, 2026-06-02)** show the provider handshake succeeding:
   - `GET /authorize` → `302` ("Redirecting to external provider", provider google)
   - `GET /callback` → `302` with `auth_event { action: "login" | "user_signedup", traits.provider: "google", actor: Matt Ryan }`
   So GoTrue exchanges the Google authorization code and creates the user/session every time.

3. **The smoking gun:** the GoTrue logs contain **no `POST /token` (grant_type=pkce) request** from the app. The app's `supabase.auth.exchangeCodeForSession(code)` errors **locally, before it ever makes the network call** — which is exactly what happens when the client cannot find the stored `code_verifier`.

4. **Live reproduction:** clicking "Continue with Google" on `https://ryan-realty.com/login` bounces to `https://ryan-realty.com/auth-error?message=Could%20not%20sign%20in` in under one second (after Google silently returns a code, because the account is already authorized). "Could not sign in" is the generic fall-through.

5. **Follow Up Boss check:** `GET /v1/people?email=matt.lists.homes@gmail.com` → **0 matches**. Confirms no FUB lead is created on Google sign-in today (the FUB sync lives **after** the failing exchange and never runs).

---

## Root cause (app-side)

- OAuth is initiated in a **server action**: [`app/actions/auth.ts`](../app/actions/auth.ts) `getSignInUrl()` (lines ~41–62) calls
  `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: \`${NEXT_PUBLIC_SITE_URL}/auth/callback\` } })`.
  With `@supabase/ssr@0.9.0` (PKCE is the default), this generates a `code_verifier` and is supposed to persist it as a cookie via the SSR client's `setAll` adapter.
- The callback [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) (line ~44) calls `exchangeCodeForSession(code)`, which **requires that `code_verifier` cookie**. It is absent → exchange fails → falls through to the generic redirect at line ~85.
- The SSR cookie adapter [`lib/supabase/server.ts`](../lib/supabase/server.ts) `setAll` (lines ~16–24) **swallows cookie-write errors** in a `try/catch` ("Ignore in Server Components"). So if the verifier write fails for any reason, it fails **silently** and you only see it later as a broken exchange.

**Net:** the `code_verifier` set when OAuth is initiated does not survive to the callback, even same-domain on `ryan-realty.com`.

### Secondary aggravator: Site URL vs app host mismatch
- Supabase **Site URL = `https://ryanrealty.vercel.app`** (still the old Vercel host).
- App **`NEXT_PUBLIC_SITE_URL` = `https://ryan-realty.com`** (prod).
- The primary bug fails even same-domain on `ryan-realty.com`, but this split would also cause **cross-domain `code_verifier` loss** for any user who lands on the `vercel.app` host (verifier cookie set on one domain, callback reads it on the other). Align both to the canonical `https://ryan-realty.com`.

---

## Suggested fix directions (evaluate, don't assume)

1. **First, capture the real error** (it's currently swallowed): temporarily log the `error` from `exchangeCodeForSession` in `app/auth/callback/route.ts`, deploy to a preview, run the flow, read the message (expect something like "code verifier could not be found" / "both auth code and code verifier should be non-empty"). Confirm the diagnosis before changing logic.
2. **Most robust pattern:** initiate OAuth on the **client** with `createBrowserClient().auth.signInWithOAuth(...)` so the `code_verifier` is written by the same cookie mechanism the server callback reads — OR keep server-action initiation but explicitly verify/round-trip the verifier cookie.
3. **Inspect the swallowed `setAll`** in `lib/supabase/server.ts`: confirm the verifier cookie is actually being written from the server-action context (Server Actions *can* set cookies; the silent catch hides failures). Ensure attributes `sameSite=lax`, `secure`, `path=/`.
4. **Align hosts:** set Supabase **Site URL** to `https://ryan-realty.com` and confirm `NEXT_PUBLIC_SITE_URL=https://ryan-realty.com`, so there is exactly one canonical host and no cross-domain cookie loss.

---

## How to verify the fix afterward

- Click "Continue with Google" on `https://ryan-realty.com/login` → should land **signed in** (redirect to `/` or `next` with `?signed_up=1`), **not** `/auth-error`.
- GoTrue auth logs (`get_logs` service `auth`, project `dwvlophlbvvygjfxcrhm`) should now show a `POST /token` (grant_type=pkce) `200`.
- A FUB person for the signing-in email should appear with a `Registration` event **"Signed in (Google)"** (see [`lib/followupboss.ts`](../lib/followupboss.ts) `trackSignedInUser`).

---

## Relevant files

- [`app/actions/auth.ts`](../app/actions/auth.ts) — `getSignInUrl()` initiates OAuth (server action), sets `redirectTo`.
- [`app/auth/callback/route.ts`](../app/auth/callback/route.ts) — the **active** callback; `exchangeCodeForSession` at ~line 44, generic "Could not sign in" fall-through at ~line 85.
- [`lib/supabase/server.ts`](../lib/supabase/server.ts) — SSR cookie adapter; `setAll` swallows write errors.
- [`components/auth/LoginForm.tsx`](../components/auth/LoginForm.tsx) — `handleOAuth` → calls the server action.
- [`app/api/auth/callback/route.ts`](../app/api/auth/callback/route.ts) — **duplicate/legacy** callback (NOT used by the flow; `redirectTo` targets `/auth/callback`). Consider deleting to avoid confusion.

## Same applies to Apple
Apple sign-in (button shown in `AuthModal`/`SignInPrompt`) would hit the **same** PKCE callback path, so fixing this also unblocks Apple once the Apple provider is enabled (Apple is currently disabled in Supabase and additionally needs Apple Developer setup — Services ID + signing key).
