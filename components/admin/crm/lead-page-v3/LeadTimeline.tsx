'use client'

import { useState } from 'react'
import { FilterChip } from '@/components/admin/v2'
import {
  filterPersonTimeline,
  type PersonTimelineChannel,
  type PersonTimelineItem,
} from '@/lib/data/crm/person-timeline'

const FILTERS: Array<{ id: 'all' | PersonTimelineChannel; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'sms', label: 'Texts' },
  { id: 'email', label: 'Emails' },
  { id: 'call', label: 'Calls' },
  { id: 'visit', label: 'Visits' },
  { id: 'note', label: 'Notes' },
]

function dayKey(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric' })
}

function timeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}

function icon(channel: PersonTimelineChannel): string {
  if (channel === 'sms') return 'SMS'
  if (channel === 'email') return 'Email'
  if (channel === 'call') return 'Call'
  if (channel === 'visit') return 'Visit'
  if (channel === 'note') return 'Note'
  if (channel === 'system') return 'Sys'
  return '•'
}

export function LeadTimeline(props: { items: PersonTimelineItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [showSystem, setShowSystem] = useState(false)
  const rows = filterPersonTimeline(props.items, filter, { showSystem })
  let lastDay = ''

  return (
    <div>
      <div
        className="av2-wordrow"
        style={{ padding: '12px 18px', borderBottom: '1px solid var(--a-border)', flexWrap: 'wrap', gap: 8 }}
      >
        <h2 style={{ margin: 0, fontSize: 14, color: 'var(--a-text)' }}>Timeline</h2>
        <span style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          texts, emails, calls, visits and notes, newest first
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FILTERS.map((f) => (
            <FilterChip key={f.id} pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>
      <div style={{ padding: '6px 18px 4px' }}>
        {rows.map((item) => {
          const day = dayKey(item.ts)
          const showDay = day && day !== lastDay
          lastDay = day
          return (
            <div key={item.id}>
              {showDay ? (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: 'var(--a-text-2)',
                    padding: '10px 0 2px',
                  }}
                >
                  {day}
                </div>
              ) : null}
              <article
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '12px 0',
                  borderBottom: '1px solid var(--a-border)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flex: 'none',
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'var(--a-inset)',
                    color: 'var(--a-text)',
                  }}
                >
                  {icon(item.channel)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {item.title}
                    {item.actor ? (
                      <span style={{ fontWeight: 400, color: 'var(--a-text-2)' }}> · {item.actor}</span>
                    ) : null}
                  </div>
                  {item.body ? (
                    <div
                      style={{
                        marginTop: 3,
                        color: 'var(--a-text)',
                        background: item.direction === 'out' ? 'var(--a-inset)' : 'var(--a-bg)',
                        borderRadius: 10,
                        padding: item.direction ? '8px 12px' : 0,
                      }}
                    >
                      {item.body}
                    </div>
                  ) : null}
                  {item.href ? (
                    <a href={item.href} style={{ color: 'var(--a-accent)', fontSize: 12 }}>
                      Open
                    </a>
                  ) : null}
                </div>
                <div style={{ fontSize: 12, color: 'var(--a-text-2)', whiteSpace: 'nowrap' }}>{timeLabel(item.ts)}</div>
              </article>
            </div>
          )
        })}
        {rows.length === 0 ? (
          <p style={{ padding: '12px 0', color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>Nothing in this filter.</p>
        ) : null}
        <p style={{ padding: '6px 0 10px', color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>
          System events (e.g. &quot;Broker alert queued&quot;) are hidden ·{' '}
          <button
            type="button"
            onClick={() => setShowSystem((v) => !v)}
            style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
          >
            {showSystem ? 'hide' : 'show'}
          </button>
        </p>
      </div>
    </div>
  )
}
