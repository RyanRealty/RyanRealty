/**
 * CardTitle — the heading of a bordered card or panel, one level below
 * EntityTitle and visually distinct from SectionHead (which is a small
 * uppercase lane label, not a title).
 *
 * This primitive exists for the same reason EntityTitle does: the
 * `fontSize: var(--a-text-lg); fontWeight: 600` treatment was being
 * hand-rolled at ~20 call sites across newsletters, listings, bpo, cmas and
 * the crm inbox. Card headings are real headings, so the primitive owns the
 * element and keeps ci:admin-ui rule A satisfied without anyone reaching for
 * `<div role="heading">`, which passes the gate while losing the semantics.
 *
 * `flush` drops the top margin for a title that is the first child of a
 * padded card.
 */
export function CardTitle({
  children,
  id,
  flush,
}: {
  children: React.ReactNode
  id?: string
  flush?: boolean
}) {
  return (
    <h2
      id={id}
      style={{
        fontSize: 'var(--a-text-lg)',
        fontWeight: 600,
        color: 'var(--a-text)',
        marginTop: flush ? 0 : undefined,
        marginBottom: 4,
      }}
    >
      {children}
    </h2>
  )
}
