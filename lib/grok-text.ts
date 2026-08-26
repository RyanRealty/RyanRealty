/**
 * Shim. The Grok surface now lives in lib/grok/. Kept so existing callers
 * (subdivision descriptions, place content pipeline) keep their signature:
 * they want a plain string back.
 *
 * This shim is also the fix for a live bug: the old implementation was pinned
 * to `grok-2-1212`, a model the xAI account no longer serves, so every call
 * through it returned a 404. lib/grok/client.ts holds the verified ids.
 */
import { generateGrokText as generateGrokTextRich } from '@/lib/grok/text'

export type GrokTextOptions = {
  prompt: string
  max_tokens?: number
}

/** Returns generated text. Throws GrokError on API error or missing key. */
export async function generateGrokText(options: GrokTextOptions): Promise<string> {
  const result = await generateGrokTextRich({
    prompt: options.prompt,
    maxTokens: options.max_tokens ?? 150,
  })
  return result.text
}
