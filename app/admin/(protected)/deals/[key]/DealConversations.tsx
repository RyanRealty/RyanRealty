'use client'

// Broker-only comms timeline for the clients on this file — calls, voicemails,
// texts, notes and CRM email, pulled from crm_timeline. The client portal
// never reads this; it exists so a broker can see the whole conversation
// without leaving the deal.
import { useState } from 'react'
import { Button, StateWord } from '@/components/admin/v2'
import { formatDate } from '@/lib/format/date'
import type { DealConversationRow } from '@/lib/data/tc/mail-reads'

const KIND_LABEL: Record<string, string> = {
  call: 'Call',
  voicemail: 'Voicemail',
  sms_in: 'Text in',
  sms_out: 'Text out',
  note: 'Note',
  email_in: 'Email in',
  email_out: 'Email out',
}

const SHOWN = 25
const TRUNCATE_AT = 200

function durationLabel(sec: number | null): string | null {
  if (sec == null) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function DealConversations({ rows }: { rows: DealConversationRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? rows : rows.slice(0, SHOWN)

  return (
    <section aria-label="Client conversations" className="av2-pane" style={{ marginTop: 16 }}>
      <p style={{ margin: 0, fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
        Client conversations
        <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', fontWeight: 400 }}>
          {' '}
          — brokers only; clients never see this
        </span>
      </p>

      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text-2)' }}>
          Calls, voicemails, texts and notes with the clients on this file show up here
          automatically.
        </p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {visible.map((row, i) => (
              <ConversationRow key={row.id} row={row} first={i === 0} />
            ))}
          </ul>
          {rows.length > SHOWN && !showAll ? (
            <Button variant="quiet" onClick={() => setShowAll(true)}>
              Show all {rows.length}
            </Button>
          ) : null}
        </>
      )}
    </section>
  )
}

function ConversationRow({ row, first }: { row: DealConversationRow; first: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const text = row.body?.trim() || ''
  const long = text.length > TRUNCATE_AT
  const shown = expanded || !long ? text : `${text.slice(0, TRUNCATE_AT)}…`
  const duration = durationLabel(row.durationSec)

  return (
    <li style={{ padding: '10px 2px', borderTop: first ? undefined : '1px solid var(--a-border)' }}>
      <p
        style={{
          margin: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 8,
          fontSize: 'var(--a-text-sm)',
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--a-text-2)' }}>
          {formatDate(row.ts, { year: undefined, hour: 'numeric', minute: '2-digit' })}
        </span>
        <StateWord state="accent">{KIND_LABEL[row.kind] ?? row.kind}</StateWord>
        <span style={{ color: 'var(--a-text)' }}>{row.personName ?? 'Unknown client'}</span>
        {row.broker ? <span style={{ color: 'var(--a-text-2)' }}>· {row.broker}</span> : null}
        {duration ? <span style={{ color: 'var(--a-text-2)' }}>· {duration}</span> : null}
      </p>
      {row.title ? (
        <p style={{ margin: '4px 0 0', fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>{row.title}</p>
      ) : null}
      {text ? (
        <p style={{ margin: '2px 0 0', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {shown}
          {long ? (
            <Button variant="quiet" onClick={() => setExpanded((v) => !v)} style={{ marginLeft: 6 }}>
              {expanded ? 'Less' : 'More'}
            </Button>
          ) : null}
        </p>
      ) : null}
    </li>
  )
}
