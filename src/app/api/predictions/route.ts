import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ message: 'No autorizado' }, { status: 401 })

  const { matchId, participantId, homeScore, awayScore } = await req.json()

  if (homeScore === undefined || awayScore === undefined || homeScore < 0 || awayScore < 0) {
    return NextResponse.json({ message: 'Marcador inválido' }, { status: 400 })
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return NextResponse.json({ message: 'Partido no encontrado' }, { status: 404 })

  if (new Date() >= match.kickoffAt) {
    return NextResponse.json({ message: 'El partido ya comenzó, no se pueden editar pronósticos' }, { status: 403 })
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, userId: session.user.id },
  })
  if (!participant) return NextResponse.json({ message: 'Participante no válido' }, { status: 403 })

  const existing = await prisma.prediction.findUnique({
    where: { participantId_matchId: { participantId, matchId } },
  })

  if (existing) {
    await prisma.predictionLog.create({
      data: {
        predictionId: existing.id,
        prevHome: existing.homeScore,
        prevAway: existing.awayScore,
        newHome: homeScore,
        newAway: awayScore,
      },
    })
    await prisma.prediction.update({
      where: { id: existing.id },
      data: { homeScore, awayScore, updatedAt: new Date() },
    })
  } else {
    await prisma.prediction.create({
      data: { participantId, matchId, homeScore, awayScore },
    })
  }

  return NextResponse.json({ success: true })
}
