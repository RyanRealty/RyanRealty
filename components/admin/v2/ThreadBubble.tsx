import './admin-v2.css'

export interface ThreadBubbleProps {
  direction: 'in' | 'out'
  channel?: 'SMS' | 'Email'
  /** Timestamp + delivery state, e.g. "4:12 PM · delivered". */
  stamp?: string
  children: React.ReactNode
}

/** Pattern 2 — thread message. Parent supplies the flex column; history sits above a fixed composer. */
export function ThreadBubble({ direction, channel, stamp, children }: ThreadBubbleProps) {
  return (
    <div className={`av2-bubble av2-bubble--${direction}`}>
      <div className="av2-bubble__txt">{children}</div>
      {channel || stamp ? (
        <div className="av2-bubble__stamp">
          {channel ? <span className="av2-bubble__chan">{channel}</span> : null}
          {stamp ? <span>{stamp}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
