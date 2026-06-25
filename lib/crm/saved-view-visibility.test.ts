import { describe, it, expect } from 'vitest'
import {
  isOwnView,
  isSystemView,
  canSeeView,
  canEditView,
  refuseSavedViewDelete,
  type SavedViewVisibilityRow,
} from './saved-view-visibility'
import type { ScopeAccess } from '@/lib/crm/scope'

const matt = { role: 'superuser' as const, brokerSlug: 'matt' as const, email: 'matt@ryan-realty.com' }
const rebecca = { role: 'broker' as const, brokerSlug: 'rebecca' as const, email: 'rebeccapeterson@ryan-realty.com' }
const paul = { role: 'broker' as const, brokerSlug: 'paul' as const, email: 'paul@ryan-realty.com' }

const systemView: SavedViewVisibilityRow & { name: string } = {
  name: 'Leads',
  ownerEmail: null,
  isShared: true,
  isProtected: true,
}
const rebeccaPrivate: SavedViewVisibilityRow & { name: string } = {
  name: 'My Buyers',
  ownerEmail: 'rebeccapeterson@ryan-realty.com',
  isShared: false,
  isProtected: false,
}
const rebeccaShared: SavedViewVisibilityRow & { name: string } = {
  name: 'Shared Buyers',
  ownerEmail: 'rebeccapeterson@ryan-realty.com',
  isShared: true,
  isProtected: false,
}

describe('isSystemView / isOwnView', () => {
  it('system view has no owner', () => {
    expect(isSystemView(systemView)).toBe(true)
    expect(isSystemView(rebeccaPrivate)).toBe(false)
  })
  it('isOwnView is case-insensitive and requires a present owner', () => {
    expect(isOwnView(rebeccaPrivate, 'rebeccapeterson@ryan-realty.com')).toBe(true)
    expect(isOwnView(rebeccaPrivate, 'REBECCAPETERSON@RYAN-REALTY.COM')).toBe(true)
    expect(isOwnView(rebeccaPrivate, 'paul@ryan-realty.com')).toBe(false)
    expect(isOwnView(systemView, 'matt@ryan-realty.com')).toBe(false) // no owner
  })
})

describe('canSeeView — visibility (own + shared + system)', () => {
  it('superuser sees every view', () => {
    expect(canSeeView(systemView, matt)).toBe(true)
    expect(canSeeView(rebeccaPrivate, matt)).toBe(true)
    expect(canSeeView(rebeccaShared, matt)).toBe(true)
  })
  it('everyone sees a system view', () => {
    expect(canSeeView(systemView, rebecca)).toBe(true)
    expect(canSeeView(systemView, paul)).toBe(true)
  })
  it('everyone sees a shared view', () => {
    expect(canSeeView(rebeccaShared, paul)).toBe(true)
  })
  it('the owner sees their own private view', () => {
    expect(canSeeView(rebeccaPrivate, rebecca)).toBe(true)
  })
  it('another broker CANNOT see someone else private view', () => {
    expect(canSeeView(rebeccaPrivate, paul)).toBe(false)
  })
})

describe('canEditView — own or superuser only', () => {
  it('superuser may edit any view', () => {
    expect(canEditView(systemView, matt)).toBe(true)
    expect(canEditView(rebeccaPrivate, matt)).toBe(true)
  })
  it('the owner may edit their own view', () => {
    expect(canEditView(rebeccaPrivate, rebecca)).toBe(true)
    expect(canEditView(rebeccaShared, rebecca)).toBe(true)
  })
  it('a non-owner non-superuser may NOT edit', () => {
    expect(canEditView(rebeccaPrivate, paul)).toBe(false)
    expect(canEditView(rebeccaShared, paul)).toBe(false)
    // a system view is not editable by a restricted broker (only superuser Matt)
    expect(canEditView(systemView, rebecca)).toBe(false)
  })
})

describe('refuseSavedViewDelete — protected refusal + auth', () => {
  it('refuses a protected (system) view for everyone, including the superuser', () => {
    expect(refuseSavedViewDelete(systemView, matt)).toEqual({
      ok: false,
      error: 'Leads is a protected list and cannot be deleted',
    })
    expect(refuseSavedViewDelete(systemView, rebecca).ok).toBe(false)
  })
  it('allows the owner to delete their own non-protected view', () => {
    expect(refuseSavedViewDelete(rebeccaPrivate, rebecca)).toEqual({ ok: true })
  })
  it('allows a superuser to delete a non-protected broker view', () => {
    expect(refuseSavedViewDelete(rebeccaPrivate, matt)).toEqual({ ok: true })
  })
  it('refuses a non-owner from deleting a non-protected view', () => {
    expect(refuseSavedViewDelete(rebeccaPrivate, paul)).toEqual({
      ok: false,
      error: 'Not authorized to delete this list',
    })
  })
})
