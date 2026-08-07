/**
 * EntityTitle — the h1 of an ENTITY page, and the only sanctioned h1 in the
 * admin.
 *
 * ADMIN_UI.md §3 acceptance bar rule 1 bans page-title chrome: the nav names
 * the page, so a standalone heading above the verdict is wasted height. The one
 * exception it grants is an entity page, where the heading is the entity's own
 * name — that is content, not chrome.
 *
 * This primitive exists because that exception had no home. Every migrated
 * entity page (people/[id], newsletters/[id], and the [id]/[slug] pages behind
 * deals · bpo · cmas · import) was independently hand-rolling a raw <h1> with
 * the same three inline styles, which is both a ci:admin-ui rule-A violation
 * and the start of five different title treatments.
 */
export function EntityTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ fontSize: 'var(--a-text-xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>
      {children}
    </h1>
  )
}
