# Google Maps — Cloud style + 3D (Ryan Realty)

**Purpose:** Make inventory maps feel brand-true (cream/sand basemap, navy pins loud) and enable photorealistic 3D lot views on listing pages.

## 1. Cloud Map ID (search basemap)

We already dual-path in `components/SearchMapClustered.tsx`:

| Env | Behavior |
|-----|----------|
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` **set** | Vector map + Advanced Markers; basemap from **Cloud Console style** |
| **unset** | Raster map + editorial `MAP_SEARCH_STYLES` in `lib/maps/markers.ts` + OverlayView pills |

### Matt / ops steps (one-time)

1. [Google Cloud Console](https://console.cloud.google.com/) → project that owns the Maps JS key.
2. **Map Management** → **Map IDs** → Create Map ID  
   - Type: **JavaScript**  
   - Map type: **Vector** (required for Advanced Markers)
3. **Map Styles** → Create style (or use JSON import):
   - Water: soft blue-grey / sand-adjacent  
   - Landscape: cream/sand  
   - Roads: white/light, low-contrast labels  
   - Labels: navy `#102742`  
   - POI / transit: off or minimal  
4. Attach the style to the Map ID.
5. Set in Vercel (Production + Preview) and `.env.local`:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your_map_id_here
```

6. Redeploy. No code change required — search map picks up vector + Advanced Markers automatically.

### Enable APIs (billing project)

- Maps JavaScript API  
- Places API (search placeQuery / suggest)  
- For §2 3D: **Map Tiles API** (Photorealistic 3D) if using raw tiles; **Maps JavaScript API** covers `maps3d` Map3DElement when enabled for the project

## 2. Photorealistic 3D lot view (listing pages)

Component: `components/site/listing-detail/ListingLot3D.client.tsx`

Uses experimental/preview `google.maps.importLibrary('maps3d')` → `Map3DElement` centered on the listing lat/lng with tilt/range so the buyer can orbit the lot when Google has coverage.

**Honest limits:**

- Coverage is city/metro mesh, **not** a custom interior 3D model of the house.
- Bend / Central Oregon coverage varies by block; if tiles fail, UI falls back to the 2D location map (no broken iframe).
- Spinning a true “home model on a lot” would need MLS/3D tour assets (Matterport) or generated mesh — separate from Google tiles.

## 3. What we ship in product code (no Console)

- Editorial raster basemap styles (above) when Map ID is absent  
- Pin select ↔ list card select + scroll  
- Zoom storytelling: clusters → price pills → photo stamps  
- Calm map-view count copy  
- Optional 3D lot panel on listing detail when lat/lng present  
