/**
 * Generate short text using xAI Chat Completions (Grok).
 * Used for subdivision descriptions. Set XAI_API_KEY in .env.local.
 */

const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
/** Use a model from https://docs.x.ai/docs/models (e.g. grok-2-1212, grok-3-mini). */
const MODEL = 'grok-2-1212'

export type GrokTextOptions = {
  /** System or user prompt for the model */
  prompt: string
  /** Max tokens to generate; default 150 */
  max_tokens?: number
}

/**
 * Returns generated text. Throws on API error or missing key.
 */
export async function generateGrokText(options: GrokTextOptions): Promise<string> {
  const apiKey = process.env.XAI_API_KEY
  if (!apiKey?.trim()) {
    throw new Error('XAI_API_KEY is not set. Add it to .env.local for text generation.')
  }

  const res = await fetch(XAI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: options.prompt }],
      max_tokens: options.max_tokens ?? 150,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`xAI chat API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data?.choices?.[0]?.message?.content
  if (content == null) {
    throw new Error('xAI chat API did not return content')
  }

  return content.trim()
}
