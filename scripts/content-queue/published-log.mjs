/**
 * Content-queue publish log. One row per content item + channel + PT date.
 * The unique key makes a duplicate publish impossible; the daily run uses
 * absence of a row to catch up a missed day.
 */
export function ptDate(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(d)
}

export function scheduledPtDate(scheduledAt) {
  const t = Date.parse(scheduledAt)
  if (Number.isNaN(t)) return null
  return ptDate(new Date(t))
}

/** Today-only, or every scheduled PT date on or before today (catch-up). */
export function isDue({ scheduledAt, today, catchUp = false }) {
  const d = scheduledPtDate(scheduledAt)
  if (!d) return false
  return catchUp ? d <= today : d === today
}

export function slotKey({ item, channel, date }) {
  return `${item}\t${channel}\t${date}`
}

export function claimSlot(published, key) {
  if (published.has(key)) return { ok: false, reason: 'already published' }
  published.add(key)
  return { ok: true }
}

export function releaseSlot(published, key) {
  published.delete(key)
}

export function selectDue(drafts, { today, catchUp, published }) {
  return drafts.filter((d) => {
    if (!isDue({ scheduledAt: d.scheduledAt, today, catchUp })) return false
    const key = slotKey({ item: d.item, channel: d.channel, date: scheduledPtDate(d.scheduledAt) })
    return !published.has(key)
  })
}

function restHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

export async function loadPublishedKeys({ fetchImpl = fetch, url, key }) {
  if (!url || !key) return { keys: new Set(), error: null }
  const res = await fetchImpl(
    `${url.replace(/\/+$/, '')}/rest/v1/content_queue_published?select=content_item,channel,published_date`,
    { headers: restHeaders(key) },
  )
  if (res.status === 404) return { keys: new Set(), error: 'content_queue_published missing (apply supabase/migrations/20261014190000_content_queue_published.sql)' }
  if (!res.ok) return { keys: new Set(), error: `published log HTTP ${res.status}` }
  const rows = await res.json()
  const keys = new Set(
    (rows || []).map((r) => slotKey({ item: r.content_item, channel: r.channel, date: r.published_date })),
  )
  return { keys, error: null }
}

export async function insertPublished({ fetchImpl = fetch, url, key, row }) {
  if (!url || !key) return { ok: false, reason: 'published log not configured' }
  const res = await fetchImpl(`${url.replace(/\/+$/, '')}/rest/v1/content_queue_published`, {
    method: 'POST',
    headers: { ...restHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({
      content_item: row.item,
      channel: row.channel,
      published_date: row.date,
      status: row.status || 'claimed',
      remote_id: row.remoteId || null,
    }),
  })
  if (res.status === 409) return { ok: false, reason: 'already published' }
  if (!res.ok) return { ok: false, reason: `insert HTTP ${res.status}` }
  return { ok: true }
}

export async function markPublished({ fetchImpl = fetch, url, key, row }) {
  if (!url || !key) return { ok: false, reason: 'published log not configured' }
  const q = new URLSearchParams({
    content_item: `eq.${row.item}`,
    channel: `eq.${row.channel}`,
    published_date: `eq.${row.date}`,
  })
  const res = await fetchImpl(`${url.replace(/\/+$/, '')}/rest/v1/content_queue_published?${q}`, {
    method: 'PATCH',
    headers: { ...restHeaders(key), Prefer: 'return=minimal' },
    body: JSON.stringify({
      status: 'posted',
      remote_id: row.remoteId || null,
      posted_at: new Date().toISOString(),
    }),
  })
  if (!res.ok) return { ok: false, reason: `mark HTTP ${res.status}` }
  return { ok: true }
}

export async function deletePublished({ fetchImpl = fetch, url, key, row }) {
  if (!url || !key) return { ok: false, reason: 'published log not configured' }
  const q = new URLSearchParams({
    content_item: `eq.${row.item}`,
    channel: `eq.${row.channel}`,
    published_date: `eq.${row.date}`,
  })
  const res = await fetchImpl(`${url.replace(/\/+$/, '')}/rest/v1/content_queue_published?${q}`, {
    method: 'DELETE',
    headers: { ...restHeaders(key), Prefer: 'return=minimal' },
  })
  if (!res.ok) return { ok: false, reason: `delete HTTP ${res.status}` }
  return { ok: true }
}
