'use client'

import { Button } from '@/components/ui/button'

/**
 * EmailLogCsvButton — client-side CSV download of the sent-email log page the
 * server already rendered. Serializes the rows it is handed (no second fetch, no
 * network) to a Blob and triggers a browser download — the same pattern as the
 * query-builder CSV export. Every value comes from a real email_events row, so
 * the CSV carries no fabricated metric (CLAUDE.md §0).
 */

export type EmailLogCsvRow = {
  recipientEmail: string
  person: string
  broker: string
  sendType: string
  subject: string
  latestEvent: string
  latestAt: string
  messageId: string
}

const HEADERS = [
  'Recipient',
  'Contact',
  'Broker',
  'Send type',
  'Subject',
  'Latest event',
  'Latest at',
  'Message id',
] as const

/** Quote a CSV cell, escaping embedded quotes. */
function cell(value: string): string {
  const v = value ?? ''
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function toCsv(rows: EmailLogCsvRow[]): string {
  const lines = [HEADERS.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.recipientEmail,
        r.person,
        r.broker,
        r.sendType,
        r.subject,
        r.latestEvent,
        r.latestAt,
        r.messageId,
      ]
        .map(cell)
        .join(','),
    )
  }
  return lines.join('\n')
}

export function EmailLogCsvButton({ rows }: { rows: EmailLogCsvRow[] }) {
  function download() {
    const csv = toCsv(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = 'email-send-log.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objUrl)
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={download} disabled={rows.length === 0}>
      Export CSV
    </Button>
  )
}
