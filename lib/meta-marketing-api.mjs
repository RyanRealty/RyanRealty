#!/usr/bin/env node
/**
 * Meta Marketing API client — Facebook + Instagram Lead-Gen ads.
 *
 * Covers the full lead-gen ad creation flow:
 *   uploadVideo → createCampaign → createAdSet → createLeadForm →
 *   createAdCreative → createAd → setAdStatus
 *
 * Special Ad Category HOUSING is REQUIRED on every campaign/ad set
 * (Fair Housing Act compliance). This is enforced by the API functions below —
 * callers cannot opt out.
 *
 * Auth: META_PAGE_TOKEN passed as access_token query param on every request.
 * API version: v18.0 (locked — bump only with explicit Meta migration).
 *
 * Required env vars (checked at first use — see requireEnv()):
 *   META_AD_ACCOUNT_ID  — format "act_<id>"
 *   META_PAGE_ID        — Ryan Realty FB page ID (also stored as META_FB_PAGE_ID)
 *   META_PAGE_ACCESS_TOKEN / META_PAGE_TOKEN — long-lived page access token
 *   META_FB_LEAD_FORM_TEMPLATE_ID — optional; used by lead-form-template.mjs
 */

import { createReadStream, statSync } from 'node:fs'
import { basename } from 'node:path'
import FormData from 'node:buffer' // polyfill note: Node 18+ has FormData globally

// ---------------------------------------------------------------------------
// Config / env
// ---------------------------------------------------------------------------

const API_BASE = 'https://graph.facebook.com/v18.0'

function requireEnv(name, ...aliases) {
  const names = [name, ...aliases]
  for (const n of names) {
    const v = process.env[n]?.trim()
    if (v) return v
  }
  const msg = `[meta-marketing-api] Missing required env var: ${names.join(' / ')}. ` +
    `Add to .env.local before running any ad creation command.`
  throw new MetaMarketingError(msg)
}

function normalizeAdAccountId(raw) {
  const v = raw.trim()
  if (/^\d+$/.test(v)) return `act_${v}`
  return v
}

function getConfig() {
  return {
    adAccountId: normalizeAdAccountId(requireEnv('META_AD_ACCOUNT_ID')),
    pageId: requireEnv('META_PAGE_ID', 'META_FB_PAGE_ID'),
    token: requireEnv('META_PAGE_ACCESS_TOKEN', 'META_PAGE_TOKEN'),
  }
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class MetaMarketingError extends Error {
  constructor(message, code, type, fbTraceId) {
    super(message)
    this.name = 'MetaMarketingError'
    this.code = code
    this.type = type
    this.fbTraceId = fbTraceId
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function apiGet(path, params = {}) {
  const { token } = getConfig()
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  return handleResponse(res)
}

async function apiPost(path, body) {
  const { token } = getConfig()
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

async function apiPatch(path, body) {
  const { token } = getConfig()
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString(), {
    method: 'POST', // Meta uses POST for updates via /<id>?method=PATCH or direct POST
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

async function handleResponse(res) {
  let data
  try {
    data = await res.json()
  } catch {
    if (!res.ok) throw new MetaMarketingError(`Meta API HTTP ${res.status}: ${res.statusText}`)
    return {}
  }
  if (data.error) {
    throw new MetaMarketingError(
      data.error.message ?? `Meta API error`,
      data.error.code,
      data.error.type,
      data.error.fbtrace_id
    )
  }
  if (!res.ok) {
    throw new MetaMarketingError(`Meta API HTTP ${res.status}: ${JSON.stringify(data)}`)
  }
  return data
}

// ---------------------------------------------------------------------------
// uploadVideo
// ---------------------------------------------------------------------------

/**
 * Upload a local video file to the ad account's video library.
 * Uses multipart/form-data upload (required for binary video).
 * Returns { id: string }.
 *
 * @param {string} localPath — absolute path to the MP4 file
 * @returns {Promise<{ id: string }>}
 */
export async function uploadVideo(localPath) {
  const { adAccountId, token } = getConfig()

  // Node 18+ has global FormData; Node < 18 needs node-fetch or undici.
  // We use native fetch (Node 18+) with a manual multipart body here.
  const fileStats = statSync(localPath)
  const fileSize = fileStats.size
  const fileName = basename(localPath)

  // Use the Node.js Blob + FormData (native in Node 18+)
  const { Blob } = await import('node:buffer')
  const { readFile } = await import('node:fs/promises')
  const fileBuffer = await readFile(localPath)
  const blob = new Blob([fileBuffer], { type: 'video/mp4' })

  const form = new globalThis.FormData()
  form.append('access_token', token)
  form.append('name', fileName)
  form.append('source', blob, fileName)

  const url = `${API_BASE}/${adAccountId}/advideos`
  const res = await fetch(url, { method: 'POST', body: form })
  const data = await handleResponse(res)

  if (!data.id) throw new MetaMarketingError('uploadVideo: no id returned')
  console.log(`[meta-marketing-api] Video uploaded: id=${data.id} (${fileName}, ${(fileSize / 1024 / 1024).toFixed(1)} MB)`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// createCampaign
// ---------------------------------------------------------------------------

/**
 * Create a Lead Generation campaign with HOUSING special ad category.
 *
 * @param {{ name: string }} params
 * @returns {Promise<{ id: string }>}
 */
export async function createCampaign({ name }) {
  const { adAccountId } = getConfig()

  const data = await apiPost(`/${adAccountId}/campaigns`, {
    name,
    objective: 'LEAD_GENERATION',
    special_ad_categories: ['HOUSING'], // Fair Housing Act compliance — non-negotiable
    buying_type: 'AUCTION',
    status: 'PAUSED',
  })

  if (!data.id) throw new MetaMarketingError('createCampaign: no id returned')
  console.log(`[meta-marketing-api] Campaign created: id=${data.id} name="${name}"`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// createAdSet
// ---------------------------------------------------------------------------

/**
 * Create an ad set under a campaign.
 *
 * @param {{
 *   campaign_id: string,
 *   name: string,
 *   daily_budget: number,       — in cents (e.g. 3000 = $30.00)
 *   targeting: object,
 *   start_time?: string,        — ISO8601
 *   end_time?: string,          — ISO8601
 * }} params
 * @returns {Promise<{ id: string }>}
 */
export async function createAdSet({
  campaign_id,
  name,
  daily_budget,
  targeting,
  start_time,
  end_time,
}) {
  const { adAccountId, pageId } = getConfig()

  const body = {
    campaign_id,
    name,
    optimization_goal: 'LEAD_GENERATION',
    billing_event: 'IMPRESSIONS',
    daily_budget: String(daily_budget), // Meta expects string cents
    targeting,
    promoted_object: { page_id: pageId },
    special_ad_categories: ['HOUSING'],
    status: 'PAUSED',
  }

  if (start_time) body.start_time = start_time
  if (end_time) body.end_time = end_time

  const data = await apiPost(`/${adAccountId}/adsets`, body)

  if (!data.id) throw new MetaMarketingError('createAdSet: no id returned')
  console.log(`[meta-marketing-api] Ad set created: id=${data.id} name="${name}" budget=${daily_budget} cents/day`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// createLeadForm
// ---------------------------------------------------------------------------

/**
 * Create a native FB lead form on the Page.
 *
 * @param {{
 *   name: string,
 *   questions: Array<{ type: string, key?: string, label?: string, options?: Array<{ value: string }> }>,
 *   privacy_policy: { url: string, link_text?: string },
 *   thank_you_page: { title: string, body?: string, button_text?: string, button_type?: string, website_url?: string }
 * }} params
 * @returns {Promise<{ id: string }>}
 */
export async function createLeadForm({ name, questions, privacy_policy, thank_you_page }) {
  const { pageId } = getConfig()

  const body = {
    name,
    questions,
    privacy_policy: {
      url: privacy_policy.url,
      link_text: privacy_policy.link_text || 'Privacy Policy',
    },
    thank_you_page: {
      title: thank_you_page.title,
      body: thank_you_page.body || '',
      button_text: thank_you_page.button_text || 'Visit our website',
      button_type: thank_you_page.button_type || 'VIEW_WEBSITE',
      website_url: thank_you_page.website_url || 'https://ryan-realty.com',
    },
    follow_up_action_url: thank_you_page.website_url || 'https://ryan-realty.com',
    // locale required by Meta API
    locale: 'EN_US',
  }

  const data = await apiPost(`/${pageId}/leadgen_forms`, body)

  if (!data.id) throw new MetaMarketingError('createLeadForm: no id returned')
  console.log(`[meta-marketing-api] Lead form created: id=${data.id} name="${name}"`)
  console.log(`  --> Add to .env.local: META_FB_LEAD_FORM_TEMPLATE_ID=${data.id}`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// createAdCreative
// ---------------------------------------------------------------------------

/**
 * Create an ad creative with video + copy + lead form CTA.
 *
 * @param {{
 *   video_id: string,
 *   page_id: string,
 *   primary_text: string,     — ≤125 chars for in-feed
 *   headline: string,         — ≤27 chars
 *   description?: string,     — ≤40 chars
 *   call_to_action: { type: string, value: { lead_gen_form_id: string } },
 *   name?: string,
 * }} params
 * @returns {Promise<{ id: string }>}
 */
export async function createAdCreative({
  video_id,
  page_id,
  primary_text,
  headline,
  description,
  call_to_action,
  name,
}) {
  const { adAccountId } = getConfig()

  // Validation (soft warn — Meta will hard error if over limit)
  if (primary_text.length > 125) {
    console.warn(`[meta-marketing-api] primary_text is ${primary_text.length} chars (max 125 for in-feed)`)
  }
  if (headline.length > 27) {
    console.warn(`[meta-marketing-api] headline is ${headline.length} chars (max 27)`)
  }
  if (description && description.length > 40) {
    console.warn(`[meta-marketing-api] description is ${description.length} chars (max 40)`)
  }

  const body = {
    name: name || `Creative — ${headline}`,
    object_story_spec: {
      page_id,
      video_data: {
        video_id,
        message: primary_text,
        title: headline,
        ...(description ? { link_description: description } : {}),
        call_to_action: {
          type: call_to_action.type || 'SIGN_UP',
          value: {
            lead_gen_form_id: call_to_action.value.lead_gen_form_id,
          },
        },
      },
    },
  }

  const data = await apiPost(`/${adAccountId}/adcreatives`, body)

  if (!data.id) throw new MetaMarketingError('createAdCreative: no id returned')
  console.log(`[meta-marketing-api] Ad creative created: id=${data.id}`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// createAd
// ---------------------------------------------------------------------------

/**
 * Create an ad under an ad set, attached to a creative. Always starts PAUSED.
 *
 * @param {{
 *   ad_set_id: string,
 *   creative_id: string,
 *   name: string,
 * }} params
 * @returns {Promise<{ id: string }>}
 */
export async function createAd({ ad_set_id, creative_id, name }) {
  const { adAccountId } = getConfig()

  const data = await apiPost(`/${adAccountId}/ads`, {
    name,
    adset_id: ad_set_id,
    creative: { creative_id },
    status: 'PAUSED', // always PAUSED — only --launch flag flips to ACTIVE
  })

  if (!data.id) throw new MetaMarketingError('createAd: no id returned')
  console.log(`[meta-marketing-api] Ad created: id=${data.id} name="${name}" (PAUSED)`)
  return { id: data.id }
}

// ---------------------------------------------------------------------------
// setAdStatus
// ---------------------------------------------------------------------------

/**
 * Flip the status of a campaign, ad set, or ad.
 *
 * @param {string} objectId — campaign ID, ad set ID, or ad ID
 * @param {'ACTIVE'|'PAUSED'|'ARCHIVED'} status
 * @param {'campaign'|'adset'|'ad'} objectType — for logging only
 * @returns {Promise<{ success: boolean }>}
 */
export async function setAdStatus(objectId, status, objectType = 'object') {
  const data = await apiPost(`/${objectId}`, { status })
  console.log(`[meta-marketing-api] ${objectType} ${objectId} → ${status}`)
  return { success: data.success !== false }
}

// ---------------------------------------------------------------------------
// getCampaignInsights (bonus — used by reporting)
// ---------------------------------------------------------------------------

/**
 * Fetch basic performance insights for a campaign.
 *
 * @param {string} campaignId
 * @param {{ date_preset?: string, fields?: string }} [opts]
 * @returns {Promise<object>}
 */
export async function getCampaignInsights(campaignId, opts = {}) {
  return apiGet(`/${campaignId}/insights`, {
    fields: opts.fields || 'impressions,reach,spend,actions,cost_per_action_type',
    date_preset: opts.date_preset || 'last_7d',
  })
}
