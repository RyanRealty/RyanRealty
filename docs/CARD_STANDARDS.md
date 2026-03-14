# Card and tile standards

All card types on the site (listing, city, community, neighborhood, broker) follow the same layout and interaction patterns so the experience is consistent.

## Action bar (bottom-right)

- **Location:** Bottom-right corner of the card (or card media).
- **Component:** `components/ui/CardActionBar.tsx`
- **Actions (when applicable):** Share, Like, Save, Compare (listings only).
- **Styling:** Same icon size (`h-9 w-9`), same colors:
  - Unselected: on dark = `border-white/30 bg-black/40`; on light = `border + bg-white/95 text-zinc`
  - Selected: `border-[var(--accent)] bg-[var(--accent)]/20` with accent text/fill.
- **Variants:** `onDark` (over photo/hero), `onLight` (over white content).

## Badges (top-left)

- **Location:** Top-left of the card media; single row to avoid overlap.
- **Component:** `components/ui/CardBadges.tsx`
- **Behavior:** Pass an array of `{ label, variant, icon? }` in **priority order**. Component shows first N (default 4).
- **Variants:** `hot`, `new`, `price-drop`, `resort`, `open-house`, `days`, `media`, `trending`, `popular`, `steady`.
- **Content-specific:** Listing = Hot, Open house, New, Price reduced, Resort, days on market. Community = Hot market, Popular, Steady. No badge stacking; keep one row.

## Card types

| Type           | Component           | Badges              | Actions              |
|----------------|---------------------|---------------------|----------------------|
| Listing        | `ListingTile`       | CardBadges (top-left) | Share, Like, Save, Compare |
| Community      | `CommunityTile`     | CardBadges          | Share, Like, Save    |
| Community (card) | `CommunityCard`   | Resort (top-right)  | Share, Like, Save    |
| City           | `CityTile`          | —                   | Share, Save          |
| Broker         | `BrokerCard`        | —                   | Share                |

## Sliders

- Use `TilesSlider` + `TilesSliderItem` for single-row horizontal scroll.
- One row per section; tile width from `TilesSliderItem` (e.g. 85vw / 280px / 300px).
- All tiles in a slider use the same card pattern (image area + content + action bar bottom-right).

## Broker card content

- Photo, name, title, 5-star review (rating + count), bio snippet (line-clamp-2), license ID, phone, email, View Profile CTA.
- Action bar: Share (bottom-right, onLight).
