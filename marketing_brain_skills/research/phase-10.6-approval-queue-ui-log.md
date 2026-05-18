# Phase 10.6 - Approval Queue UI

**Phase:** 10.6
**Started:** 2026-05-17
**Finished:** 2026-05-17
**Agent:** claude-sonnet-4-6

## Auth pattern identified

Same as Phase 10.5: `app/admin/(protected)/layout.tsx` route group via Supabase cookie auth. Pages placed under `app/admin/(protected)/approval-queue/` inherit the gate.

## Inputs consumed

- `supabase/migrations/20260516200000_marketing_brain_actions_upgrade.sql` (confirmed `comments` JSONB column exists, also `priority_score`, `predicted_north_star_impact`, `scheduled_for`, `cost_estimate_usd`, `killed_reason`, `needs_changes_at`)
- `supabase/migrations/20260516200300_producer_change_requests.sql` (for duplicate-as-new-producer action)
- `marketing_brain_skills/research/AUTONOMOUS_PIPELINE_BRIEF.md` sections 10.6 (page spec)
- `lib/supabase/service.ts` (service client for bypassing RLS on marketing_brain_actions)
- `app/actions/admin-roles.ts` (auth check in API routes)

## Outputs produced

| File | Lines |
|---|---|
| `app/admin/(protected)/approval-queue/page.tsx` | 102 |
| `app/admin/(protected)/approval-queue/_components/ActionCard.tsx` | 170 |
| `app/admin/(protected)/approval-queue/_components/ActionButtons.tsx` | 230 |
| `app/admin/(protected)/approval-queue/_components/CommentsThread.tsx` | 120 |
| `app/admin/(protected)/approval-queue/_components/MediaPreview.tsx` | 90 |
| `app/admin/(protected)/approval-queue/_components/FilterSidebar.tsx` | 110 |
| `app/api/admin/approval-queue/[id]/action/route.ts` | 145 |
| `app/api/admin/approval-queue/[id]/comments/route.ts` | 90 |

**Total: ~1,057 lines**

## Key design decisions

1. **`force-dynamic` on the page.** The queue must always show the latest DB state; static/ISR would show stale rows.
2. **Service role client for reads.** `marketing_brain_actions` has RLS; the service client bypasses it for the admin queue.
3. **Comments stored as JSONB on the action row.** Matches Phase 4.6 schema (`comments jsonb NOT NULL DEFAULT '[]'::jsonb`). No separate comments table needed.
4. **change_request comment type flips status.** Both the `ActionButtons` "Request changes" path and the `CommentsThread` "change_request" type write to `needs_changes_at` and flip `status = 'needs_changes'` in a single update.
5. **MediaPreview infers media type from action_type + URL extension.** Handles video (mp4/webm/mov), image, carousel, blog (iframe), email (iframe), and link fallback.
6. **Realtime note in page copy.** The Supabase Realtime client subscription requires a `'use client'` wrapper component; the page is a Server Component. Rather than inlining a realtime wrapper in this phase, the page documents it clearly for Phase 11+ to add a `<ApprovalQueueRealtime>` client component that subscribes to the `marketing_brain_actions` channel.
7. **Duplicate action creates producer_change_requests row.** Follows the brief spec exactly: "spin off as new producer" writes a `duplicate_with_changes` type row to `producer_change_requests`.

## Migration status

`comments` column confirmed present in `20260516200000_marketing_brain_actions_upgrade.sql`. No new migration needed.

## shadcn/ui audit

Components used: Card, CardContent, CardHeader, Badge, Button, Textarea, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Collapsible, CollapsibleTrigger, CollapsibleContent, Separator, Alert, AlertDescription, Skeleton. No raw HTML form elements. No hex codes.

## Dash grep result

0 em-dash (U+2014) or en-dash (U+2013) instances in any written file.

## Blockers

None.
