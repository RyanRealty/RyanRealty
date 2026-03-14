'use server'

import { createClient } from '@supabase/supabase-js'
import { buildBrokerHeadshotPrompt, type HeadshotGender } from '@/lib/headshot-prompt'

const DEFAULT_PROMPT_ID = 'default'
const DEFAULT_PROMPT_NAME = 'Professional studio (default)'

export type HeadshotPromptOption =
  | { id: typeof DEFAULT_PROMPT_ID; name: string; body: string; isDefault: true }
  | { id: string; name: string; body: string; isDefault: false }

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * List all prompts: built-in default (with body for current gender) plus custom prompts from DB.
 * Used for the prompt selector and for "Manage prompts" list.
 */
export async function listHeadshotPrompts(
  gender: HeadshotGender = 'Male'
): Promise<HeadshotPromptOption[]> {
  const defaultBody = buildBrokerHeadshotPrompt(gender)
  const defaultOption: HeadshotPromptOption = {
    id: DEFAULT_PROMPT_ID,
    name: DEFAULT_PROMPT_NAME,
    body: defaultBody,
    isDefault: true,
  }

  const supabase = getServiceSupabase()
  if (!supabase) return [defaultOption]

  const { data: rows, error } = await supabase
    .from('headshot_prompts')
    .select('id, name, body, sort_order')
    .order('sort_order', { ascending: true })

  if (error) return [defaultOption]

  const custom: HeadshotPromptOption[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name ?? 'Unnamed',
    body: r.body ?? '',
    isDefault: false as const,
  }))

  return [defaultOption, ...custom]
}

/**
 * Resolve the final prompt text for generation. Used by generateBrokerHeadshot.
 * - promptId === 'default' → built-in prompt with gender.
 * - Otherwise load from DB and replace [GENDER] placeholder.
 */
export async function resolveHeadshotPromptText(
  promptId: string,
  gender: HeadshotGender
): Promise<string | null> {
  if (promptId === DEFAULT_PROMPT_ID) {
    return buildBrokerHeadshotPrompt(gender)
  }

  const supabase = getServiceSupabase()
  if (!supabase) return null

  const { data: row, error } = await supabase
    .from('headshot_prompts')
    .select('body')
    .eq('id', promptId)
    .single()

  if (error || !row?.body) return null

  const body = String(row.body)
  const withGender = body.replace(/\s*\[GENDER(?::\s*\w+)?\]\s*/gi, ` ${gender} `).trim()
  return withGender || body
}

export async function createHeadshotPrompt(input: {
  name: string
  body: string
  sort_order?: number
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured.' }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: 'Prompt name is required.' }

  const { data, error } = await supabase
    .from('headshot_prompts')
    .insert({
      name,
      body: input.body?.trim() ?? '',
      sort_order: input.sort_order ?? 0,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  if (!data?.id) return { ok: false, error: 'Failed to create prompt.' }
  return { ok: true, id: data.id }
}

export async function updateHeadshotPrompt(
  id: string,
  input: { name?: string; body?: string; sort_order?: number }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (id === DEFAULT_PROMPT_ID) {
    return { ok: false, error: 'The default prompt cannot be edited. Duplicate it to create an editable copy.' }
  }

  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured.' }

  const payload: { name?: string; body?: string; sort_order?: number; updated_at: string } = {
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) payload.name = input.name.trim()
  if (input.body !== undefined) payload.body = input.body.trim()
  if (input.sort_order !== undefined) payload.sort_order = input.sort_order

  const { error } = await supabase.from('headshot_prompts').update(payload).eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteHeadshotPrompt(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (id === DEFAULT_PROMPT_ID) {
    return { ok: false, error: 'The default prompt cannot be deleted.' }
  }

  const supabase = getServiceSupabase()
  if (!supabase) return { ok: false, error: 'Database not configured.' }

  const { error } = await supabase.from('headshot_prompts').delete().eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
