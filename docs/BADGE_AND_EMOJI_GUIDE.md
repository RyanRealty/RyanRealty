# Badge Colors & Emojis — Psychology and Implementation

This doc defines the **color palette for tile badges** and **when and how to use emojis** to drive engagement (views, shares, saves) while staying on-brand for a luxury real estate platform.

---

## 1. Color psychology for badges

### How color affects behavior

- **Pre-cognitive:** People form opinions in ~90 seconds; a large share of that is color. Colors set expectations (trust, urgency, quality) before users read copy.
- **Warm (red, orange, amber):** Attention, urgency, speed, FOMO. Red CTAs can lift clicks; warm badges signal “act now” or “popular.”
- **Cool (blue, green):** Trust, calm, safety. Green = go, positive, success; blue/navy = reliability, professionalism.
- **Neutral (white, gray, dark overlay):** Informational, doesn’t compete with status. Good for secondary info (e.g. “X days on market,” media types).

For **tiles** we want: status badges (Hot, New, Price reduced, Resort, Open house) to use a **consistent semantic palette** so users learn the language quickly and feel confident. All badge colors must come from **design tokens** in `app/globals.css` (no one-off hex values).

---

## 2. Badge color semantics (design tokens)

| Meaning | Token | Use for | Psychology |
|--------|--------|---------|------------|
| **Urgency / attention** | `--urgent` (#EF4444) | Hot, Open house, Fire (like count) | Red = act now, FOMO, “don’t miss it.” |
| **New / success / positive** | `--success` (#22C55E) | New listing (0 days on market) | Green = fresh, go, safe, “good find.” |
| **Deal / notice** | `--warning` (#F59E0B) | Price reduced | Amber = “notice this,” value, change. |
| **Premium / special** | `--accent` (gold) or `--brand-navy` | Resort, Featured | Gold = luxury, navy = trust; both fit premium. |
| **Final / sold** | `--brand-navy` | Sold, Pending (optional) | Navy = finality, trust, not flashy. |
| **Informational** | White/95 + dark text, or `--color-border-navy-light` + navy | “X days on market,” media (Video, Tour, Floor plan) | Neutral so status badges stand out. |
| **Media / utility** | `black/70` or `black/50` | Video, Virtual tour, Floor plan | Stays secondary; doesn’t compete with status. |

**Rules:**

- One **primary** status per tile when possible (e.g. Hot *or* New *or* Price reduced), so the eye isn’t split.
- Order by **priority**: Urgency first (Hot, Open house), then New, then Deal (Price reduced), then Premium (Resort), then DOM, then media.
- All badge backgrounds and text colors must use CSS variables from `globals.css` so we can change the system in one place.

---

## 3. Emoji psychology and engagement

### Why emojis work

- **Speed:** The brain processes images in ~13ms; emojis act as quick meaning anchors.
- **Emotion:** They work like “paralanguage”—adding tone and intent, especially on mobile.
- **Engagement:** Posts with 1–3 strategic emojis can see meaningfully higher engagement (e.g. +25% in some studies); fire, heart, and star are often top performers.
- **Sharing:** Emotional resonance and clarity (“this is hot / new / a deal”) make content more shareable.

### How to use emojis on tiles

- **Placement:** Use as a **single visual anchor at the start of the label** (e.g. `🔥 Hot`, `✨ New`), not scattered. Same spot across all tiles = consistency and scannability.
- **Count:** 1 emoji per badge, and only on **primary status badges** (Hot, New, Open house, Price reduced, Resort). Don’t add emojis to DOM or media badges to avoid clutter.
- **Tone:** Luxury = restrained. One clear emoji per badge is enough; avoid stacking multiple emojis on one tile.
- **Accessibility:** Always keep the **text label** (e.g. “Hot,” “New”). Emoji supports the message; it doesn’t replace it. Use `aria-hidden` on the emoji so screen readers get the text only.

### Recommended emoji map (tile badges)

| Badge | Emoji | Rationale |
|-------|--------|------------|
| Hot | 🔥 | Universal “hot,” urgency; strong engagement association. |
| New | ✨ | Sparkles = new, fresh, just listed. |
| Open house | 🏠 or 📅 | House = property; calendar = event. Pick one and stick to it. |
| Price reduced | 📉 or 💰 | Downward trend = price drop; money = value. |
| Resort | 🏔️ or 🌲 | Nature, premium location; fits Central Oregon. |
| Fire (likes) | (keep heart icon) | We already use an icon; no need to add emoji. |

Use **one** of the options per row in the table site-wide (e.g. always 📅 for Open house, always 📉 for Price reduced).

---

## 4. Placement on tiles (consistent location)

- **Top-left of image:** Primary status badges (Hot, Open house, New, Price reduced, Resort) and DOM. Order: urgency → new → deal → premium → DOM. Same order on every tile type (listing, community, report) where that badge exists.
- **Bottom-left of image:** “New” pill (if not top-left), Fire + like count, then media badges (Video, Virtual tour, Floor plan). Same layout across tiles.
- **Top-right of image:** Share, Like, Save, views (same strip everywhere).
- **Emoji:** First character of the badge label (e.g. `🔥 Hot`, `✨ New`), so location is “same as the badge,” always at the start of the text.

This creates a single, predictable visual language: **where** to look for status, **where** for actions, and **what** each color and emoji means.

---

## 5. Implementation checklist

- [ ] All tile badge backgrounds use design tokens: `var(--urgent)`, `var(--success)`, `var(--warning)`, `var(--accent)`, `var(--brand-navy)`, or neutral (white/95, black/70).
- [ ] ListingTile, CommunityTile, SalesReportCard (and any other tile with badges) use the same semantic mapping (e.g. Hot = urgent, New = success, Price reduced = warning, Resort = accent or navy).
- [ ] Optional emoji: one per primary badge, at start of label, with `aria-hidden`; text label still present for a11y.
- [ ] Badge order and placement (top-left vs bottom-left vs top-right) match this guide across all tile components.
- [ ] No ad-hoc colors (e.g. `rose-600`, `emerald-600`, `indigo-700`) for status; replace with tokens so the palette is consistent and maintainable.

---

## 6. References (summary)

- Color: warm = attention/urgency, cool = trust/calm; high-contrast accents for CTAs and key badges.
- Trust/UX: 3–4 badge types near decision points help; too many badges can reduce trust.
- Emoji: 1–3 per context, visual anchors (e.g. start of label), fire/heart/star often perform well; placement and consistency matter more than quantity.
- Real estate: green = active/positive, amber = caution/notice, red = urgency/pending in many MLS systems; we align “Hot”/urgency with red, “New”/positive with green, “Deal” with amber.
