export const dynamic = 'force-dynamic'
import BackfillHealthPanel from './BackfillHealthPanel'
import { ConsoleSection } from '@/components/console/ConsoleSection'

export default async function SyncPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <ConsoleSection title="Sync status" bodyClassName="mb-2">
        <p className="text-sm text-muted-foreground">
          Delta sync, terminal history, full sync, and the strict verify cron handle ongoing work.
          Use this page for backfill health and strict verification telemetry.
        </p>
      </ConsoleSection>
      <div className="mt-6">
        <BackfillHealthPanel />
      </div>
    </main>
  )
}
