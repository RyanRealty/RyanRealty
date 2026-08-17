/**
 * Generate short text using xAI Responses API (Grok 4.6).
 * Chokepoint for content-model text (G32 / R-213). Set XAI_API_KEY in .env.local.
 *
 * Docs: https://docs.x.ai/overview · https://docs.x.ai/developers/models
 */

const XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses'
/** Current text model from https://docs.x.ai/developers/models */
export const GROK_TEXT_MODEL = 'grok-4.6'

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

  const res = await fetch(XAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_TEXT_MODEL,
      input: options.prompt,
      max_output_tokens: options.max_tokens ?? 150,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`xAI responses API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as {
    output_text?: string
    output?: Array<{ content?: Array<{ text?: string }> }>
    choices?: Array<{ message?: { content?: string } }>
  }
  const fromOutput = data.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => part.text)
    .filter((t): t is string => Boolean(t?.trim()))
    .join('\n')
  const content = data.output_text ?? fromOutput ?? data.choices?.[0]?.message?.content
  if (content == null || !String(content).trim()) {
    throw new Error('xAI responses API did not return content')
  }

  return String(content).trim()
}
