# Google Maps Setup

The site uses **Google Maps** (via `@react-google-maps/api`) for all map views. You need `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` and in your deployment environment.

---

## Previously (Mapbox)

The site previously used **Mapbox** (via `react-map-gl`) for:

- **Listing detail page** – `components/listing/ListingDetailMap.tsx` (single listing + nearby listings)
- **Listings / search map** – `components/ListingMap.tsx` (clustered pins for many listings)

To use **Google Maps** instead, follow these steps.

---

## 1. Get a Google Maps API key

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create or select a project.
3. Go to **APIs & Services → Library**. Search for **Maps JavaScript API** and **Enable** it. (For geocoding, also enable **Geocoding API** if you use it.)
4. Go to **APIs & Services → Credentials**. Click **Create credentials → API key**.
5. Restrict the key (recommended): under **Application restrictions** choose **HTTP referrers** and add your domains (e.g. `https://ryan-realty.com/*`, `http://localhost:3000/*`). Under **API restrictions** limit to **Maps JavaScript API** (and Geocoding API if needed).
6. Copy the API key.

---

## 2. Add the API key to your env

In `.env.local` (and in Vercel/env for production), add:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

Do **not** commit the key; keep it in `.env.local` and in your host’s environment variables.

---

## 3. Install the Google Maps React library

```bash
npm install @react-google-maps/api
```

---

## 4. Replace the map components

### Option A (implemented)

- **Listing detail map:** `components/listing/ListingDetailMapGoogle.tsx` – used in `app/listing/[listingKey]/page.tsx`.
- **Listings map (home, search, listings):** `components/ListingMapGoogle.tsx` – used in `app/page.tsx`, `app/listings/page.tsx`, `app/search/[...slug]/page.tsx`.
- **Full map view:** `app/listings/MapListingsPage.tsx` – uses Google Maps when you go to `/listings?view=map`.

All of these read `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` from the environment.

### Option B: Customize the components

**Listing detail map (single listing + others):**

- Use `@react-google-maps/api`: `useJsApiLoader`, `GoogleMap`, `Marker`, `InfoWindow`.
- Center the map on `subjectListing` or fit bounds to include `subjectListing` and `otherListings`.
- Render one marker for the subject listing (e.g. different icon or label “This listing”) and markers for `otherListings` with link/price.

**Listings map (many pins):**

- Load the Maps JavaScript API with your key.
- For many points, you can use the same `GoogleMap` + `Marker` (or a clustering library like `@googlemaps/markerclusterer`).
- Fit bounds to `listings` or use `initialCenter` when there are no listings.

---

## 5. Remove Mapbox

After Google Maps is working:

1. In `app/listing/[listingKey]/page.tsx` and any page using the main map, change imports from `ListingDetailMap` / `ListingMap` to the Google versions.
2. Uninstall Mapbox:

   ```bash
   npm uninstall react-map-gl mapbox-gl
   ```

3. Remove `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` from `.env.local` and from your deployment environment.

---

## 6. Geocoding (Google)

- **Server-side geocoding:** `app/actions/geocode.ts` – `getGeocodedListings()` uses the **Google Geocoding API** to fill missing `Latitude`/`Longitude` on listings. It uses the same `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Enable **Geocoding API** in your Google Cloud project (APIs & Services → Library → "Geocoding API" → Enable). No Mapbox dependency remains.
