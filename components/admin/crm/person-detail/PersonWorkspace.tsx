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
  desktopChrome,
  kickoff,
}: {
  /** 390px verification frame (?view=mobile) — automation browsers can't shrink below 768px. */
  forceMobile?: boolean
  mobile: ReactNode
  desktop: ReactNode
  /** tools route identity (Person chip + EntityTitle) — desktop only. Must not
      sit above the mobile `-mt-5` full-bleed or glyph tops clip into black slivers. */
  desktopChrome?: ReactNode
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
      {desktopChrome ? <div className="hidden md:block">{desktopChrome}</div> : null}
      {/* Mobile layout (< md) — full-bleed: cancel ConsoleShell main
          `px-4 pt-5 pb-24`. Desktop identity chrome is `desktopChrome` above
          (hidden md:block); Person chip on phone lives inside MobileContactDetail. */}
      <div className="-mx-4 -mt-5 -mb-24 md:hidden">{mobile}</div>
      <div className="hidden md:block">{desktop}</div>
    </>
  )
}
