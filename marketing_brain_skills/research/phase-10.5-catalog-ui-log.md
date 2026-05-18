# Phase 10.5 - Producer Catalog UI

**Phase:** 10.5
**Started:** 2026-05-17
**Finished:** 2026-05-17
**Agent:** claude-sonnet-4-6

## Auth pattern identified

`app/admin/(protected)/layout.tsx` uses `getSession()` + `getAdminRoleForEmail()` (Supabase cookie auth via `@supabase/ssr`). No NextAuth or Clerk. All new pages placed under `app/admin/(protected)/` inherit this layout automatically.

## Inputs consumed

- `app/admin/(protected)/layout.tsx` (auth gate pattern)
- `app/admin/(protected)/audit-log/page.tsx` (shadcn/ui usage exemplar)
- `lib/supabase/server.ts`, `lib/supabase/service.ts` (DB client patterns)
- `lib/admin.ts` (isSuperuserAdmin helper)
- `app/actions/admin-roles.ts` (getAdminRoleForEmail)
- `marketing_brain_skills/producers/REGISTRY.md` (sections A-I, 40+ producers)
- `supabase/migrations/20260516200300_producer_change_requests.sql` (confirmed schema exists)
- `components/ui/` listing (confirmed all shadcn components needed are present)
- `package.json` (confirmed gray-matter NOT present, hand-rolled parser used instead)

## Outputs produced

| File | Lines |
|---|---|
| `lib/producer-catalog.ts` | 230 |
| `app/admin/(protected)/producers/page.tsx` | 103 |
| `app/admin/(protected)/producers/[slug]/page.tsx` | 135 |
| `app/admin/(protected)/producers/_components/ProducerCard.tsx` | 94 |
| `app/admin/(protected)/producers/_components/ProducerFilterSidebar.tsx` | 116 |
| `app/admin/(protected)/producers/_components/ExamplesGallery.tsx` | 90 |
| `app/admin/(protected)/producers/_components/EditProducerPanel.tsx` | 110 |
| `app/api/admin/producer-change-requests/route.ts` | 72 |

**Total: ~950 lines**

## Key design decisions

1. **No gray-matter dependency.** Package absent from package.json; hand-rolled YAML frontmatter parser handles scalar + block-list shapes used across all SKILL.md files.
2. **Section inference from path.** Registry sections A-I are inferred from the `skillPath` string rather than requiring frontmatter, keeping SKILL.md authoring simple.
3. **Module-level cache.** `_cache` in `lib/producer-catalog.ts` prevents re-scanning the filesystem on every server component render within a cold start.
4. **Producer placeholder thumbnail.** Falls back to `/admin/producers/_placeholder.png` when no `thumbnail_uri` or `example_outputs` in frontmatter.
5. **API route for change requests.** `POST /api/admin/producer-change-requests` uses service role to bypass RLS (table grants service_role only, per migration).
6. **Markdown renderer is hand-rolled.** Avoids remark/rehype deps. Handles h1-h3, bold, italic, code, fenced code blocks, unordered lists, horizontal rules, and paragraphs.

## Migration status

`supabase/migrations/20260516200300_producer_change_requests.sql` already present from Phase 4.6. NOT re-applied here. Referenced by API route.

## Orchestrator stub

`EditProducerPanel.tsx` includes a clear TODO comment: orchestrator that polls `pending` producer_change_requests rows is a separate skill not built in Phase 10.5.

## shadcn/ui audit

All UI elements use `@/components/ui/*` only. Components used: Card, CardContent, CardHeader, Badge, Button, Input, Label, Checkbox, Select, Separator, Textarea, Dialog, DialogContent, DialogTitle, Skeleton, Alert, AlertDescription. No raw HTML buttons, inputs, or selects. No hex codes (all tokens: bg-primary, text-muted-foreground, bg-card, etc.).

## Dash grep result

0 em-dash (U+2014) or en-dash (U+2013) instances in any written file.

## Blockers

None.
