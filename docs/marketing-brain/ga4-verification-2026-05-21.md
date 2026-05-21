# GA4 End-to-End Verification — 2026-05-21

This is the verification protocol for the GA4 admin config + server-side mirror + comprehensive analytics dashboard delivered today. It covers what is **verified live**, what is **architecturally verified** (code paths confirmed; one external dependency blocks live verification), and the exact steps to close every remaining gap.

## What is verified live

### Phase 1 — GA4 Admin API audit

`node scripts/ga4-admin.mjs audit` runs successfully against property `527333348` and writes `out/ga4-audit.json`. The output enumerates current state and the gap vs the locked spec:

- 8 conversion events present (3 of 7 from spec); 5 missing
- 12 custom dimensions present (4 of 10 from spec); 6 missing
- 10 audiences present (0 of 5 from spec); 5 missing

The script is idempotent and re-runnable.

### Phase 3 — Comprehensive dashboard

- `npm run build` passes (Next.js 16.1.6 Turbopack, TypeScript strict mode).
- `npm test` passes — 401 / 401 tests.
- `curl -I http://localhost:3000/admin/analytics` returns HTTP 200.
- Dashboard route is registered: `ƒ /admin/analytics` in the build output.

## What is architecturally verified (live verification blocked by env)

### Phase 1 — GA4 Admin API apply

The `apply` mode runs but every WRITE returns "The caller does not have permission". This is **expected** until Matt elevates the service account role.

- Service account `viewer@ryanrealty.iam.gserviceaccount.com` currently has **Analyst** role on the property.
- **Editor** is required to create conversion events, custom dimensions, and audiences via the API.
- Manual step: Matt opens GA4 → Admin → Property access management → finds the SA → changes role from Analyst to **Editor** → saves.
- Then re-run `node scripts/ga4-admin.mjs apply`. The script will skip the 6 already-existing items and create the 16 missing items.

Filter syntax for the 5 new audiences has been verified against the real GA4 alpha schema by inspecting an existing audience on the property (`Lead Form Starters`). The nested `andGroup → filterExpressions → orGroup → filterExpressions → eventFilter` shape is correct.

### Phase 2 — Server-side event mirror

The `GA4_API_SECRET` env var is currently empty in `.env.local`. The library `lib/ga4-measurement-protocol.ts` checks for both `GA4_API_SECRET` and `GA4_MEASUREMENT_ID` (or the public equivalent) at fire time. When the secret is missing, every `fireGa4Event` call logs `[ga4-mp] skipping fire — GA4_API_SECRET or GA4_MEASUREMENT_ID not configured` and returns `{ ok: false, error: 'GA4_API_SECRET_MISSING' }`. No upstream action breaks.

The four wired call sites all compile and pass build:

1. `app/lp/seller-home-value/actions.ts` — fires `generate_lead` after FUB + CMA + Meta CAPI succeed. Pulls GA4 client_id from `_ga` cookie. Carries lp_variant, lp_source, lp_medium, lp_campaign, lp_content, broker_slug, lead_classification, lead_type, value, currency, event_id.
2. `lib/cma-request.ts` — fires `valuation_requested` immediately after the `cmas` row + brain action row land. Carries cma_slug, lp_variant, broker_slug, lead_classification, lead_type, subject_city, subject_state. User property: assigned_broker, lead_status=cma-draft.
3. `app/actions/fub-identity-bridge.ts` — fires `fub_person_created` after the cookie is set. Carries fub_person_id, source=email-click.
4. `app/api/meta/leadgen/route.ts` — fires `generate_lead` from the Meta Lead Ad webhook. Carries lp_variant=meta-leadgen-form, lp_source=facebook, lp_medium=paid_social, lp_campaign, lp_content (ad set name), lead_classification, lead_type, fub_person_id, meta_lead_id, possible_realtor.

To verify live, Matt needs to:

1. **Generate the API secret** in GA4 Admin → Data Streams → (web stream G-ST40W4WM6T) → Measurement Protocol API secrets → Create new. Copy the secret value.
2. **Add to `.env.local`**: `GA4_API_SECRET=<the value>`.
3. **Add to Vercel** (production env): same env var in the Vercel project settings.
4. **Submit a test lead** at `/lp/seller-home-value` (or use a synthetic curl that hits the server action).
5. **Watch GA4 DebugView** in real time: the `generate_lead` event should appear with all the event params and user properties listed above.

## Step-by-step live verification once Matt completes the setup

```bash
# 1. Verify the secret is loaded
grep "^GA4_API_SECRET=" .env.local | grep -v "GA4_API_SECRET=$"

# 2. Open the seller LP and submit a dummy lead
open https://ryanrealty.vercel.app/lp/seller-home-value
# Fill: 123 Test Lane Bend OR 97701 / Test Test / test+ga4-verify@ryan-realty.com / 5555550100 / "Ready now"

# 3. Watch the dev server logs
# Expect:
#   [seller-lp] ...   ← upstream success messages
#   (no [ga4-mp] warnings — fire succeeded)

# 4. Open GA4 DebugView
open "https://analytics.google.com/analytics/web/#/p527333348/realtime/debugview"
# Expect within ~5 seconds:
#   - Event "generate_lead" with all 13 event params + 1 user property
#   - The same client_id as the browser session

# 5. Verify the database side
psql <SUPABASE_URL> -c "
  SELECT broker, tier, created_at FROM marketing_assignments
   WHERE audience='seller' ORDER BY created_at DESC LIMIT 1;
  SELECT slug, status, client_email FROM cmas
   WHERE client_email='test+ga4-verify@ryan-realty.com' ORDER BY created_at DESC LIMIT 1;
"

# 6. Open /admin/analytics in a logged-in superuser session
open https://ryanrealty.vercel.app/admin/analytics
# Expect:
#   - Overview tab: sessions, users, leads populate
#   - Funnel tab: 7 steps render; step 5 (generate_lead) shows the test lead;
#                 steps 6-7 (FUB / CMA) show the new row counts
#   - Conversions tab: brokerSplit, classificationMix show the test row
```

## What to do if a step fails

| Symptom | Diagnosis | Fix |
|---|---|---|
| `[ga4-mp] skipping fire — GA4_API_SECRET ... not configured` in server logs | Env var missing | Add `GA4_API_SECRET` to `.env.local` and Vercel env |
| `[ga4-mp] non-2xx for generate_lead (HTTP 401)` | Secret wrong | Regenerate in GA4 admin, paste the new value |
| Event appears in DebugView but not in standard reports for 24+ hours | Cardinality limit or custom dimension not registered | Run `node scripts/ga4-admin.mjs apply` (after granting Editor) so the params show up as custom dimensions |
| Funnel step 5 count is 0 but step 4 is non-zero | `generate_lead` event fires only on real form submission, not on form_start | Check `lib/tracking.ts` `trackGenerateLead()` is called in form `onSubmit` handler |
| Dashboard Overview tab shows "no data" for 30 days | GA4 service-account read-only access broken | Check `getGA4Summary` directly: `curl http://localhost:3000/api/...` or call from a quick node script |

## Decisions skipped per the brief

- **Google Signals enrollment** — privacy-policy gate, deliberately deferred.
- **Cross-domain linker** (`ryan-realty.com` WordPress ↔ `ryanrealty.vercel.app`) — Phase 5, separate DNS / header work.
- **Per-broker (Paul / Rebecca) views on the analytics dashboard** — v2.
