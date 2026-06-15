import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Send initial data
      const liveMatches = await prisma.match.findMany({
        where: { status: { in: ['LIVE', 'FINISHED'] } },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { kickoffAt: 'asc' },
      })

      const rankings = await prisma.participant.findMany({
        orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
        take: 10,
        select: { id: true, displayName: true, totalPoints: true, exactHits: true, position: true },
      })

      send({ type: 'init', matches: liveMatches, rankings })

      // Keep alive with heartbeat
      const HEARTBEAT_MS = parseInt(process.env.SSE_HEARTBEAT_MS ?? '15000')
      const interval = setInterval(async () => {
        try {
          const live = await prisma.match.findMany({
            where: { status: 'LIVE' },
            include: { homeTeam: true, awayTeam: true },
          })
          send({ type: 'scores', matches: live, timestamp: new Date().toISOString() })
        } catch {
          clearInterval(interval)
          controller.close()
        }
      }, HEARTBEAT_MS)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
