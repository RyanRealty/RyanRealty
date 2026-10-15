/** <Dial action> for the receptionist SIP leg; logic in lib/voice/receptionist-complete. */
import { handleReceptionistComplete } from '@/lib/voice/receptionist-complete'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleReceptionistComplete(request, null)
}
