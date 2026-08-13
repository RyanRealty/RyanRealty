import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
} from '@/components/site/v3'

/**
 * Shared chrome for /account/*. Saved is an affordance, not a destination:
 * layout already mounts V3Chrome, this frame opens the v3 token scope on
 * <main> and places V3Footer outside it. Pages do not remount the header.
 */
export function AccountFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 sm:pb-10">{children}</div>
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
