/**
 * Shared listing Sheet heading. Pass heading={false} to fold the block
 * under a parent job so two H2s do not claim the same work.
 */
export function ListingSectionHead({
  heading,
  eyebrow,
}: {
  heading?: string | false
  eyebrow?: string
}) {
  if (heading === false || !heading) return null
  return (
    <div className="sec-head">
      <div>
        {eyebrow ? <div className="eyebrow sec-index">{eyebrow}</div> : null}
        <h2 className="sec-title display">{heading}</h2>
      </div>
    </div>
  )
}
