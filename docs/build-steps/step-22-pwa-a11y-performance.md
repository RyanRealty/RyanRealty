# Build Step 22: PWA, Accessibility & Performance Optimization

Scope: Mobile, responsive layout, PWA, accessibility, performance, UX standards.

## PART A: PROGRESSIVE WEB APP

### TASK 1: PWA Configuration
Install next-pwa or serwist:
```bash
npm install @serwist/next
```

Create public/manifest.json:
```json
{
  "name": "Ryan Realty — Central Oregon Real Estate",
  "short_name": "Ryan Realty",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#102742",
  "theme_color": "#102742",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Create placeholder icon files in public/icons/ (replace with real logos later).

Link manifest in root layout <head>.

### TASK 2: Service Worker
Configure the service worker with caching strategies:
- Static assets (JS, CSS, fonts, images): Cache-first with 30-day expiry
- API responses (listing data, search results): Stale-while-revalidate with 5-minute expiry
- HTML pages: Network-first with cache fallback
- Cache the homepage, search page shell, and last 10 viewed listing pages for offline access

### TASK 3: Offline Support
Create src/app/offline/page.tsx:
- Shown when user is offline and the requested page is not cached
- Friendly message: "You're offline. Here's what we have cached:"
- List of cached/recently viewed listing pages
- "Try again" button that checks navigator.onLine

### TASK 4: Install Prompt
Create src/components/pwa/InstallPrompt.tsx (client component):
- Listen for 'beforeinstallprompt' event
- Show non-intrusive banner after 2 visits or 30+ seconds on site
- "Add Ryan Realty to your home screen for the fastest experience"
- "Install" button and "Not now" dismiss
- If dismissed: never show again (store in cookie)
- Only show on mobile devices

### TASK 5: Push Notifications Setup
Create src/lib/push-notifications.ts:
- Generate VAPID keys (store NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in env)
- Function: subscribeToPush() — requests notification permission, subscribes to push, stores subscription in Supabase push_subscriptions table
- Function: sendPush(subscription, payload) — sends push via web-push library

Create the push_subscriptions table migration:
```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

Prompt users to enable push after they save their first listing or create a saved search.

## PART B: ACCESSIBILITY (WCAG 2.1 AA)

### TASK 6: Skip Navigation
Add to root layout, as the FIRST focusable element:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white focus:text-navy">
  Skip to main content
</a>
```
Add id="main-content" to the <main> element.

### TASK 7: ARIA & Keyboard Audit
Review and update ALL components for accessibility:

Header/Navigation:
- Nav element with aria-label="Main navigation"
- Mobile menu: aria-expanded on hamburger button, focus trap inside menu when open
- Dropdown menus: arrow key navigation, Escape to close

ListingCard:
- Entire card wrapped in <a> with descriptive aria-label: "[beds] bed, [baths] bath home at [address] for $[price]"
- Save button: aria-label="Save this listing" / "Unsaved this listing", aria-pressed state
- Image: meaningful alt text: "Photo of [address] — [beds] bed, [baths] bath home"

Modal:
- role="dialog", aria-modal="true", aria-labelledby pointing to title
- Focus trap: Tab cycles within modal, Escape closes
- On close: focus returns to trigger element

Forms:
- Every input has an associated <label> (floating labels must also have aria-label or visible label)
- Required fields: aria-required="true"
- Error messages: aria-describedby linking input to error text
- Error announced: aria-live="polite" on error container

Maps:
- Provide alt text describing the map content
- Map controls accessible via keyboard
- Listing information available outside the map (in the list view)

Charts:
- aria-label on chart containers describing the data
- Provide data table alternative for screen readers (visually hidden, accessible)

Search filters:
- All filter controls keyboard accessible
- Button groups: role="group" with aria-label
- Slider: aria-valuemin, aria-valuemax, aria-valuenow, aria-label

### TASK 8: Color Contrast Check
Verify all text/background combinations meet 4.5:1 ratio:
- Navy #102742 on white: passes ✅
- Navy #102742 on cream #F0EEEC: check and verify ✅
- White on navy: passes ✅
- Accent #D4A853 on navy: check — if fails, use white text on accent buttons
- Accent #D4A853 on white: likely fails for text — never use accent as text color on light backgrounds
- Error red #EF4444 on white: check and verify

### TASK 9: Reduced Motion
Create a utility or Tailwind variant:
- All animations respect prefers-reduced-motion
- Ken Burns hero effect: disabled
- Card hover transitions: reduced to simple opacity change
- Skeleton pulse: reduced to static gray
- Page transitions: instant instead of animated

## PART C: PERFORMANCE

### TASK 10: Image Optimization Audit
Verify all images use Next.js <Image> component with:
- Correct sizes prop for responsive loading
- priority={true} on above-fold hero images only
- placeholder="blur" with blurDataURL on listing photos
- Loading="lazy" on all below-fold images (default)
- formats: ['image/avif', 'image/webp'] in next.config.js

### TASK 11: Code Splitting & Bundle Optimization
- Verify all heavy components are dynamically imported with next/dynamic:
  - Google Maps components: dynamic(() => import('./SearchMap'), { ssr: false })
  - Chart components: dynamic(() => import('./MedianPriceChart'), { ssr: false })
  - Video player: dynamic(() => import('./VideoPlayer'), { ssr: false })
  - PDF generation (client-side trigger only)
- Verify no unnecessary client-side JavaScript on server components
- Check bundle size with: npm run build && npx @next/bundle-analyzer

### TASK 12: Database Query Optimization
- Verify all Supabase queries use .select() with only needed columns (never select *)
- Verify indexes exist for all WHERE and ORDER BY columns
- Verify the search API uses compound indexes for common filter combinations
- Add query timing logs in development mode

### TASK 13: Caching Strategy Verification
Verify ISR revalidation times:
- Listing pages: revalidate = 60 (1 minute)
- Community pages: revalidate = 300 (5 minutes)
- City pages: revalidate = 300 (5 minutes)
- Blog posts: revalidate = 3600 (1 hour)
- Reports: revalidate = 3600 (1 hour)
- Homepage: revalidate = 60 (1 minute)

### TASK 14: Core Web Vitals Targets
Verify with Lighthouse (npm run build, then serve):
- LCP < 2.5s on all pages (hero images must be optimized and preloaded)
- FID < 100ms (no long JavaScript tasks blocking main thread)
- CLS < 0.1 (all images have width/height, no layout shifts from loading content)
- Run Lighthouse on: homepage, listing detail, search, community page, blog post

TypeScript strict. No any types.
