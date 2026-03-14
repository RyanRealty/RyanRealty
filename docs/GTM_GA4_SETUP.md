# Google Analytics, Tag Manager & AdSense — env only (no UI setup)

You only need to add IDs to **`.env.local`** (and Vercel env for production). The app loads everything in code. **No Google Tag Manager UI setup required.**

## What to add

| Product   | Env var | Where to get the value | Required? |
|-----------|---------|------------------------|-----------|
| **GA4**   | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | [analytics.google.com](https://analytics.google.com) → Admin → Data streams → your web stream → **Measurement ID** (e.g. `G-ST40W4WM6T`) | Yes, for Analytics |
| **GTM**   | `NEXT_PUBLIC_GTM_CONTAINER_ID`   | [tagmanager.google.com](https://tagmanager.google.com) → your container → **Container ID** (e.g. `GTM-XXXXXXX`) | Optional |
| **AdSense** | `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | AdSense account → Account → **Settings** → **Account info** → **Publisher ID** (e.g. `ca-pub-XXXXXXXXXXXXXXXX`) | Optional |

## Example `.env.local`

```env
NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-ST40W4WM6T
# Optional:
# NEXT_PUBLIC_GTM_CONTAINER_ID=GTM-WV6R4NZ5
# NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-1234567890123456
```

## What the app does

- **GA4** — Loads the global site tag (gtag.js) and configures your measurement ID. Page views and default GA4 behavior work immediately.
- **GTM** — If you set the container ID, the GTM script is also loaded (for any tags you add in the GTM UI later). You can leave it unset if you only use GA4.
- **AdSense** — If you set the client ID, the AdSense script is loaded so you can show ad units where you place them in the site.

No steps in the Google Tag Manager or Analytics UIs are required. Just the env vars.
