import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ── GET: Facebook webhook verification ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const params     = req.nextUrl.searchParams
  const mode       = params.get('hub.mode')
  const token      = params.get('hub.verify_token')
  const challenge  = params.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: incoming Facebook messages ──────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json()

    if (body.object !== 'page') {
      return NextResponse.json({ status: 'ignored' })
    }

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        // Only handle real incoming messages (ignore echoes of our own sends)
        if (!event.message || event.message.is_echo) continue

        const senderId   = event.sender?.id  as string | undefined
        const text       = event.message?.text as string | undefined
        const preview    = text ? text.slice(0, 120) : '📎 Attachment'

        await getServiceClient().from('notifications').insert({
          type:        'messenger',
          sender_id:   senderId ?? null,
          preview,
          read:        false,
        })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}
