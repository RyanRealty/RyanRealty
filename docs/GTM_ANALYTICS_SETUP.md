# GTM & GA4 — setup and dataLayer event reference

> **Browser events reach GA4 only through GTM's GA4 Event tag (2026-10-08).** The page never calls `gtag('event')`
> for GA4. The tag, its trigger and parameters: [`docs/GTM_GA4_BROWSER_EVENTS.md`](GTM_GA4_BROWSER_EVENTS.md).
> Where this older page says the app sends events with gtag, that stopped on 2026-08-18 (1224b1f).

This file absorbed `GTM_GA4_SETUP.md` and `GTM_TRIGGERS.md` (2026-04-24 governance merge).

---

## Setup (env vars, no UI required)

You only need to add IDs to **`.env.local`** (and Vercel env for production). The app loads everything in code. **No Google Tag Manager UI setup required.**

### What to add

| Product | Env var | Where to get the value | Required? |
|---------|---------|------------------------|-----------|
| **GA4** | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | [analytics.google.com](https://analytics.google.com) → Admin → Data streams → your web stream → **Measurement ID** (e.g. `G-ST40W4WM6T`) | Yes, for Analytics |
| **GTM** | `NEXT_PUBLIC_GTM_CONTAINER_ID` | [tagmanager.google.com](https://tagmanager.google.com) → your container → **Container ID** (e.g. `GTM-XXXXXXX`) | Optional |
| **AdSense** | `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | AdSense account → Account → **Settings** → **Account info** → **Publisher ID** (e.g. `ca-pub-XXXXXXXXXXXXXXXX`) | Optional |

### Example `.env.local`

```env
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-ST40W4WM6T
# Optional:
# NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-WV6R4NZ5
# NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-1234567890123456
```

### What the app does

- **GA4** — Loads the global site tag (gtag.js) and configures your measurement ID. Page views and default GA4 behavior work immediately.
- **GTM** — If you set the container ID, the GTM script is also loaded (for any tags you add in the GTM UI later). You can leave it unset if you only use GA4.
- **AdSense** — If you set the client ID, the AdSense script is loaded so you can show ad units where you place them in the site.

No steps in the Google Tag Manager or Analytics UIs are required. Just the env vars.

---

## Trigger / dataLayer event reference

Use this section to configure Google Tag Manager triggers and tags. All events are pushed to `window.dataLayer` from [lib/tracking.ts](lib/tracking.ts).

### Events

| dataLayer event | When to fire | Suggested GTM trigger | Use for |
|---|---|---|---|
| `listing_view` | User views a listing page | Custom Event = listing_view | GA4 view_item, Meta ViewContent |
| `search_view` | User views search/geo | Custom Event = search_view | GA4 view_search_results, Meta Search |
| `listing_click` | User clicks a listing tile | Custom Event = listing_click | GA4, Meta ViewContent |
| `saved_property` | User saves a listing | Custom Event = saved_property | GA4 generate_lead, Meta Lead |
| `sign_up` | User completes sign-up | Custom Event = sign_up | GA4, Meta CompleteRegistration |
| `view_item` | Ecommerce (with listing_view) | Same as listing_view | GA4 ecommerce |
| `view_search_results` | With search_view | Same as search_view | GA4 |
| `generate_lead` | With saved_property (method: save_listing) | Same as saved_property | GA4 |

### Custom dimensions (event parameters)

- `listing_key`, `listing_url`, `city`, `state`, `mls_number`, `value`, `currency`, `bedrooms`, `bathrooms` (listing_view, listing_click, saved_property)
- `search_term`, `subdivision`, `results_count` (search_view)
- `source_page` (listing_click)

### Trigger setup

1. Create a Custom Event trigger for each event name above (e.g. Event name equals `listing_view`).
2. Map dataLayer variables to GA4 dimensions or Meta parameters as needed.
3. For FUB identity bridge, use the same events to fire a tag that passes identity (e.g. from cookie or dataLayer) when present.
