/**
 * PersonWorkspace — ONE responsive surface for /admin/crm/[id] (spec-03 RC3).
 *
 * Owns the mobile (< md / ?view=mobile) and desktop (md+) layouts. The route
 * page is an identity shell + Suspense; this component is the single tree that
 * adapts by viewport. SendPanel mounts in both branches (via the nodes the
 * loader passes in).
 *
 * 11F: on the LOCKED admin v2 language — the 390px frame's hairline and fill
 * now come from var(--a-*). No structural or behavioural change.
 */

import type { ReactNode } from 'react'

export function PersonWorkspace({
  forceMobile = false,
  mobile,
  desktop,
  kickoff,
}: {
  /** 390px verification frame (?view=mobile) — automation browsers can't shrink below 768px. */
  forceMobile?: boolean
  mobile: ReactNode
  desktop: ReactNode
  kickoff?: ReactNode
}) {
  if (forceMobile) {
    return (
      <div
        className="mx-auto w-[390px] max-w-full overflow-hidden border-x"
        style={{ borderColor: 'var(--a-border)', background: 'var(--a-inset)' }}
      >
        {mobile}
        {kickoff}
      </div>
    )
  }

  return (
    <>
      {kickoff}
      {/* Mobile layout (< md) — cancel ConsoleShell main `px-4` + `pb-24`.
          Do NOT use `-mt-5` here: tools/page renders Person chip + EntityTitle
          above this tree, and pulling the detail header into that chrome clipped
          glyph tops into black slivers (mobile person Info crop). Shell `pt-5`
          stays as breathing room under that identity row. */}
      <div className="-mx-4 -mb-24 md:hidden">{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </>
  )
}
