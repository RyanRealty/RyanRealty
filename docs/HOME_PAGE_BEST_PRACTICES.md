# Home Page Best Practices (Ryan Realty)

Use this doc when designing or auditing the homepage. The agent should follow these without the user having to specify.

## Research-backed principles

- **Hero:** One clear message and one primary action. Visitors decide in ~8 seconds; focused hero sections correlate with much higher conversion. Avoid clutter.
- **Search as primary CTA:** Prominent, fast search (address, city, neighborhood, zip) above the fold. Most property searches start on mobile; search must be responsive and obvious.
- **Headline:** Answer "Who are you?" and "How can you help?" in under 10 seconds. Use location (Central Oregon) and outcome ("Find your place," "Search homes"). Avoid generic "Welcome."
- **Sections:** Clear hierarchy. Order: Hero → Featured listings (Homes for You) → Affordability → Trending → Communities → Recently Sold → Browse by city → Trust → Blog → Email signup. Consistent spacing (e.g. py-12 sm:py-16), max-width container (max-w-7xl).
- **CTAs:** Specific and action-oriented: "Search Central Oregon," "View all listings," "Browse [City]." Not vague "Submit" or "Contact."
- **Design system:** Use shadcn/ui tokens from globals.css (primary, accent, muted, etc.). Mobile-first, ample white space, no one-off colors.

## Hero heights (site-wide standard)

- **Home hero (video):** `min-h-[60vh]` — impactful but doesn't consume the entire screen.
- **Interior heroes (city, community, neighborhood):** `min-h-[40vh] sm:min-h-[50vh]` — enough for image + overlay text.
- **Content page heroes (about, buy, sell, team):** `min-h-[40vh] sm:min-h-[50vh]` — consistent with interior.
- **Header:** Solid `bg-primary`, sticky, does NOT overlay content. No glass/translucency.
- **No negative margins** on heroes; content flows naturally below the header.

## Structure (implement and maintain)

1. **Header (solid navy, sticky)**
   - Solid `bg-primary text-white`, no transparency.

2. **Hero (full-bleed)**
   - Background: video (home) or banner image or gradient (brand-navy).
   - Overlay for readability (gradient from-primary).
   - Headline (one line, bold).
   - Subline (one line).
   - Search bar (primary CTA).

3. **Content sections**
   - Each section: clear heading, consistent padding, container width.
   - Tiles: use lib/tile-constants (300px width in sliders, min-height, Share + Save where applicable).

4. **Footer area**
   - "Browse by city" with city tiles; "View all listings" CTA.

## Don't

- Use transparency or glass effects on the header.
- Use negative margins to pull content under the header.
- Use more than one primary CTA in the hero (search is the primary CTA).
- Add long paragraphs or multiple headlines in the hero.

When iterating, align with this doc.
