import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'

const SYSTEM_PROMPT = `You are Ryan Realty's friendly, knowledgeable real estate assistant for Central Oregon. Your name is the Ryan Realty Assistant.

Key facts:
- Ryan Realty is a luxury real estate brand serving Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, Madras, and all of Central Oregon.
- Website: ryan-realty.com
- You help buyers, sellers, and curious visitors with questions about listings, neighborhoods, home values, the buying/selling process, market trends, and local lifestyle.

Guidelines:
- Be warm, professional, and concise. Keep responses under 200 words unless the user asks for detail.
- If someone asks about a specific listing or property, suggest they use the search at /listings or contact the team.
- If someone wants a home valuation, direct them to /home-valuation for a free CMA.
- If someone wants to schedule a tour, direct them to the listing page or /contact.
- If someone asks about market conditions, share general Central Oregon trends (strong demand, lifestyle-driven market, four-season outdoor recreation).
- Never give specific legal, tax, or financial advice. Suggest consulting a professional.
- Never fabricate property details or prices. If you don't know, say so and offer to connect them with an agent.
- Do not discuss competitors negatively.
- End longer answers with a helpful next step or question.`

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatRequestBody {
  messages?: ChatMessage[]
}

export async function POST(request: Request) {
  const rl = await checkRateLimit(request, 'strict')
  if (rl.limited) return rl.response

  try {
    const body = (await request.json()) as ChatRequestBody
    const messages = body.messages ?? []

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })
    }

    // Limit conversation history to last 20 messages to control token usage
    const trimmed = messages.slice(-20)

    const apiKey = process.env.XAI_API_KEY
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'AI chat is not configured.' }, { status: 503 })
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
          { role: 'system', content: SYSTEM_PROMPT },
          ...trimmed.map((m) => ({ role: m.role, content: m.content })),
        ],
        max_tokens: 512,
        temperature: 0.7,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[ai/chat] API error:', res.status, text)
      return NextResponse.json({ error: `AI service error: ${res.status}` }, { status: 502 })
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data?.choices?.[0]?.message?.content
    if (content == null) {
      return NextResponse.json({ error: 'No response from AI.' }, { status: 502 })
    }

    return NextResponse.json({ message: content.trim() })
  } catch (e) {
    console.error('[ai/chat] error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Chat failed.' },
      { status: 500 },
    )
  }
}
