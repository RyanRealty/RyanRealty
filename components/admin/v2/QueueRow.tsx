import './admin-v2.css'
import { StateWord, type AdminState } from './StateWord'

export interface QueueRowProps {
  /** Kind chip: short uppercase word (Reply, Approve, CMA ready, Parked…). */
  kind: string
  kindTone?: AdminState
  title: React.ReactNode
  context?: React.ReactNode
  /** Age text, tabular ("3h", "1d", "today"). */
  age?: string
  /** Ages past the SLA render hot (danger). */
  hot?: boolean
  /** The row's ONE primary action (a Button); overflow lives inside it if needed. */
  action?: React.ReactNode
}

/** Pattern 1 — queue row: phone-first stack, single line ≥1024px. */
export function QueueRow({ kind, kindTone = 'accent', title, context, age, hot = false, action }: QueueRowProps) {
  return (
    <li className="av2-qrow">
      <span className="av2-qrow__kind">
        <StateWord state={kindTone}>{kind}</StateWord>
      </span>
      <div className="av2-qrow__body">
        <div className="av2-qrow__title">{title}</div>
        {context ? <div className="av2-qrow__ctx">{context}</div> : null}
      </div>
      {age ? <span className={`av2-qrow__age${hot ? ' av2-qrow__age--hot' : ''}`}>{age}</span> : null}
      {action ? <span className="av2-qrow__act">{action}</span> : null}
    </li>
  )
}
