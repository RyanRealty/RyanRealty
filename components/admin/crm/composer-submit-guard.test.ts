import { describe, expect, it } from 'vitest'
import { createSubmitGuard } from './composer-submit-guard'

function evt(draft = false) {
  let prevented = false
  return {
    preventDefault: () => {
      prevented = true
    },
    nativeEvent: { submitter: draft ? { hasAttribute: (n: string) => n === 'data-composer-draft' } : null },
    get prevented() {
      return prevented
    },
  }
}

describe('composer submit guard (Pain #2 — same-tick double-submit)', () => {
  it('admits the first submission and BLOCKS the same-tick second (the abort-each-other hang)', () => {
    const g = createSubmitGuard()
    const first = evt()
    const second = evt()
    expect(g.onSubmit(first)).toBe(true)
    expect(first.prevented).toBe(false)
    // Same tick: no settle has run — the second submission must be prevented,
    // otherwise its POST aborts the first and the composer hangs forever.
    expect(g.onSubmit(second)).toBe(false)
    expect(second.prevented).toBe(true)
  })

  it('releases on settle so the NEXT message can send', () => {
    const g = createSubmitGuard()
    expect(g.onSubmit(evt())).toBe(true)
    g.settle()
    expect(g.onSubmit(evt())).toBe(true)
  })

  it('records draft vs send from the submitter attribute (draft-save keeps the box)', () => {
    const g = createSubmitGuard()
    g.onSubmit(evt(true))
    expect(g.lastWasDraft).toBe(true)
    g.settle()
    g.onSubmit(evt(false))
    expect(g.lastWasDraft).toBe(false)
  })

  it('a save-draft in flight also blocks a same-tick send (one submission at a time)', () => {
    const g = createSubmitGuard()
    expect(g.onSubmit(evt(true))).toBe(true)
    const send = evt(false)
    expect(g.onSubmit(send)).toBe(false)
    expect(send.prevented).toBe(true)
  })

  it('sendSucceeded: no error at settle = success — including the inbox wrapper whose SUCCESS redirect changes the URL', () => {
    const g = createSubmitGuard()
    g.onSubmit(evt(), '?c=57607&m=sms')
    expect(g.sendSucceeded('?c=57607')).toBe(true) // inbox success redirect
    g.settle()
    g.onSubmit(evt(), '?tpl=blank')
    expect(g.sendSucceeded('?tpl=blank')).toBe(true) // person page: URL untouched
  })

  it('sendSucceeded: a STALE identical ?error from an earlier failure still reads as success (clears)', () => {
    const g = createSubmitGuard()
    g.onSubmit(evt(), '?error=old-failure')
    expect(g.sendSucceeded('?error=old-failure')).toBe(true)
  })

  it('sendSucceeded: a NEW or CHANGED error param = this send failed (keep the draft)', () => {
    const g = createSubmitGuard()
    g.onSubmit(evt(), '')
    expect(g.sendSucceeded('?error=suppressed')).toBe(false)
    g.settle()
    g.onSubmit(evt(), '?error=old-failure')
    expect(g.sendSucceeded('?error=quiet-hours')).toBe(false)
  })

  it('sendSucceeded is false when no search was captured (defensive default: keep)', () => {
    const g = createSubmitGuard()
    g.onSubmit(evt())
    expect(g.sendSucceeded('')).toBe(false)
  })
})
