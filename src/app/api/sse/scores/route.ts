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
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch { /* client disconnected */ }
      }

      // Helper: get live match snapshot
      const getMatches = () => prisma.match.findMany({
        where: { status: { in: ['LIVE', 'FINISHED'] } },
        select: {
          id: true, status: true, homeScore: true, awayScore: true,
          homeTeam: { select: { name: true, flag: true, badge: true, code: true } },
          awayTeam: { select: { name: true, flag: true, badge: true, code: true } },
        },
        orderBy: { kickoffAt: 'asc' },
      })

      const getRankings = () => prisma.participant.findMany({
        orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
        take: 10,
        select: { id: true, displayName: true, totalPoints: true, exactHits: true, position: true },
      })

      // Send initial state
      const [initMatches, initRankings] = await Promise.all([getMatches(), getRankings()])
      send({ type: 'init', matches: initMatches, rankings: initRankings })

      // Track previous scores to detect goals
      type ScoreMap = Record<string, { home: number | null; away: number | null }>
      let prevScores: ScoreMap = {}
      initMatches.forEach(m => { prevScores[m.id] = { home: m.homeScore, away: m.awayScore } })

      const POLL_MS = parseInt(process.env.SSE_HEARTBEAT_MS ?? '20000')

      const interval = setInterval(async () => {
        try {
          const matches = await getMatches()
          const goals: { matchId: string; homeTeam: string; awayTeam: string; homeScore: number | null; awayScore: number | null }[] = []

          // Detect score changes (goals)
          for (const m of matches) {
            const prev = prevScores[m.id]
            if (prev) {
              const homeGoal = (m.homeScore ?? 0) > (prev.home ?? 0)
              const awayGoal = (m.awayScore ?? 0) > (prev.away ?? 0)
              if (homeGoal || awayGoal) {
                goals.push({
                  matchId: m.id,
                  homeTeam: m.homeTeam.name,
                  awayTeam: m.awayTeam.name,
                  homeScore: m.homeScore,
                  awayScore: m.awayScore,
                })
              }
            }
            prevScores[m.id] = { home: m.homeScore, away: m.awayScore }
          }

          if (goals.length > 0) {
            // Goal scored — send goal event + updated rankings
            const rankings = await getRankings()
            send({ type: 'goal', goals, matches, rankings, timestamp: new Date().toISOString() })
          } else {
            // Regular heartbeat with current scores
            send({ type: 'scores', matches, timestamp: new Date().toISOString() })
          }
        } catch {
          clearInterval(interval)
          try { controller.close() } catch { /* already closed */ }
        }
      }, POLL_MS)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
