# Component Coverage Matrix

Use this matrix to verify every page has complete UX states and consistent component usage.

## How to use

1. Add one row per page or major surface.
2. Mark each state once implemented.
3. Link to related components and charts.
4. Keep this file updated in the same PR when adding new surfaces.

## Coverage Table

| Surface | Route | Primary Components (`@/components/ui/*`) | Charts Present | Loading | Empty | Error | Success | Keyboard Ready | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Home | `/` | Card, Button, Badge, Skeleton | Yes/No | [ ] | [ ] | [ ] | [ ] | [ ] |  |
| Listings | `/listings` | Card, Button, Input, Select, Badge | Yes/No | [ ] | [ ] | [ ] | [ ] | [ ] |  |
| Search | `/search/[...slug]` | Card, Input, Select, Badge, Tabs | Yes/No | [ ] | [ ] | [ ] | [ ] | [ ] |  |
| Reports | `/reports` | Card, Tabs, Badge, Skeleton | Yes/No | [ ] | [ ] | [ ] | [ ] | [ ] |  |
| Open Houses | `/open-houses` | Card, Badge, Button | Yes/No | [ ] | [ ] | [ ] | [ ] | [ ] |  |
| Area Guides | `/area-guides` | Card, Badge, Separator | Yes/No | [ ] | [ ] | [ ] | [ ] | [ ] |  |

## Completion Rule

A surface is considered complete only when all of these are true:

- All UI states are covered
- Uses shadcn/ui components and semantic tokens only
- Lighthouse and accessibility checks pass in CI
