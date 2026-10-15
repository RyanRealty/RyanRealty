import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_MOBILE_MAIN_PADDING,
  CMA_NAV_HREF,
  CMA_QUEUE_PAGE_READ_LIMIT,
  EMAIL_CAMPAIGNS_REDIRECT,
  isConsoleFabSuppressed,
  LISTINGS_DEFAULT_STATUS,
  listingsDalStatus,
  MESSAGES_DEFAULT_FOLDER,
  PROSPECTING_DEFAULT_STATUS,
  resolveListingsStatus,
  resolveMessagesFolder,
  resolveProspectingStatus,
} from './queue-defaults'

describe('admin queue defaults', () => {
  it('defaults prospecting to ready-to-send, not all', () => {
    expect(PROSPECTING_DEFAULT_STATUS).toBe('sendable')
    expect(resolveProspectingStatus(undefined)).toBe('sendable')
    expect(resolveProspectingStatus('')).toBe('sendable')
    expect(resolveProspectingStatus('all')).toBe('all')
    expect(resolveProspectingStatus('needs-audit')).toBe('needs-audit')
  })

  it('defaults messages to Needs attention (inbox)', () => {
    expect(MESSAGES_DEFAULT_FOLDER).toBe('inbox')
    expect(resolveMessagesFolder(undefined)).toBe('inbox')
    expect(resolveMessagesFolder('recent')).toBe('recent')
    expect(resolveMessagesFolder('inbox')).toBe('inbox')
  })

  it('defaults listings to Active and treats all as an opt-in', () => {
    expect(LISTINGS_DEFAULT_STATUS).toBe('Active')
    expect(resolveListingsStatus(undefined)).toBe('Active')
    expect(resolveListingsStatus('all')).toBe('all')
    expect(listingsDalStatus('Active')).toBe('Active')
    expect(listingsDalStatus('all')).toBeUndefined()
  })

  it('hides the global FAB on Valuations and the message composers', () => {
    expect(isConsoleFabSuppressed('/admin/valuations')).toBe(true)
    expect(isConsoleFabSuppressed('/admin/valuations/x')).toBe(true)
    expect(isConsoleFabSuppressed('/admin/messages')).toBe(true)
    expect(isConsoleFabSuppressed('/admin/crm')).toBe(false)
    expect(isConsoleFabSuppressed('/admin/today')).toBe(false)
  })

  it('keeps chrome constants the screens and the gate both read', () => {
    expect(ADMIN_MOBILE_MAIN_PADDING).toBe('pb-36')
    expect(CMA_NAV_HREF).toBe('/admin/valuations')
    expect(EMAIL_CAMPAIGNS_REDIRECT).toBe('/admin/audiences')
    expect(CMA_QUEUE_PAGE_READ_LIMIT).toBeLessThanOrEqual(250)
  })

  it('retries a failed CMA from Valuations without importing the send stack', () => {
    const retry = readFileSync(
      join(process.cwd(), 'app/admin/(protected)/valuations/RetryCmaForm.tsx'),
      'utf8',
    )
    expect(retry).toMatch(/from '@\/app\/actions\/cma-rebuild'/)
    expect(retry).not.toMatch(/from '@\/app\/actions\/cma-admin'/)
    const rebuild = readFileSync(join(process.cwd(), 'app/actions/cma-rebuild.ts'), 'utf8')
    expect(rebuild).not.toMatch(/from '@\/lib\/cma\/send'/)
    expect(rebuild).not.toMatch(/from '@\/app\/actions\/cma-admin'/)
  })
})
