/** Unanswered-transfer fallback for a specific broker; see ../route.ts. */
import { handleReceptionistComplete } from '@/lib/voice/receptionist-complete'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: { params: Promise<{ who: string }> }) {
  const { who } = await ctx.params
  return handleReceptionistComplete(request, who)
}
