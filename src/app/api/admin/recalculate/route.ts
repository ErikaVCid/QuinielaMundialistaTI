import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcPoints, DEFAULT_SCORING } from '@/lib/scoring'

// Recalculates points for all finished matches from scratch.
// Resets participant totals, scores all predictions, rebuilds rankings.
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  const fixToken = process.env.FIX_DATA_SECRET
  if (!(fixToken && token === fixToken)) {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
    }
  }

  const scoringRule = await prisma.scoringRule.findFirst({ where: { isActive: true } })
  const config = scoringRule ?? DEFAULT_SCORING

  // 1. Reset all participant aggregates
  await prisma.participant.updateMany({
    data: { totalPoints: 0, exactHits: 0, resultHits: 0 },
  })

  // 2. Reset all prediction points
  await prisma.prediction.updateMany({
    data: { points: 0, isLocked: false },
  })

  // 3. Score all finished matches
  const finishedMatches = await prisma.match.findMany({
    where: { status: 'FINISHED', homeScore: { not: null }, awayScore: { not: null } },
  })

  let matchesScored = 0
  let predictionsScored = 0

  for (const match of finishedMatches) {
    const realHome = match.homeScore!
    const realAway = match.awayScore!
    const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } })

    for (const pred of predictions) {
      const points = calcPoints(pred.homeScore, pred.awayScore, realHome, realAway, config)
      const isExact = pred.homeScore === realHome && pred.awayScore === realAway
      const isResult = !isExact && Math.sign(pred.homeScore - pred.awayScore) === Math.sign(realHome - realAway)

      await prisma.prediction.update({
        where: { id: pred.id },
        data: { points, isLocked: true },
      })

      await prisma.participant.update({
        where: { id: pred.participantId },
        data: {
          totalPoints: { increment: points },
          exactHits: isExact ? { increment: 1 } : undefined,
          resultHits: isResult ? { increment: 1 } : undefined,
        },
      })
      predictionsScored++
    }
    matchesScored++
  }

  // 4. Rebuild rankings
  const allParticipants = await prisma.participant.findMany({
    orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }, { resultHits: 'desc' }],
  })

  let pos = 1
  for (let i = 0; i < allParticipants.length; i++) {
    if (i > 0) {
      const prev = allParticipants[i - 1]
      const curr = allParticipants[i]
      if (curr.totalPoints !== prev.totalPoints || curr.exactHits !== prev.exactHits) pos = i + 1
    }
    await prisma.participant.update({
      where: { id: allParticipants[i].id },
      data: { positionPrev: allParticipants[i].position, position: pos },
    })
  }

  return NextResponse.json({ ok: true, matchesScored, predictionsScored, participants: allParticipants.length })
}
