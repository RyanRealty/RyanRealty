// @no-parity — admin-internal email surface, no public mockup contract.
//
// /admin/email/compose — P11E: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). PRESENTATION ONLY.
//
// This is a SEND surface (CLAUDE.md §1 per-action approval class 1). Nothing on
// the send path was touched: ComposeToCohort and AdminEmailCompose are MOUNTED
// UNCHANGED, with no props, exactly as before. Recipient resolution, the
// bulkPreflightCount audience read, the brand-voice check, the suppression /
// quiet-hours / unsubscribe checks and the scheduling handoff all live inside
// those islands and their server actions, untouched by this change.
//
// Carried over verbatim: `dynamic = 'force-dynamic'`, the page metadata title
// and description, both island mounts, and the cohort-before-single order.
//
// Shape changed, data did not: the page's own <main> is gone (ConsoleShell owns
// the landmark), the <h1> is gone (the nav names this page — acceptance bar
// rule 1), and the two ConsoleSection panels became the family's lane heads
// over the same two islands. No verdict line: this page fetches nothing, and a
// verdict with no data behind it would be a fabricated claim.
//
// ONE PHONE BUG FIXED ON THE WAY. EmailBodyEditor's formatting toolbar is 492px
// wide and does not wrap. ConsoleSection wrapped it in a shadcn <Card>, which
// carries `overflow-hidden` — so at 375px the toolbar was CLIPPED and its right
// buttons were unreachable on a phone. Each island now sits in its own
// `overflow-x: auto` box (the locked rule: wide content scrolls inside its own
// box, never the page), so the buttons are reachable and the page still does
// not scroll sideways.
import type { Metadata } from 'next'
import AdminEmailCompose from './_components/AdminEmailCompose'
import ComposeToCohort from './_components/ComposeToCohort'
import { SectionHead } from '@/components/admin/v2'

export const metadata: Metadata = {
  title: 'Compose email',
  description: 'Compose and send email to a cohort or a single recipient.',
}

export const dynamic = 'force-dynamic'

export default function AdminEmailComposePage() {
  return (
    <div className="av2-scope" style={{ maxWidth: 768, margin: '0 auto', padding: 16, minWidth: 0 }}>
      <SectionHead>Send to a cohort</SectionHead>
      <div style={{ minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}>
        <ComposeToCohort />
      </div>

      <div style={{ marginTop: 32 }}>
        <SectionHead>Send to one recipient</SectionHead>
        <div style={{ minWidth: 0, maxWidth: '100%', overflowX: 'auto' }}>
          <AdminEmailCompose />
        </div>
      </div>
    </div>
  )
}
