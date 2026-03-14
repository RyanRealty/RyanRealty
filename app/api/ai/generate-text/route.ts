import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

const BRAND_TONE =
  'Ryan Realty is a luxury Central Oregon real estate brand. Tone: professional, warm, trustworthy, and inviting. Avoid jargon; use clear, elegant language. Emphasize lifestyle, community, and the Central Oregon region (Bend, Redmond, Sisters, Sunriver, etc.).'

const ACTION_PROMPTS: Record<string, string> = {
  generate: 'Generate new content based on the user request and context.',
  rewrite: 'Rewrite the existing text to improve clarity and impact while keeping the same meaning.',
  expand: 'Expand the existing text with more detail and richness, staying on topic.',
  condense: 'Condense the existing text to be shorter while keeping key information.',
  fix_grammar: 'Fix grammar, spelling, and punctuation in the existing text. Preserve tone and structure.',
}

const TONE_PROMPTS: Record<string, string> = {
  professional: 'Use a formal, professional tone suitable for business and real estate.',
  friendly: 'Use a warm, approachable, friendly tone.',
  concise: 'Be brief and to the point. No filler.',
  enthusiastic: 'Use an energetic, positive tone that conveys excitement.',
  empathetic: 'Use a caring, understanding tone that acknowledges the reader.',
  luxury: 'Use an elevated, luxury real estate tone: refined, exclusive, aspirational.',
  casual: 'Use a relaxed, conversational tone.',
  urgent: 'Use a sense of urgency and immediacy where appropriate.',
}

export interface GenerateTextBody {
  context?: string
  tone?: string
  action?: string
  prompt?: string
  existingText?: string
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  try {
    const body = (await request.json()) as GenerateTextBody
    const { context = '', tone = 'professional', action = 'generate', prompt = '', existingText = '' } = body

    const actionInstruction = ACTION_PROMPTS[action] ?? ACTION_PROMPTS.generate
    const toneInstruction = TONE_PROMPTS[tone] ?? TONE_PROMPTS.professional

    const userContent = [
      `Context: ${context || 'General real estate / Ryan Realty.'}`,
      `Task: ${actionInstruction}`,
      `Tone: ${toneInstruction}`,
      prompt ? `User request: ${prompt}` : '',
      existingText ? `Existing text to work with:\n${existingText}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const systemContent = `${BRAND_TONE}\n\nApply the requested action and tone. Output only the resulting text, no preamble or explanation.`

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'AI text generation is not configured.' }, { status: 503 })
    }

    const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions'
    const MODEL = 'grok-2-1212'

    const res = await fetch(XAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `AI API error: ${res.status}` },
        { status: 502 }
      )
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data?.choices?.[0]?.message?.content
    if (content == null) {
      return NextResponse.json({ error: 'No content in AI response.' }, { status: 502 })
    }

    return NextResponse.json({ text: content.trim() })
  } catch (e) {
    console.error('generate-text error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to generate text.' },
      { status: 500 }
    )
  }
}
