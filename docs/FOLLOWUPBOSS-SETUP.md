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
