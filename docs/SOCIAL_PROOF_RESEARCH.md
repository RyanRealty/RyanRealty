# Social Proof Component: Research & Best Practices

**Purpose:** Ground the reusable social proof block (team photo + reviews) in psychology and UX research so it builds trust and looks professional across the site.

---

## 1. Psychology of Trust in Social Proof

### Cialdini’s principles that apply here

- **Social proof:** People infer “correct” behavior from what others do, especially when they’re uncertain. Testimonials are a direct use of this.
- **Similarity:** Proof is stronger when it comes from “people like me” (same situation, role, or concern). Real estate example: first-time buyers trust other first-time buyers’ stories.
- **Authority:** Credibility comes from expertise and recognition. Your team photo + real names + verified platforms (Google/Zillow) combine “real people” with “trusted channels.”

### What actually builds trust

- **Specificity beats vague praise.** “Sold our home faster than we expected” and “helped us from out of state” land better than “great experience.”
- **Real attribution:** Full names (and, when possible, photos) beat “Happy Customer.” For real estate, even first name + situation (“First-time buyer, Bend”) helps.
- **Third-party verification:** Google and Zillow badges/icons signal “real reviews, not hand-picked copy,” which supports trust more than unbranded quotes.

**Implication for your component:** Lead with outcome-specific quotes, show real names, and always pair quotes with a clear source (Google/Zillow). The team photo acts as the “authority” side; the reviews are the “people like you” side.

---

## 2. What Works When You Don’t Have Video

Research and benchmarks suggest:

- **Text testimonials with specifics** can still drive large conversion gains (e.g. “up to 90%” in some studies) when they include concrete outcomes, not generic praise.
- **Star ratings** give a fast, low-effort trust signal before someone reads the quote.
- **Volume cues** (“12+ reviews,” “4.9 on Google”) make each quote feel like part of a pattern, not a one-off.
- **Platform logos (Google, Zillow)** add perceived objectivity and verification.

So: **photo + short, specific quotes + stars + platform icons** is a strong, video-free combo. Your current direction (team photo + rotating reviews + stars + Google/Zillow) aligns with this.

---

## 3. Real Estate–Specific Best Practices

- **Trust is central.** Testimonials are both conversion and referral tools; they should feel genuine and specific.
- **Story beats generic praise.** Strong testimonials follow: (1) situation/fear, (2) what you did, (3) outcome (ideally with numbers or time), (4) who they are.
- **Diversity of situations** helps. First-time buyers, sellers, relocations, tough negotiations, repeat clients—different slices so visitors can find “someone like me.”
- **Placement:** Homepage + key landing pages + near CTAs. Reusing one component across the site (as you plan) fits this.

**Implication:** Curate and order reviews by “story type” (e.g. first-time buyer, seller, relocation) where possible, and prefer quotes that mention a clear outcome or situation.

---

## 4. Design Best Practices (Look & Feel)

- **Card layout:** One quote per card, with clear separation (shadow, border, padding). Makes each testimonial feel like a single, complete unit of proof.
- **Hierarchy:** Quote is primary (size/weight), then attribution (name), then source (platform). Stars and platform icon support at a glance.
- **Scannability:** Short sentences, 1–2 sentence quotes when possible; mix in a few longer ones for depth. Avoid walls of text.
- **Consistency:** Same card style, same treatment of stars/source across the site so the component is recognizable and professional.
- **Team photo:** Clean background (e.g. white/light) so a transparent PNG doesn’t look broken. Same height as the review column to avoid layout jump and to balance “team” and “reviews” visually.

---

## 5. Carousel / Rotation Behavior

- **Autoplay:** Many guidelines (including WCAG-oriented ones) advise against auto-advancing content because it can interrupt reading and cause motion issues. If you keep autoplay, offer a **pause/play** control and respect `prefers-reduced-motion` (e.g. no or minimal motion).
- **User control:** Letting people swipe or click to change testimonials increases engagement and makes the content feel “discovered,” which supports trust. So: visible “next/prev” and/or dots.
- **Volume signal:** Showing that there are multiple reviews (e.g. “1 of 12” or dots) reinforces that satisfaction is broad, not cherry-picked.
- **Accessibility:** Use a proper region label, `aria-live` if content changes automatically, and ensure keyboard focus and labels for controls.

**Recommendation:** Prefer **user-driven** advance (buttons/dots) as the main interaction; autoplay only as an optional enhancement with pause and reduced-motion support.

---

## 6. Checklist for Your Reusable Component

Use this when building or refining the block:

**Content & psychology**
- [ ] Prefer outcome-specific or situation-specific quotes over generic praise.
- [ ] Show full name (or first name + context) for attribution.
- [ ] Always show source (Google / Zillow) with platform icon.
- [ ] Star rating visible on each card.
- [ ] Optional: aggregate line (“4.9 on Google · 50+ reviews”) near the component.

**Design**
- [ ] Card-based layout: one quote per card, consistent padding and borders.
- [ ] Team photo on a light/white background, same height as review column.
- [ ] Clear hierarchy: quote → name → source; stars and icon support at a glance.
- [ ] All styling from design tokens (no hardcoded colors).

**Interaction & accessibility**
- [ ] Pause/play if the carousel auto-advances.
- [ ] Next/previous and/or dots so users can browse themselves.
- [ ] Respect `prefers-reduced-motion` (no or minimal motion when set).
- [ ] Region and controls labeled for screen readers; no auto-advance that traps focus.

**Reuse**
- [ ] Same component and styling on homepage, landing pages, and near CTAs so the block is recognizable and consistent.

---

## 7. Summary: How to Make It Look Good and Build Trust

1. **Pair “authority” (team photo) with “social proof” (reviews)** in one block so visitors see both “who we are” and “what others say.”
2. **Use specific, story-like quotes** and real names; add Google/Zillow icons so it feels verified.
3. **Keep layout stable:** same height for photo and reviews, light background for the team image, card-based quotes.
4. **Prioritize user control:** buttons/dots to change reviews; autoplay only with pause and reduced-motion handling.
5. **Stick to your UI system:** tokens, shadcn components, and one consistent design so the block feels polished and on-brand everywhere it’s reused.

This gives you a research-backed, accessible, and reusable social proof component that works even without video.
