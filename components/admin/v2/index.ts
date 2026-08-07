/**
 * components/admin/v2 — the LOCKED admin visual language as code (P7).
 * reachability: entry-point — P8 litmus pilot consumes this barrel; P7 ships
 * primitives with no page migration by design (pack P7 block).
 *
 * Canon: design_system/admin/ADMIN_UI.md (visual lock 2026-08-05, recorded in
 * docs/plans/ADMIN_PRODUCT/decisions.md). Six patterns → these primitives.
 * Rules enforced by scripts/check-admin-v2-tokens.mjs:
 *   - tokens.css stays byte-identical to design_system/admin/tokens.css
 *   - all color via var(--a-*); no raw hex, no Tailwind palette classes,
 *     no public-brand tokens or brand fonts in this directory
 * Legacy components/admin/* (non-v2) is blacklisted as design input — never
 * import from it here.
 */
export { Button, type AdminButtonProps } from './Button'
export { StateWord, type AdminState } from './StateWord'
export { FilterChip, type FilterChipProps } from './Chip'
export { QueueRow, type QueueRowProps } from './QueueRow'
export { QuietRow } from './QuietRow'
export { SectionHead } from './SectionHead'
export { VerdictLine } from './VerdictLine'
export { ThreadBubble, type ThreadBubbleProps } from './ThreadBubble'
export { RailNav, type RailGroup, type RailItem } from './RailNav'
export { TabBar, type TabItem } from './TabBar'
export { TextField, TextAreaField, SelectField } from './Field'
// The admin's one tabular reader — every migrated data/list page draws from it.
export {
  ReportGrid,
  ReportNumbers,
  GoalMeter,
  asOfLabel,
  ReportFreshness,
  ReportError,
  ReportSkeleton,
  type ReportColumn,
  type ReportGridRow,
  type ReportNumberItem,
} from './ReportGrid'
