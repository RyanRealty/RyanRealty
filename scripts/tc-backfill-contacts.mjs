#!/usr/bin/env node
/**
 * Backfill tc_deal_contacts from the SkySlope contact fields already in
 * tc_cycles.raw (tc-builder rung 15). Idempotent: upserts on the
 * (deal_id, role, source_contact_guid) unique index; also dedups same
 * email+role+deal in-code (the same party can have different guids across a
 * deal's offer cycles).
 *
 * Usage: node --env-file=.env.local scripts/tc-backfill-contacts.mjs
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// raw field -> contact role
const SINGLE = {
  escrowContact: 'escrow',
  titleContact: 'title',
  lenderContact: 'lender',
  otherSideAgentContact: 'other_agent',
  homeWarrantyContact: 'home_warranty',
  attorneyContact: 'attorney',
  miscContact: 'misc',
}
const ARRAYS = {
  transactionCoordinators: 'transaction_coordinator',
  coAgents: 'co_agent',
}

const nameOf = (c) => [c.firstName, c.lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ') || null

function toContact(c, role) {
  if (!c || typeof c !== 'object') return null
  const name = nameOf(c)
  const email = (c.email || '').trim() || null
  const company = (c.company || '').trim() || null
  // skip empty shells (a coAgent guid with no name/email/company is noise)
  if (!name && !email && !company) return null
  return {
    role,
    name,
    company,
    email,
    phone: (c.phoneNumber || '').trim() || null,
    alternate_phone: (c.alternatePhone || '').trim() || null,
    notes: (c.notes || '').trim() || null,
    source: 'skyslope_raw',
    source_contact_guid: c.contactGuid || null,
  }
}

const { data: deals } = await supabase.from('tc_deals').select('id, address')
let inserted = 0
let dealsTouched = 0

for (const deal of deals ?? []) {
  const { data: cycles } = await supabase.from('tc_cycles').select('id, raw').eq('deal_id', deal.id)
  const seen = new Set() // role|email or role|guid dedup within the deal
  const rows = []
  for (const cyc of cycles ?? []) {
    const raw = cyc.raw || {}
    const found = []
    for (const [field, role] of Object.entries(SINGLE)) {
      const c = toContact(raw[field], role)
      if (c) found.push(c)
    }
    for (const [field, role] of Object.entries(ARRAYS)) {
      for (const item of Array.isArray(raw[field]) ? raw[field] : []) {
        const c = toContact(item, role)
        if (c) found.push(c)
      }
    }
    for (const c of found) {
      const key = `${c.role}|${(c.email || c.source_contact_guid || c.name || '').toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ ...c, deal_id: deal.id, cycle_id: cyc.id })
    }
  }
  if (rows.length) {
    const { error } = await supabase
      .from('tc_deal_contacts')
      .upsert(rows, { onConflict: 'deal_id,role,source_contact_guid', ignoreDuplicates: true })
    if (error) {
      console.error(`upsert ${deal.address}: ${error.message}`)
      continue
    }
    inserted += rows.length
    dealsTouched++
  }
}

const { count } = await supabase.from('tc_deal_contacts').select('*', { count: 'exact', head: true })
console.log(`backfill processed ${inserted} contact rows across ${dealsTouched} deals; tc_deal_contacts now holds ${count}`)
