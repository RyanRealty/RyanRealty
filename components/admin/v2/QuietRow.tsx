import './admin-v2.css'

/** Pattern 3 (quiet half) — healthy things earn near-zero visual weight. */
export function QuietRow({ name, state = 'OK', figure }: { name: string; state?: string; figure?: string }) {
  return (
    <li className="av2-quiet">
      <span className="av2-quiet__name">{name}</span>
      <span className="av2-quiet__ok">{state}</span>
      {figure ? <span className="av2-quiet__fig">{figure}</span> : null}
    </li>
  )
}
