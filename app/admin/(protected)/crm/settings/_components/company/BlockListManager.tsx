'use client'

import { useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import type { CrmBlockedNumber } from '@/lib/data/crm/getCrmBlockedNumbers'
import { blockCrmNumber, unblockCrmNumber } from '@/app/actions/crm-block'
import { Button, SearchField } from '@/components/admin/v2'
import '@/components/admin/v2/report-grid.css'

/**
 * BlockListManager — spec §1.8 / AC-11 block-list management.
 *
 * Adds/removes rows in crm_blocked_numbers. Enforcement is already live: the
 * Twilio inbound webhooks reject calls and drop texts from blocked numbers
 * (lib/data/crm/getBlockedNumber.isNumberBlocked — uncached, next-hit effect).
 *
 * P11F: migrated to the LOCKED admin v2 language. The <Table> is gone; the
 * desktop reader is the hand-rolled div/role grid that reuses ReportGrid's
 * classes + roles (av2-rgrid*, report-grid.css), the same shape
 * _components/ConfigTableEditor.tsx uses, with sideways overflow confined to
 * .av2-rgrid__scroll instead of the page. The phone fallback carries its layout
 * in `av2-cardlist` — NOT `md:hidden` plus an inline display, which the class
 * would lose to and leave both layouts on screen at desktop.
 */
export function BlockListManager({
  blocked,
  blockedOnById,
}: {
  blocked: CrmBlockedNumber[]
  /** Server-formatted created_at per row id (lib/format/date, LA time). */
  blockedOnById: Record<number, string>
}) {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    setError('')
    startTransition(async () => {
      const res = await blockCrmNumber(phone, { reason: 'manual', note: note.trim() || undefined })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setPhone('')
      setNote('')
      router.refresh()
    })
  }

  function remove(e164: string | null, last10: string) {
    setError('')
    startTransition(async () => {
      const res = await unblockCrmNumber(e164 ?? last10)
      if (!res.ok) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  // Desktop column template — the custom properties report-grid.css reads at
  // >=720px. Below md this block is `hidden`, so the stacked-block rules never
  // apply here; the av2-cardlist below is the phone reader.
  const gridStyle = {
    '--rgrid-cols': 'minmax(140px,1fr) 104px 128px minmax(140px,1.2fr) 116px 104px',
    '--rgrid-min': '820px',
  } as CSSProperties

  const emptyCopy = 'No blocked numbers. Add one above, or block a caller from their contact page.'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s4)' }}>
      {/* Add form */}
      <div
        className="av2-pane flex-wrap"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 'var(--a-s2)' }}
      >
        <SearchField
          type="text"
          aria-label="Phone number to block"
          value={phone}
          placeholder="(541) 555-0100"
          onChange={(e) => setPhone(e.target.value)}
          style={{ maxWidth: 192 }}
        />
        <SearchField
          type="text"
          aria-label="Note"
          value={note}
          placeholder="Note (optional)"
          onChange={(e) => setNote(e.target.value)}
          style={{ maxWidth: 256 }}
        />
        <Button disabled={isPending || !phone.trim()} onClick={add}>
          {isPending ? 'Saving...' : 'Block number'}
        </Button>
        {error && (
          <p
            className="w-full"
            style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Blocked numbers — phone card list (< md) */}
      <div className="av2-cardlist">
        {blocked.length === 0 ? (
          <div className="av2-pane">
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {emptyCopy}
            </p>
          </div>
        ) : (
          blocked.map((b) => (
            <div
              key={b.id}
              className="av2-pane"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--a-s3)',
              }}
            >
              <div className="min-w-0">
                <p
                  className="a-num"
                  style={{
                    margin: 0,
                    fontSize: 'var(--a-text-sm)',
                    fontWeight: 500,
                    color: 'var(--a-text)',
                  }}
                >
                  {b.e164 ?? b.phoneLast10}
                </p>
                <p
                  className="truncate"
                  style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                >
                  {b.reason ?? '—'} · {b.blockedBy ?? '—'} · {blockedOnById[b.id] ?? '—'}
                </p>
                {b.note && (
                  <p
                    className="truncate"
                    style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                  >
                    {b.note}
                  </p>
                )}
              </div>
              <Button
                variant="danger"
                className="shrink-0"
                disabled={isPending}
                onClick={() => remove(b.e164, b.phoneLast10)}
              >
                Unblock
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Blocked numbers grid (md+) */}
      <div className="hidden md:block">
        <div className="av2-rgrid__scroll" role="group" tabIndex={0} aria-label="Blocked numbers">
          <div className="av2-rgrid" role="table" aria-label="Blocked numbers" style={gridStyle}>
            <div className="av2-rgrid__head" role="row">
              <span role="columnheader" className="av2-rgrid__h">
                Number
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Reason
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Blocked by
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Note
              </span>
              <span role="columnheader" className="av2-rgrid__h">
                Blocked on
              </span>
              <span role="columnheader" className="av2-rgrid__h" style={{ textAlign: 'right' }}>
                Actions
              </span>
            </div>

            {blocked.length === 0 ? (
              <div className="av2-rgrid__empty" role="row">
                <span role="cell">{emptyCopy}</span>
              </div>
            ) : (
              blocked.map((b) => (
                <div key={b.id} role="row" className="av2-rgrid__row">
                  <span
                    role="cell"
                    data-label="Number"
                    className="av2-rgrid__c av2-rgrid__c--n"
                    style={{ fontWeight: 500, color: 'var(--a-text)' }}
                  >
                    {b.e164 ?? b.phoneLast10}
                  </span>
                  <span role="cell" data-label="Reason" className="av2-rgrid__c">
                    {b.reason ?? '—'}
                  </span>
                  <span role="cell" data-label="Blocked by" className="av2-rgrid__c">
                    {b.blockedBy ?? '—'}
                  </span>
                  <span role="cell" data-label="Note" className="av2-rgrid__c">
                    {b.note ?? '—'}
                  </span>
                  <span
                    role="cell"
                    data-label="Blocked on"
                    className="av2-rgrid__c av2-rgrid__c--n"
                  >
                    {blockedOnById[b.id] ?? '—'}
                  </span>
                  <span
                    role="cell"
                    data-label="Actions"
                    className="av2-rgrid__c"
                    style={{ textAlign: 'right' }}
                  >
                    <Button
                      variant="danger"
                      disabled={isPending}
                      onClick={() => remove(b.e164, b.phoneLast10)}
                    >
                      Unblock
                    </Button>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
