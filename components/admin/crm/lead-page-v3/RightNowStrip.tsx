import type { PersonRightNow } from '@/lib/data/crm/person-right-now'
import { CloseReplyTasks } from './CloseReplyTasks'

export function RightNowStrip(props: {
  strip: PersonRightNow
  completeReplyTasks?: (taskId: number, formData: FormData) => Promise<void>
}) {
  const msg = props.strip.lastMessage
  return (
    <section
      aria-label="Right now"
      className="lead-v3-now"
      style={{
        marginTop: 14,
        display: 'grid',
        gridTemplateColumns: '1.1fr 2fr 1fr',
        background: 'var(--a-text)',
        color: 'var(--a-bg)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 20px', borderRight: '1px solid color-mix(in oklab, var(--a-bg) 18%, transparent)' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>
          Last activity
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{props.strip.lastActivity.title}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{props.strip.lastActivity.detail}</div>
      </div>
      <div style={{ padding: '14px 20px', borderRight: '1px solid color-mix(in oklab, var(--a-bg) 18%, transparent)' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>
          Last message{msg ? ` · ${msg.channel === 'sms' ? 'SMS' : msg.channel === 'email' ? 'Email' : 'Call'} · ${msg.direction}` : ''}
        </div>
        <div style={{ fontSize: 14 }}>{msg ? `“${msg.preview}”` : 'No messages yet.'}</div>
        {msg ? <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{msg.detail}</div> : null}
      </div>
      <div style={{ padding: '14px 20px' }}>
        <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 }}>
          Next step
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{props.strip.nextStep.title}</div>
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>
          {props.strip.nextStep.detail}
          {props.strip.nextStep.closeTaskIds.length > 0 && props.completeReplyTasks ? (
            <>
              {' · '}
              <CloseReplyTasks ids={props.strip.nextStep.closeTaskIds} completeTask={props.completeReplyTasks} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
