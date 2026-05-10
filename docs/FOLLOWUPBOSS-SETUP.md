# FollowUp Boss integration

When someone signs in with **Google** on your site, the app looks them up in Follow Up Boss by email and sends a **Registration** event so they’re created (or updated) and tracked as coming from your website. While they’re signed in, we also send **Viewed Property** (each listing they open) and **Viewed Page** (city/community search pages) so you can see what they’re looking at in FUB.

## Testing the integration

1. Sign in with Google (click **Sign in** in the header). If you’re already signed in, your session is kept; sign out first if you want to see the Google prompt again.
2. After sign-in you should see “Welcome, [Name]” and your avatar in the header.
3. In Follow Up Boss, check for a new (or updated) person with your email and a **Registration** event.
4. Browse listing and city/community search pages while signed in; in FUB you should see **Viewed Property** and **Viewed Page** events for that person.

Your session is stored in a cookie and kept across visits (Supabase refresh token), so when you return you stay signed in and we keep sending activity to FUB until you sign out.

## What you need to provide

### 1. Follow Up Boss API key (required)

- In Follow Up Boss: **Admin → API**
- Copy your **API key**
- In `.env.local` add:
  ```bash
  FOLLOWUPBOSS_API_KEY=your_api_key_here
  ```
- The app uses it as HTTP Basic auth (username = API key, password empty), as required by the FUB API.

### 2. System registration (optional but recommended)

If you’re integrating your own site (not building a product for other FUB customers), you can still register so your requests are identified:

1. Go to **https://apps.followupboss.com/system-registration**
2. Register your system (e.g. name: `Ryan Realty Website`)
3. You’ll get **X-System** and **X-System-Key**
4. In `.env.local` add:
   ```bash
   FOLLOWUPBOSS_SYSTEM=Ryan Realty Website
   FOLLOWUPBOSS_SYSTEM_KEY=the_key_they_give_you
   ```

If these are not set, the app still works; it just won’t send the system headers.

### 3. Lead source in Follow Up Boss

- **Source** sent with each event is your site domain (from `NEXT_PUBLIC_SITE_URL`), e.g. `ryan-realty.com` (no `www`, no `https://`).
- In Follow Up Boss, ensure you have a **lead source** that matches that domain (or create one) so these sign-ins are attributed to “Website” or “Ryan Realty Website” as you prefer.

## What happens when someone signs in with Google

1. User completes Google OAuth and lands back on your site.
2. The auth callback runs and calls Follow Up Boss:
   - **Search** by email: `GET /v1/people?email=...`
   - **Send event**: `POST /v1/events` with type `Registration`, the person (matched by email or new), `source` = your domain, `system` = `Ryan Realty Website`.
3. If the person already exists in FUB, the event is attached to that contact (no duplicate). If not, a new person is created and your Registration automations run.

No custom code is required on your side beyond setting the env vars above. The integration is implemented in:

- `lib/followupboss.ts` – API client (find by email, send event)
- `app/auth/callback/route.ts` – after Google sign-in, calls `trackSignedInUser(...)`

## Return visit event

When a signed-in user returns after **24+ hours** (cookie-based), the site sends a **Visited Website** event with `message: "return"` so you can tag or segment return traffic in FUB.

- **Event type:** `Visited Website`
- **Message:** `return`
- You can create a FUB tag (e.g. `return`) or automation based on this event. Tag names and custom field IDs are configured in FUB; the app sends a generic `message: "return"` so you can map it there.

## Event types and tags (reference)

| App action        | FUB event type     | Notes / suggested tag   |
|-------------------|--------------------|--------------------------|
| Sign in (Google)  | Registration       | `signed_in`             |
| View listing      | Viewed Property    | `listing_view`          |
| View search/place | Viewed Page        | `search_view`           |
| Save listing      | Saved Property     | `saved_property`        |
| Property inquiry  | Property Inquiry   | `inquiry`               |
| Return (24h+)     | Visited Website    | `return` (message sent) |

Configure tags and custom fields in FUB Admin; the app sends the event type and optional `message` only.

## Real-time task alerts (Matt app notifications)

To make website re-activation harder to miss in the FUB app, high-intent events now create near-term call tasks:

- return visit (`Visited Website` with message `return`) → call task due in ~10 minutes
- listing detail view via tracked page endpoint → call task due in ~5 minutes
- seller intent page activity → call task due in ~5 minutes
- buyer intent page activity → call task due in ~10 minutes

Environment controls:

```bash
# default true; set to false to disable "Matt alert" notes
FOLLOWUPBOSS_REALTIME_ACTIVITY_ALERTS=true

# default true; set to false to disable auto-created follow-up tasks
FOLLOWUPBOSS_REALTIME_ACTIVITY_TASKS=true

# optional fallback assignee when contact has no assignedUserId in FUB
FOLLOWUPBOSS_DEFAULT_ASSIGNED_USER_ID=1234
```

## Contact enrichment workflow (name cleanup + profile build)

Use the enrichment runner to process FUB contacts, normalize name fields, and build ownership/profile context from Supabase listings.

### Dry run (recommended first)

```bash
node --env-file=.env.local scripts/fub-enrich-contacts.mjs --limit 300
```

Or with npm script:

```bash
npm run fub:enrich -- --limit 300
```

This creates a JSON report under `out/fub-contact-enrichment/` with:

- suggested first/last name fixes
- owned-home and mailing-address extraction from FUB fields
- Supabase ownership lookup (close date, close price, estimated years owned) when address match is found
- public research links (Facebook search + public-records searches) for manual review

### Apply safe updates to FUB

```bash
node --env-file=.env.local scripts/fub-enrich-contacts.mjs --limit 300 --apply
```

Safe updates currently include:

- filling missing `firstName` / `lastName` when parseable from full name
- skipping auto-name updates for likely entities (trusts, LLCs, estates, etc.)
- deferring ambiguous or recently active contacts to manual review in report output
- populating owned-home profile fields when available (`customOpenHouseAddress`, purchase fields, MLS when derivable)
- merging home and mailing data into FUB `addresses` without overwriting richer existing address values

To also attach a profile snapshot note to each contact:

```bash
node --env-file=.env.local scripts/fub-enrich-contacts.mjs --limit 300 --apply --write-notes
```

### Single-contact repair

```bash
node --env-file=.env.local scripts/fub-enrich-contacts.mjs --person-id 12345 --apply --write-notes
```
