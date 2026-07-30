/**
 * Source contracts for the consumer alert manager
 * (app/account/saved-searches), in the merge-lock style of
 * components/search/__tests__ — no account-page render harness exists (and
 * vitest does not include app/account), so these lock the key affordances at
 * the source level instead:
 *
 * 1. All six typed-event toggles render, with the agreed plain labels.
 * 2. The weekly day-of-week chips cover Sun–Sat and write through
 *    setAlertScheduleDaysAction.
 * 3. The household-recipients editor adds/removes through the owner-gated
 *    actions.
 * 4. SavedSearchControls mounts AlertPreferences and anchors each card with
 *    id="alert-<id>" — the target getAlertManageUrl links to.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EVENT_TYPES } from './event-detection'
import { EVENT_TOGGLE_LABELS, DAY_CHIP_LABELS } from '@/app/account/saved-searches/AlertPreferences'

const prefsSource = readFileSync(
  join(process.cwd(), 'app/account/saved-searches/AlertPreferences.tsx'),
  'utf8',
)
const controlsSource = readFileSync(
  join(process.cwd(), 'app/account/saved-searches/SavedSearchControls.tsx'),
  'utf8',
)

describe('event toggles', () => {
  it('renders every engine event type exactly once', () => {
    expect(EVENT_TOGGLE_LABELS.map((e) => e.type).sort()).toEqual([...EVENT_TYPES].sort())
  })

  it('uses the agreed plain labels', () => {
    const byType = Object.fromEntries(EVENT_TOGGLE_LABELS.map((e) => [e.type, e.label]))
    expect(byType).toEqual({
      new: 'New listings',
      price_change: 'Price changes',
      status_change: 'Pending',
      back_on_market: 'Back on market',
      sold: 'Sold',
      open_house: 'Open houses',
    })
  })

  it('the switches dispatch through the owner-gated events action', () => {
    expect(prefsSource).toContain('setAlertEventsAction')
    expect(prefsSource).toContain('<Switch')
  })
})

describe('weekly day-of-week chips', () => {
  it('covers Sun through Sat in day-number order', () => {
    expect([...DAY_CHIP_LABELS]).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })

  it('writes through setAlertScheduleDaysAction and only shows for weekly', () => {
    expect(prefsSource).toContain('setAlertScheduleDaysAction')
    expect(prefsSource).toContain("cadence === 'weekly'")
  })
})

describe('household recipients editor', () => {
  it('adds and removes through the owner-gated recipient actions', () => {
    expect(prefsSource).toContain('addAlertRecipientAction')
    expect(prefsSource).toContain('removeAlertRecipientAction')
  })
})

describe('manager page wiring', () => {
  it('SavedSearchControls mounts AlertPreferences on every card', () => {
    expect(controlsSource).toContain('<AlertPreferences')
    expect(controlsSource).toMatch(/import AlertPreferences from '\.\/AlertPreferences'/)
  })

  it('each card carries the alert-<id> anchor getAlertManageUrl targets', () => {
    expect(controlsSource).toContain('id={`alert-${search.id}`}')
  })
})
