import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { generatePrediction } from '@/lib/predictions'
import { startOfDay, endOfDay, addDays } from 'date-fns'

// POST /api/predictions/week
// Creates AI-suggested predictions for all unlocked matches in the next 7 days
// without an existing prediction from the current user.
export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const participant = await prisma.participant.findUnique({
    where: { userId: session.user.id },
  })
  if (!participant) return NextResponse.json({ message: 'Participant not found' }, { status: 404 })

  const now = new Date()
  const weekEnd = endOfDay(addDays(now, 7))

  const matches = await prisma.match.findMany({
    where: {
      status: 'SCHEDULED',
      kickoffAt: {
        gte: startOfDay(now),
        lte: weekEnd,
      },
      predictions: {
        none: { participantId: participant.id },
      },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  let created = 0
  for (const match of matches) {
    const pred = generatePrediction({
      matchId: match.id,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      phase: match.phase,
    })
    await prisma.prediction.create({
      data: {
        participantId: participant.id,
        matchId: match.id,
        homeScore: pred.predictedHomeGoals,
        awayScore: pred.predictedAwayGoals,
      },
    })
    created++
  }

  return NextResponse.json({ created, message: `${created} pronósticos generados` })
}
