import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { calcPoints, DEFAULT_SCORING } from '@/lib/scoring'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const { homeScore, awayScore, status } = await req.json()

  await prisma.match.update({
    where: { id },
    data: {
      homeScore: homeScore ?? undefined,
      awayScore: awayScore ?? undefined,
      status: status ?? undefined,
    },
  })

  // If finished, calculate points for all predictions
  if (status === 'FINISHED' && homeScore !== undefined && awayScore !== undefined) {
    const activeScoringRule = await prisma.scoringRule.findFirst({ where: { isActive: true } })
    const config = activeScoringRule ?? DEFAULT_SCORING

    const predictions = await prisma.prediction.findMany({ where: { matchId: id } })

    for (const pred of predictions) {
      const points = calcPoints(pred.homeScore, pred.awayScore, homeScore, awayScore, config)
      const isExact = pred.homeScore === homeScore && pred.awayScore === awayScore
      const isResult = !isExact && Math.sign(pred.homeScore - pred.awayScore) === Math.sign(homeScore - awayScore)

      await prisma.prediction.update({
        where: { id: pred.id },
        data: { points, isLocked: true },
      })

      // Update participant aggregates
      await prisma.participant.update({
        where: { id: pred.participantId },
        data: {
          totalPoints: { increment: points },
          exactHits: isExact ? { increment: 1 } : undefined,
          resultHits: isResult ? { increment: 1 } : undefined,
        },
      })
    }

    // Recalculate rankings
    const allParticipants = await prisma.participant.findMany({
      orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
    })

    let pos = 1
    for (let i = 0; i < allParticipants.length; i++) {
      if (i > 0) {
        const prev = allParticipants[i - 1]
        if (allParticipants[i].totalPoints !== prev.totalPoints || allParticipants[i].exactHits !== prev.exactHits) {
          pos = i + 1
        }
      }
      await prisma.participant.update({
        where: { id: allParticipants[i].id },
        data: {
          positionPrev: allParticipants[i].position,
          position: pos,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}
