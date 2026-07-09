/**
 * Stored outbound attachments on a timeline bubble.
 *
 * Outbound email attachments (payload.attachments) and outbound 1:1/broadcast
 * MMS media (payload.media entries carrying a storage `path`) live in the
 * private crm-files bucket and are served by /api/admin/crm/attachment.
 * Inbound MMS + outbound GROUP media render via Twilio sids instead (the
 * mediaOf helpers in the thread components) — those payload entries carry a
 * `mediaSid`, never a `path`, so the two renderers never double-draw.
 */

export type StoredAttachment = { path: string; name: string; contentType: string }

const PATH_RE = /^(email|mms)\/person-\d+\/\d+-[\w.\-]+$/

export function storedAttachmentsOf(payload: Record<string, unknown> | null | undefined): StoredAttachment[] {
  if (!payload) return []
  const source = [
    ...(Array.isArray(payload.attachments) ? payload.attachments : []),
    ...(Array.isArray(payload.media) ? payload.media : []),
  ]
  return source.flatMap((entry) => {
    const e = entry as { path?: unknown; name?: unknown; contentType?: unknown }
    const path = typeof e.path === 'string' ? e.path : ''
    if (!PATH_RE.test(path)) return []
    const name = typeof e.name === 'string' && e.name ? e.name : path.split('/').pop() ?? 'attachment'
    const contentType = typeof e.contentType === 'string' ? e.contentType : 'application/octet-stream'
    return [{ path, name, contentType }]
  })
}

/** Twilio-sid media (inbound MMS + outbound group texts) → admin MMS proxy URLs. */
export function twilioMediaOf(payload: Record<string, unknown> | null | undefined): Array<{ messageSid: string; mediaSid: string; contentType: string }> {
  if (!payload) return []
  const sid = typeof payload.sid === 'string' ? payload.sid : typeof payload.messageSid === 'string' ? payload.messageSid : ''
  // MM/SM = classic MMS; IM = Conversations group-text media (same proxy route).
  if (!/^(MM|SM|IM)[a-f0-9]{32}$/.test(sid)) return []
  const arr = Array.isArray(payload.media) ? payload.media : []
  return arr.flatMap((m) => {
    const mm = m as { mediaSid?: unknown; contentType?: unknown }
    const mediaSid = typeof mm.mediaSid === 'string' ? mm.mediaSid : ''
    if (!/^ME[a-f0-9]{32}$/.test(mediaSid)) return []
    return [{ messageSid: sid, mediaSid, contentType: typeof mm.contentType === 'string' ? mm.contentType : 'application/octet-stream' }]
  })
}

/**
 * Every attachment a timeline event carries — Twilio-sid media AND stored
 * outbound files — as one strip. For surfaces that don't already render
 * mediaOf themselves (person-detail EventCard).
 */
export function TimelineMediaStrip(props: { payload: Record<string, unknown> | null | undefined }) {
  const twilio = twilioMediaOf(props.payload)
  const stored = storedAttachmentsOf(props.payload)
  if (!twilio.length && !stored.length) return null
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {twilio.map((m) => {
        const src = `/api/admin/crm/mms/${m.messageSid}/${m.mediaSid}`
        return m.contentType.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={m.mediaSid} href={src} target="_blank" rel="noopener noreferrer">
            <img src={src} alt="MMS attachment" className="h-28 w-28 rounded-lg border border-border object-cover" loading="lazy" />
          </a>
        ) : (
          <a key={m.mediaSid} href={src} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
            📎 attachment
          </a>
        )
      })}
      {stored.map((a) => {
        const src = `/api/admin/crm/attachment?path=${encodeURIComponent(a.path)}`
        return a.contentType.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={a.path} href={src} target="_blank" rel="noopener noreferrer">
            <img src={src} alt={a.name} className="h-28 w-28 rounded-lg border border-border object-cover" loading="lazy" />
          </a>
        ) : (
          <a key={a.path} href={src} target="_blank" rel="noopener noreferrer" className="max-w-56 truncate rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted">
            📎 {a.name}
          </a>
        )
      })}
    </div>
  )
}

export function StoredAttachmentStrip(props: {
  payload: Record<string, unknown> | null | undefined
  align: 'start' | 'end'
}) {
  const items = storedAttachmentsOf(props.payload)
  if (!items.length) return null
  return (
    <div className={`mt-1 flex max-w-xs flex-wrap gap-1.5 sm:max-w-md ${props.align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {items.map((a) => {
        const src = `/api/admin/crm/attachment?path=${encodeURIComponent(a.path)}`
        return a.contentType.startsWith('image/') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <a key={a.path} href={src} target="_blank" rel="noopener noreferrer">
            <img src={src} alt={a.name} className="h-28 w-28 rounded-lg border border-border object-cover" loading="lazy" />
          </a>
        ) : (
          <a
            key={a.path}
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="max-w-56 truncate rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-muted"
          >
            📎 {a.name}
          </a>
        )
      })}
    </div>
  )
}
