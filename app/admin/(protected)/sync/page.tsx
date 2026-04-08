export const dynamic = 'force-dynamic'
import BackfillHealthPanel from './BackfillHealthPanel'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SyncPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Year by year history backfill</CardTitle>
          <CardDescription>
            That Spark lane is removed. Delta sync, terminal history, full sync, and the strict verify cron handle
            ongoing work. Use this page for backfill health and strict verification telemetry.
          </CardDescription>
        </CardHeader>
      </Card>
      <BackfillHealthPanel />
    </main>
  )
}
