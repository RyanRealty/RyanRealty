// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { setCrmBrokerActiveAction, setCrmBrokerRoutingEligibleAction } from '@/app/actions/crm-brokers'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const metadata = { title: 'Brokers | CRM settings' }
export const dynamic = 'force-dynamic'

/**
 * /admin/crm/settings/brokers — the CRM broker roster, editable.
 *
 * Reads the roster from the cached DAL (getCrmBrokers, from the brokers table);
 * each broker's CRM-active + routing-eligible flags toggle via the owner-guarded
 * server actions in app/actions/crm-brokers.ts. Routing eligibility feeds the
 * (dormant) round-robin engine; CRM-active gates a broker out of pickers/lists.
 */
export default async function CrmBrokersSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const brokers = await getCrmBrokers()

  // Each toggle is a server-action form: posting flips the flag to the opposite
  // of its current value (passed in the hidden `value` field).
  async function toggleActive(formData: FormData): Promise<void> {
    'use server'
    await setCrmBrokerActiveAction(formData)
  }
  async function toggleRouting(formData: FormData): Promise<void> {
    'use server'
    await setCrmBrokerRoutingEligibleAction(formData)
  }

  return (
    <SettingsSubpageShell
      title="Brokers"
      description="The CRM broker roster used for assignment and round-robin lead routing. Toggle a broker in or out of the CRM, and whether they receive routed leads."
    >
      <div className="no-scrollbar mt-4 rounded-xl border border-border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden w-1/5 md:table-cell">Slug</TableHead>
              <TableHead className="w-1/4">Name</TableHead>
              <TableHead className="hidden w-1/4 md:table-cell">Email</TableHead>
              <TableHead className="w-1/6">CRM active</TableHead>
              <TableHead className="w-1/6">Routing</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No CRM brokers. Apply the broker config migration, then assign each broker a CRM slug.
                </TableCell>
              </TableRow>
            ) : (
              brokers.map((b) => (
                <TableRow key={b.slug}>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{b.slug}</TableCell>
                  <TableCell className="font-medium text-foreground">{b.name || '—'}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{b.email ?? '—'}</TableCell>
                  <TableCell>
                    <form action={toggleActive}>
                      <Input type="hidden" name="crmSlug" value={b.slug} readOnly />
                      <Input type="hidden" name="value" value={b.crmActive ? 'off' : 'on'} readOnly />
                      <Button type="submit" size="sm" variant={b.crmActive ? 'default' : 'outline'} className="min-h-9">
                        {b.crmActive ? 'Active' : 'Off'}
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell>
                    <form action={toggleRouting}>
                      <Input type="hidden" name="crmSlug" value={b.slug} readOnly />
                      <Input type="hidden" name="value" value={b.routingEligible ? 'off' : 'on'} readOnly />
                      <Button type="submit" size="sm" variant={b.routingEligible ? 'default' : 'outline'} className="min-h-9">
                        {b.routingEligible ? 'Eligible' : 'No'}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </SettingsSubpageShell>
  )
}
