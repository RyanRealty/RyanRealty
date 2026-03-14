import { getAdminActions } from '@/app/actions/admin-audit'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default async function AdminAuditLogPage() {
  const actions = await getAdminActions({ limit: 100 })

  return (
    <div>
      <h1 className="text-xl font-bold text-foreground">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Recent admin actions (create, update, delete).</p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="text-foreground">Time</TableHead>
              <TableHead className="text-foreground">Admin</TableHead>
              <TableHead className="text-foreground">Role</TableHead>
              <TableHead className="text-foreground">Action</TableHead>
              <TableHead className="text-foreground">Resource</TableHead>
              <TableHead className="text-foreground">ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No actions recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              actions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{row.admin_email}</TableCell>
                  <TableCell className="text-muted-foreground">{row.role ?? '—'}</TableCell>
                  <TableCell className="text-foreground">{row.action_type}</TableCell>
                  <TableCell className="text-muted-foreground">{row.resource_type ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{row.resource_id ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        <Link href="/admin" className="underline hover:no-underline">Back to Dashboard</Link>
      </p>
    </div>
  )
}
