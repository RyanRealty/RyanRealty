/**
 * lib/agent/tools/gmail-assets.ts — the two tools this rung adds to the
 * broker SMS agent's tool set: `email_search` (R2.5) and `fetch_assets`
 * (R2.6 ladder + R2.7 ingest + R2.8 MMS-in).
 *
 * docs/plans/BROKER_SMS_AGENT_2026-07-31.md Amendment — the naive-broker
 * scenario ("photos back from Rich, make marketing materials"). Every
 * handler receives its own `ctx: AgentContext` argument per
 * lib/agent/types.ts's AgentTool contract; that ctx — not anything the
 * factory closed over, and never anything from tool input — is what scopes
 * the Gmail impersonation and the ingest's broker attribution. No input
 * field on either tool accepts a mailbox override.
 */

import type { AgentContext, AgentCitation, AgentTool, ToolOutcome } from '@/lib/agent/types'
import { searchBrokerEmail, fetchAttachment, getMessageDetail } from '@/lib/agent/gmail'
import { classifyLink, downloadUrl, extractZip, ingestShoot, mimeFromExtension, type ShootFileInput } from '@/lib/agent/assets'

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []
}

function asLatLng(v: unknown): { lat: number; lng: number } | undefined {
  if (!v || typeof v !== 'object') return undefined
  const obj = v as Record<string, unknown>
  const lat = Number(obj.lat)
  const lng = Number(obj.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined
}

const EMAIL_SEARCH_INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    senderHint: {
      type: 'string',
      description: 'Sender name, name fragment, or domain to search for (e.g. "Rich", "the photographer", "thegarnergroup.com").',
    },
    textHint: {
      type: 'string',
      description: 'A phrase likely to appear in the subject or body (e.g. "photos", "gallery").',
    },
    newerThanDays: {
      type: 'number',
      description: 'How many days back to search. Default 30.',
    },
    hasAttachment: {
      type: 'boolean',
      description: 'Restrict to messages carrying at least one attachment.',
    },
  },
}

const FETCH_ASSETS_INPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    messageId: {
      type: 'string',
      description: 'A messageId returned by a prior email_search call, when pulling attachments from it.',
    },
    attachmentIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'attachmentId values (from email_search candidates) to download from `messageId`.',
    },
    links: {
      type: 'array',
      items: { type: 'string' },
      description: 'Direct-download / Dropbox / WeTransfer / gallery URLs found in the email body or texted by the broker.',
    },
    propertyLabel: {
      type: 'string',
      description: 'Address or short label identifying which property these assets belong to (confirmed with the broker first).',
    },
    propertyLatLng: {
      type: 'object',
      properties: { lat: { type: 'number' }, lng: { type: 'number' } },
      description: 'Known property coordinates, when available, for the GPS-outlier check. Omit to let ingest resolve it from the listings table.',
    },
  },
  required: ['propertyLabel'],
}

/**
 * Builds the two Gmail/asset tools for one broker turn. `ctx` here is used
 * only to personalize tool descriptions (e.g. naming the broker's own
 * mailbox) — the actual Gmail impersonation and ingest attribution always
 * comes from the `ctx` argument the runtime passes into each handler call,
 * per the AgentTool contract in lib/agent/types.ts.
 */
export function gmailAssetTools(ctx: AgentContext): AgentTool[] {
  return [
    {
      name: 'email_search',
      description:
        `Search ${ctx.brokerEmail}'s own Gmail (structurally scoped — this can never read another broker's mailbox). ` +
        `Returns candidate messages (from, subject, date, attachments, links found in the body) for you to confirm back ` +
        `with the broker before downloading anything. Use this when a broker mentions an email, a sender by name, or ` +
        `"photos I got from <person>".`,
      input_schema: EMAIL_SEARCH_INPUT_SCHEMA,
      handler: async (input: Record<string, unknown>, runCtx: AgentContext): Promise<ToolOutcome> => {
        const result = await searchBrokerEmail(runCtx, {
          senderHint: asString(input.senderHint),
          textHint: asString(input.textHint),
          newerThanDays: typeof input.newerThanDays === 'number' ? input.newerThanDays : undefined,
          hasAttachment: typeof input.hasAttachment === 'boolean' ? input.hasAttachment : undefined,
        })
        return {
          result: {
            mailbox: result.mailbox,
            query: result.query,
            candidates: result.candidates.map((c) => ({
              messageId: c.messageId,
              from: c.from,
              subject: c.subject,
              date: c.date,
              attachments: c.attachments,
              links: c.links,
            })),
          },
        }
      },
    },
    {
      name: 'fetch_assets',
      description:
        'Pulls asset bytes (Gmail attachments and/or links) through the fetch ladder — direct files, Dropbox (rewritten for ' +
        'direct download), WeTransfer, zip extraction — then ingests every image/video into the property-shoot pipeline: ' +
        'hash-dedupe, EXIF capture date + GPS outlier check, upload, vision grading, and an asset_library row per file. ' +
        'Gallery-platform links (Aryeo, HDPhotoHub, Rela, TourFactory, Spiro) cannot be auto-fetched — those come back as ' +
        'manualFallbacks with the exact ask-the-broker instruction. Always confirm propertyLabel with the broker first.',
      input_schema: FETCH_ASSETS_INPUT_SCHEMA,
      handler: async (input: Record<string, unknown>, runCtx: AgentContext): Promise<ToolOutcome> => {
        const propertyLabel = asString(input.propertyLabel)
        if (!propertyLabel) {
          return { result: { ok: false, error: 'propertyLabel is required — confirm the property with the broker first.' } }
        }

        const messageId = asString(input.messageId)
        const attachmentIds = asStringArray(input.attachmentIds)
        const links = asStringArray(input.links)
        const propertyLatLng = asLatLng(input.propertyLatLng)

        const files: ShootFileInput[] = []
        const manualFallbacks: Array<{ url: string; platform: string; instruction: string }> = []
        const failedLinks: Array<{ url: string; error: string }> = []

        if (messageId && attachmentIds.length) {
          let detail: Awaited<ReturnType<typeof getMessageDetail>> | null = null
          try {
            detail = await getMessageDetail(runCtx, messageId)
          } catch (err) {
            return {
              result: {
                ok: false,
                error: `could not load message ${messageId}: ${err instanceof Error ? err.message : String(err)}`,
              },
            }
          }
          for (const attachmentId of attachmentIds) {
            const meta = detail.attachments.find((a) => a.attachmentId === attachmentId)
            try {
              const buffer = await fetchAttachment(runCtx, messageId, attachmentId)
              files.push({
                name: meta?.filename ?? `attachment-${attachmentId}`,
                buffer,
                mime: meta?.mime ?? 'application/octet-stream',
              })
            } catch (err) {
              failedLinks.push({
                url: `gmail-attachment:${attachmentId}`,
                error: err instanceof Error ? err.message : String(err),
              })
            }
          }
        }

        for (const link of links) {
          const classified = classifyLink(link)
          if (classified.kind === 'manual') {
            manualFallbacks.push({ url: link, platform: classified.platform, instruction: classified.instruction })
            continue
          }
          const targetUrl = classified.kind === 'dropbox' ? classified.url : link
          const downloaded = await downloadUrl(targetUrl)
          if (!downloaded.ok) {
            failedLinks.push({ url: link, error: downloaded.error })
            continue
          }
          const looksLikeZip = downloaded.contentType.toLowerCase().includes('zip') || /\.zip($|\?)/i.test(link)
          if (looksLikeZip) {
            try {
              const extracted = await extractZip(downloaded.buffer)
              for (const ex of extracted) {
                files.push({ name: ex.name, path: ex.path, mime: mimeFromExtension(ex.name) })
              }
            } catch (err) {
              failedLinks.push({ url: link, error: err instanceof Error ? err.message : String(err) })
            }
          } else {
            files.push({
              name: downloaded.filename ?? link.split('/').filter(Boolean).pop() ?? 'file',
              buffer: downloaded.buffer,
              mime: downloaded.contentType,
            })
          }
        }

        if (!files.length) {
          return {
            result: {
              ok: manualFallbacks.length > 0 || failedLinks.length > 0,
              ingested: 0,
              skipped: 0,
              outliers: [],
              gradeCounts: {},
              manualFallbacks,
              failedLinks,
            },
          }
        }

        const sourceLabel = messageId
          ? `gmail:${runCtx.brokerEmail} message ${messageId}`
          : links[0]
            ? `link:${links[0]}`
            : undefined

        const summary = await ingestShoot(runCtx, { propertyLabel, files, propertyLatLng, sourceLabel })

        const citations: AgentCitation[] = []
        if (messageId) {
          citations.push({ figure: String(summary.ingested), source: `gmail:${runCtx.brokerEmail} message ${messageId}` })
        }
        for (const link of links) {
          citations.push({ figure: String(summary.ingested), source: `link:${link}` })
        }
        if (summary.outliers.length) {
          citations.push({
            figure: String(summary.outliers.length),
            source: 'EXIF GPS vs. listing coordinates, >150m threshold (lib/agent/assets.ts ingestShoot)',
          })
        }

        return {
          result: { ok: true, ...summary, manualFallbacks, failedLinks },
          citations,
        }
      },
    },
  ]
}
