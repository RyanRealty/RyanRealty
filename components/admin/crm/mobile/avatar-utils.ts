/**
 * avatar-utils — pure (non-client) helpers for the FUB-style colorful avatars.
 *
 * Split out of CrmMobileKit (a 'use client' module) so SERVER components can
 * compute an avatar color/initials too. Calling a function exported from a
 * 'use client' file from the server throws ("Attempted to call X from the
 * server"). These have no client-only deps, so they live here and CrmMobileKit
 * re-exports them for client callers.
 *
 * The hex palette is the brand-external FUB avatar fill set (no token
 * equivalent) — this file is listed in .design-token-lint-ignore for that
 * reason, same as CrmMobileKit.
 */

export const AVATAR_COLORS = [
  '#b45309', '#dc2626', '#65a30d', '#0891b2', '#2563eb',
  '#7c3aed', '#db2777', '#475569', '#0d9488', '#ea580c',
  '#4f46e5', '#16a34a',
]

export function crmAvatarColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function crmInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
