import type { Metadata } from 'next'
import AdminEmailCompose from '@/components/admin/AdminEmailCompose'
import ComposeToCohort from '@/components/admin/email/ComposeToCohort'
import { ConsoleSection } from '@/components/console/ConsoleSection'

export const metadata: Metadata = {
  title: 'Compose email',
  description: 'Compose and send email to a cohort or a single recipient.',
}

export const dynamic = 'force-dynamic'

export default function AdminEmailComposePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Compose email</h1>
        <p className="text-sm text-muted-foreground">
          Email a smart list or a pipeline stage. Preview the recipient count, then send now or schedule.
        </p>
      </header>

      <ConsoleSection title="Send to a cohort">
        <ComposeToCohort />
      </ConsoleSection>

      <ConsoleSection title="Send to one recipient">
        <AdminEmailCompose />
      </ConsoleSection>
    </main>
  )
}
