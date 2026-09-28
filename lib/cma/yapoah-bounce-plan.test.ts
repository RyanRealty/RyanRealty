import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  backfillWritesEnabled,
  planYapoahBounceBackfill,
  type YapoahCmaRow,
  type YapoahSentEvent,
} from '@/lib/cma/yapoah-bounce-plan'

const SENT_AT = '2026-09-28T20:02:00.000Z'

function row(over: Partial<YapoahCmaRow> = {}): YapoahCmaRow {
  return {
    slug: 'cma-1109-yapoah-bend',
    status: 'delivered',
    deliveredAt: SENT_AT,
    clientEmail: 'buyer@example.com',
    personId: 42,
    buildSummary: { pricing: { recommended: 700000 }, judge_cache: { keptKeys: ['a'] } },
    ...over,
  }
}

function sent(over: Partial<YapoahSentEvent> = {}): YapoahSentEvent {
  return {
    recipientEmail: 'buyer@example.com',
    occurredAt: SENT_AT,
    transport: 'gmail',
    mailbox: 'matt@ryan-realty.com',
    messageId: 'gmail-1',
    emailKey: 'cma:cma-1109-yapoah-bend',
    ...over,
  }
}

describe('backfillWritesEnabled', () => {
  it('is dry-run unless --apply is present', () => {
    expect(backfillWritesEnabled([])).toBe(false)
    expect(backfillWritesEnabled(['--slug', 'cma-1109-yapoah'])).toBe(false)
    expect(backfillWritesEnabled(['--apply'])).toBe(true)
  })
})

describe('planYapoahBounceBackfill', () => {
  it('plans a merge that keeps the letter and does not clear the send', () => {
    const plan = planYapoahBounceBackfill(row(), [sent()])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.summary.pricing).toEqual({ recommended: 700000 })
    expect(plan.summary.judge_cache).toEqual({ keptKeys: ['a'] })
    expect(plan.summary.delivery).toMatchObject({
      status: 'bounced',
      enhanced_status: '5.1.1',
      smtp_code: '550',
      recipient: 'buyer@example.com',
    })
    expect(plan.summary).not.toHaveProperty('delivered_at')
    expect(plan.summary).not.toHaveProperty('html_path')
    expect(plan.lines.join('\n')).toMatch(/leave delivered_at=/)
    expect(plan.lines.join('\n')).toMatch(/event=bounce/)
    expect(plan.lines.join('\n')).toMatch(/kind=email_bounce/)
    expect(plan.lines.join('\n')).toMatch(/channel=email/)
  })

  it('refuses a slug, a day, a recipient, a transport, or a mailbox that does not match', () => {
    expect(planYapoahBounceBackfill(row({ slug: 'cma-other' }), [sent()]).ok).toBe(false)
    expect(planYapoahBounceBackfill(row({ deliveredAt: null, status: 'draft' }), [sent()]).ok).toBe(false)
    expect(planYapoahBounceBackfill(row({ deliveredAt: '2026-09-27T20:02:00.000Z' }), [sent()]).ok).toBe(false)
    expect(planYapoahBounceBackfill(row(), [sent({ recipientEmail: 'other@example.com' })]).ok).toBe(false)
    expect(planYapoahBounceBackfill(row(), [sent({ transport: 'resend' })]).ok).toBe(false)
    expect(planYapoahBounceBackfill(row(), [sent({ mailbox: 'other@ryan-realty.com' })]).ok).toBe(false)
    expect(
      planYapoahBounceBackfill(
        row({ buildSummary: { delivery: { status: 'bounced', at: SENT_AT } } }),
        [sent()],
      ).ok,
    ).toBe(false)
  })

  it('does not treat a bounce older than the current send as already done', () => {
    const plan = planYapoahBounceBackfill(
      row({
        deliveredAt: '2026-09-28T22:00:00.000Z',
        buildSummary: {
          pricing: { recommended: 700000 },
          delivery: { status: 'bounced', at: '2026-09-28T18:00:00.000Z' },
        },
      }),
      [sent({ occurredAt: '2026-09-28T22:00:00.000Z' })],
    )
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(Date.parse((plan.summary.delivery as { at: string }).at)).toBeGreaterThanOrEqual(
      Date.parse('2026-09-28T22:00:00.000Z'),
    )
  })

  it('allows a gmail send that did not record the mailbox', () => {
    const plan = planYapoahBounceBackfill(row({ personId: null }), [sent({ mailbox: null })])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.lines.join('\n')).toMatch(/crm_timeline: skip/)
  })
})

describe('the backfill script', () => {
  const src = readFileSync(join(process.cwd(), 'scripts/backfill-cma-yapoah-bounce.ts'), 'utf8')

  it('writes only behind --apply and does not clear delivered_at or send mail', () => {
    expect(src).toMatch(/backfillWritesEnabled/)
    expect(src).toMatch(/if \(!apply\) continue/)
    expect(src).toMatch(/DRY RUN/)
    expect(src).not.toMatch(/delivered_at:\s*null/)
    expect(src).not.toMatch(/sendEmail\s*\(/)
  })
})
