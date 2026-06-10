// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmDeals } from '@/app/actions/crm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Pipeline | CRM | Admin' }
export const dynamic = 'force-dynamic'

function money(v: number | null): string {
  if (!v) return '—'
  return '$' + Math.round(v).toLocaleString('en-US')
}

export default async function CrmDealsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const deals = await listCrmDeals()

  const pipelines = [...new Set(deals.map((d) => d.pipeline ?? 'Other'))]

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="hover:text-foreground">← Back to CRM</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pre-contract pipeline imported from FUB. Vault remains the system of record once a transaction opens.
      </p>

      {pipelines.map((pipe) => {
        const rows = deals.filter((d) => (d.pipeline ?? 'Other') === pipe)
        const stages = [...new Set(rows.map((d) => d.stage ?? 'No stage'))]
        return (
          <section key={pipe} className="mt-8">
            <h2 className="text-lg font-semibold text-foreground">{pipe} <span className="font-normal text-muted-foreground">({rows.length})</span></h2>
            <div className="mt-3 grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {stages.map((stage) => (
                <Card key={stage}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{stage}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {rows.filter((d) => (d.stage ?? 'No stage') === stage).map((d) => (
                      <div key={d.id} className="rounded-md border border-border px-3 py-2">
                        <div className="text-sm font-medium text-foreground">
                          {d.person_id ? (
                            <Link href={`/admin/crm/${d.person_id}`} className="hover:underline">{d.name ?? d.person?.name ?? `Deal #${d.id}`}</Link>
                          ) : (d.name ?? `Deal #${d.id}`)}
                        </div>
                        <div className="text-xs tabular-nums text-muted-foreground">{money(d.value)}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
      {deals.length === 0 ? (
        <Card className="mt-6"><CardContent className="py-10 text-center text-sm text-muted-foreground">No deals yet.</CardContent></Card>
      ) : null}
    </main>
  )
}
