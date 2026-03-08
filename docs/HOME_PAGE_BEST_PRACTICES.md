# Home Page Best Practices (Ryan Realty)

Use this doc when designing or auditing the homepage. The agent should follow these without the user having to specify.

## Research-backed principles

- **Hero:** One clear message and one primary action. Visitors decide in ~8 seconds; focused hero sections correlate with much higher conversion. Avoid clutter.
- **Search as primary CTA:** Prominent, fast search (address, city, neighborhood, zip) above the fold. Most property searches start on mobile; search must be responsive and obvious.
- **Headline:** Answer “Who are you?” and “How can you help?” in under 10 seconds. Use location (Central Oregon) and outcome (“Find your place,” “Search homes”). Avoid generic “Welcome.”
- **Trust:** One line of proof below the hero (e.g. “X homes for sale in [City] and surrounding areas”) with a clear “Browse all” or “View listings” link. Optional: social proof, awards, response time later.
- **Map:** Valuable but secondary. Don’t compete with the hero. Use a collapsible “Explore on map” section below the hero so the first screen is headline + search only.
- **Sections:** Clear hierarchy. Order: Hero → Featured listings (Homes for You) → Affordability → Trending → Communities → Recently Viewed / Suggestions → Browse by city. Consistent spacing (e.g. py-12 sm:py-16), max-width container (max-w-7xl), alternating subtle backgrounds (e.g. zinc-50 for Browse by city) for scanability.
- **CTAs:** Specific and action-oriented: “Search Central Oregon,” “View all listings,” “Browse [City],” “Explore on map.” Not vague “Submit” or “Contact.”
- **Design system:** Use tokens from globals.css (brand-navy, accent, surfaces, spacing). Mobile-first, ample white space, no one-off colors.

## Structure (implement and maintain)

1. **Hero (full-bleed)**  
   - Background: place banner image or gradient (brand-navy).  
   - Overlay for readability (e.g. dark overlay).  
   - Headline (one line, bold).  
   - Subline (one line).  
   - Search bar (primary CTA).  
   - Trust line + “Browse all” / “View listings” link.  
   - Attribution if using stock/third-party image.

2. **Below hero**  
   - Collapsible “Explore on map” block (Show map / Hide map). No “Banner vs Map” toggle above the hero.

3. **Content sections**  
   - Each section: clear heading, consistent padding, container width.  
   - Tiles: use lib/tile-constants (300px width in sliders, min-height, Share + Save where applicable).

4. **Footer area**  
   - “Browse by city” with city tiles; “View all listings” CTA.

## Don’t

- Put a view toggle (Banner vs Map) above the hero.  
- Use more than one primary CTA in the hero (search is the primary CTA).  
- Add long paragraphs or multiple headlines in the hero.  
- Skip the trust line; at least one concrete number (listings count) + link.

When iterating, run the home-page items in GOALS_AND_UI_AUDIT.md and align with this doc.
