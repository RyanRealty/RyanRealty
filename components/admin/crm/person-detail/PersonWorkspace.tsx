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
      {/* Mobile layout (< md) — full-bleed: cancel ConsoleShell main
          `px-4 pt-5 pb-24`. Do NOT put EntityTitle / route chrome above this
          wrapper on mobile — `-mt-5` pulls the detail header up into that
          chrome and clips glyph tops (black slivers). people/[id]/tools hides
          its desktop chrome at < md; Person chip lives inside MobileContactDetail. */}
      <div className="-mx-4 -mt-5 -mb-24 md:hidden">{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </>
  )
}
