// @no-parity — internal admin surface, no public mockup contract
//
// Audit log — P11D: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only. This page is a
// COMPLIANCE RECORD, so the record itself was moved byte-for-byte.
//
// Carried over verbatim: PAGE_SIZE = 25, the getAdminActions read with
// limit = PAGE_SIZE + 1 / offset = pageNum * PAGE_SIZE (the lookahead that
// avoids a count query), created_at DESC ordering, the `page` / `admin` /
// `action` search params and their trim()-or-null handling, filterQuery()'s
// param merge, the six displayed columns in their original order (Time · Admin
// · Role · Action · Resource · ID), the em-dash fallbacks, actionVariant()'s
// substring classification, and BOTH date helpers unchanged — see the note on
// relativeTime/exactTime below.
//
// Shape changed, the record did not: the console kit's ConsoleSection +
// KpiStrip became the family's SectionHead + numbers strip, the desktop-only
// <Table> and its md:hidden card twin collapsed into ONE grid that reads the
// same at 375px and 1280px, the shadcn Badge became the v2 StateWord (text +
// color, never color alone), and the <h1> title chrome is gone — the nav names
// the page. One line was CUT rather than migrated: the footer "Back to
// Dashboard" link. /admin has redirected to /admin/today since 2026-06-16, so
// the word "Dashboard" named a screen that no longer exists.
import { getAdminActions, type AdminActionRow } from '@/app/actions/admin-audit'
import Link from 'next/link'
import {
  Button,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  TextField,
  VerdictLine,
  type AdminState,
  type ReportColumn,
} from '@/components/admin/v2'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

/**
 * Pure presentational helpers — no data access, no business logic.
 *
 * NOT migrated to lib/format/date.ts, deliberately. formatDate() re-projects
 * every instant into America/Los_Angeles; these two render in the runtime's own
 * zone, which is UTC on Vercel. On an audit record that is a different printed
 * timestamp for the same row, and the printed timestamp IS the record. The
 * old-vs-new comparison is in the P11D migration report; the swap moves values,
 * so the old helpers stay. This file is already carried in
 * scripts/date-format-baseline.json, so nothing regresses.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diffSec = Math.round((Date.now() - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay} days ago`
  return new Date(iso).toLocaleDateString()
}

function exactTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString()
}

/** Map an action verb to a color-as-signal badge variant. */
function actionVariant(
  actionType: string
): 'success' | 'default' | 'destructive' | 'soft-neutral' {
  const a = actionType.toLowerCase()
  if (a.includes('delete') || a.includes('remove') || a.includes('revoke'))
    return 'destructive'
  if (a.includes('create') || a.includes('add') || a.includes('approve'))
    return 'success'
  if (a.includes('update') || a.includes('edit') || a.includes('change'))
    return 'default'
  return 'soft-neutral'
}

/** The same four classes, spoken in the locked state vocabulary. */
const STATE: Record<ReturnType<typeof actionVariant>, AdminState> = {
  success: 'ok',
  destructive: 'down',
  default: 'accent',
  'soft-neutral': 'waiting',
}

const COLUMNS: ReportColumn[] = [
  { key: 'time', label: 'Time' },
  { key: 'admin', label: 'Admin' },
  { key: 'role', label: 'Role' },
  { key: 'action', label: 'Action' },
  { key: 'resource', label: 'Resource' },
  { key: 'id', label: 'ID' },
]

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; admin?: string; action?: string }>
}) {
  const { page, admin, action } = await searchParams
  const pageNum = Math.max(0, parseInt(String(page), 10) || 0)
  const adminEmail = admin?.trim() || null
  const actionType = action?.trim() || null
  const filtered = Boolean(adminEmail || actionType)

  // Fetch one extra row to know whether a next page exists, without a count query.
  const fetched = await getAdminActions({
    limit: PAGE_SIZE + 1,
    offset: pageNum * PAGE_SIZE,
    adminEmail,
    actionType,
  })
  const hasNext = fetched.length > PAGE_SIZE
  const rows: AdminActionRow[] = fetched.slice(0, PAGE_SIZE)

  // Glanceable summary, derived from the current page only (presentational).
  const distinctAdmins = new Set(rows.map((r) => r.admin_email)).size
  const createCount = rows.filter((r) => actionVariant(r.action_type) === 'success').length
  const deleteCount = rows.filter((r) => actionVariant(r.action_type) === 'destructive').length

  const filterQuery = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    const merged = { admin: adminEmail ?? undefined, action: actionType ?? undefined, ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== '' && v !== null) params.set(k, String(v))
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ''
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={rows.length === 0 ? 'attention' : 'ok'}>
          {rows.length === 0 ? (
            <b>
              {filtered
                ? 'No admin action matches this filter.'
                : 'No admin action has been recorded.'}
            </b>
          ) : (
            <>
              <b>
                {rows.length} {rows.length === 1 ? 'action' : 'actions'} on page {pageNum + 1}
                {filtered ? ', filtered' : ''}.
              </b>{' '}
              Newest first{hasNext ? '; more follow' : ''}.
            </>
          )}
        </VerdictLine>
      </div>

      <form method="get" className="av2-rfilters">
        <TextField
          label="Admin email"
          type="text"
          name="admin"
          defaultValue={adminEmail ?? ''}
          placeholder="Filter by admin email"
        />
        <TextField
          label="Action type"
          type="text"
          name="action"
          defaultValue={actionType ?? ''}
          placeholder="Filter by action type"
        />
        <div className="av2-wordrow" style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>
          <Button type="submit" touch>
            Filter
          </Button>
          {filtered && (
            <Link
              href="/admin/audit-log"
              className="av2-btn av2-btn--quiet av2-btn--touch"
              style={{ textDecoration: 'none' }}
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      {rows.length > 0 && (
        <>
          <SectionHead>This page</SectionHead>
          <ReportNumbers
            items={[
              { key: 'rows', label: 'On this page', value: String(rows.length) },
              { key: 'admins', label: 'Admins', value: String(distinctAdmins) },
              { key: 'creates', label: 'Creates / approvals', value: String(createCount) },
              { key: 'deletes', label: 'Deletes / revokes', value: String(deleteCount) },
            ]}
          />
        </>
      )}

      <SectionHead>Action log</SectionHead>
      <ReportGrid
        label="Admin action log"
        columns={COLUMNS}
        template="minmax(150px, 1.2fr) minmax(170px, 1.5fr) minmax(76px, 0.6fr) minmax(120px, 1fr) minmax(100px, 0.9fr) minmax(90px, 0.9fr)"
        minWidth={780}
        rows={rows.map((row) => ({
          key: row.id,
          cells: [
            <time
              key="t"
              dateTime={row.created_at}
              title={exactTime(row.created_at)}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {exactTime(row.created_at)}
              <span style={{ display: 'block', color: 'var(--a-text-2)', fontSize: 'var(--a-text-xs)' }}>
                {relativeTime(row.created_at)}
              </span>
            </time>,
            <span key="a" style={{ overflowWrap: 'anywhere' }}>
              {row.admin_email}
            </span>,
            row.role ?? '—',
            <StateWord key="v" state={STATE[actionVariant(row.action_type)]}>
              {row.action_type}
            </StateWord>,
            row.resource_type ?? '—',
            <span key="i" style={{ overflowWrap: 'anywhere' }}>
              {row.resource_id ?? '—'}
            </span>,
          ],
        }))}
        empty={
          filtered ? (
            <>
              No matching actions. Try a different admin email or action type, or{' '}
              <Link href="/admin/audit-log" style={{ color: 'var(--a-accent)' }}>
                clear the filters
              </Link>
              .
            </>
          ) : (
            'Admin changes (create, update, delete) appear here as your team works. Nothing has been logged so far.'
          )
        }
      />

      <nav
        aria-label="Pagination"
        style={{
          marginTop: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        {pageNum > 0 ? (
          <Link
            href={`/admin/audit-log${filterQuery({ page: pageNum - 1 || undefined })}`}
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ textDecoration: 'none' }}
          >
            Previous
          </Link>
        ) : (
          <Button variant="quiet" touch disabled>
            Previous
          </Button>
        )}
        <span
          style={{
            fontSize: 'var(--a-text-sm)',
            color: 'var(--a-text-2)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Page {pageNum + 1}
        </span>
        {hasNext ? (
          <Link
            href={`/admin/audit-log${filterQuery({ page: pageNum + 1 })}`}
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ textDecoration: 'none' }}
          >
            Next
          </Link>
        ) : (
          <Button variant="quiet" touch disabled>
            Next
          </Button>
        )}
      </nav>
    </div>
  )
}
