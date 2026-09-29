import './admin-v2.css'

export interface ThreadBubbleProps {
  direction: 'in' | 'out'
  channel?: 'SMS' | 'Email'
  /** CMA thread label, shown as written ("CMA sent"). Not uppercased. */
  label?: string | null
  /** Timestamp + delivery state, e.g. "4:12 PM · delivered". */
  stamp?: string
  children: React.ReactNode
}

/** Pattern 2 — thread message. Parent supplies the flex column; history sits above a fixed composer. */
export function ThreadBubble({ direction, channel, label, stamp, children }: ThreadBubbleProps) {
  return (
    <div className={`av2-bubble av2-bubble--${direction}`}>
      <div className="av2-bubble__txt">{children}</div>
      {label || channel || stamp ? (
        <div className="av2-bubble__stamp">
          {label ? <span className="av2-bubble__cma">{label}</span> : null}
          {channel ? <span className="av2-bubble__chan">{channel}</span> : null}
          {stamp ? <span>{stamp}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
