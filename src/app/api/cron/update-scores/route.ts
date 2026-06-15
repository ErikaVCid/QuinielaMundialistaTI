import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiFootballGet, afStatus, afScore, AfFixture } from '@/lib/api-football'
import { generatePrediction } from '@/lib/predictions'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
  }

  let updatedMatches = 0
  let updatedPredictions = 0
  const errors: string[] = []

  // ── 1. Actualizar partidos recientes / en vivo ────────────────────────────────
  try {
    // Fetch live + recently finished matches (last 24h)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
    const fixtures = await apiFootballGet<AfFixture[]>('/fixtures', {
      league: 1,
      season: 2026,
      from: yesterday,
      to: new Date().toISOString().split('T')[0],
    })

    for (const f of fixtures) {
      try {
        const externalId = `af-${f.fixture.id}`
        const existing = await prisma.match.findUnique({ where: { externalId } })
        if (!existing) continue

        const status = afStatus(f.fixture.status.short)
        const sc = afScore(f)

        let winnerTeamId: string | null = existing.winnerTeamId
        if (status === 'FINISHED') {
          if (f.teams.home.winner === true) winnerTeamId = existing.homeTeamId
          else if (f.teams.away.winner === true) winnerTeamId = existing.awayTeamId
        }

        const changed = existing.status !== status
          || existing.homeScore !== (sc.home ?? existing.homeScore)
          || existing.awayScore !== (sc.away ?? existing.awayScore)

        if (changed) {
          await prisma.match.update({
            where: { externalId },
            data: {
              status,
              homeScore: sc.home ?? existing.homeScore,
              awayScore: sc.away ?? existing.awayScore,
              winnerTeamId,
            },
          })
          updatedMatches++

          // Recalculate user prediction points when match finishes
          if (status === 'FINISHED' && existing.status !== 'FINISHED'
              && sc.home !== undefined && sc.away !== undefined) {
            await recalculatePoints(existing.id, sc.home, sc.away)
          }
        }
      } catch (e) {
        errors.push(`fixture ${f.fixture.id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    errors.push(`fetch fixtures: ${(e as Error).message}`)
  }

  // ── 2. Actualizar predicciones IA para próximos partidos ─────────────────────
  try {
    const upcoming = await prisma.match.findMany({
      where: {
        status: 'SCHEDULED',
        kickoffAt: { gte: new Date() },
        OR: [
          { aiPrediction: null },
          {
            aiPrediction: {
              isManual: false,
              updatedAt: { lt: new Date(Date.now() - 3_600_000) },   // older than 1h
            },
          },
        ],
      },
      include: {
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        aiPrediction: { select: { isManual: true } },
      },
      take: 20,
    })

    for (const match of upcoming) {
      if (match.aiPrediction?.isManual) continue

      const pred = generatePrediction({
        matchId: match.id,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        phase: match.phase,
      })

      const data = {
        predictedHomeGoals: pred.predictedHomeGoals,
        predictedAwayGoals: pred.predictedAwayGoals,
        predictedResult: pred.predictedResult,
        homeWinProbability: pred.homeWinProbability,
        drawProbability: pred.drawProbability,
        awayWinProbability: pred.awayWinProbability,
        confidence: pred.confidence,
        modelVersion: pred.modelVersion,
        explanation: pred.explanation,
      }

      await prisma.aiPrediction.upsert({
        where: { matchId: match.id },
        update: data,
        create: { matchId: match.id, ...data },
      })
      updatedPredictions++
    }
  } catch (e) {
    errors.push(`predictions: ${(e as Error).message}`)
  }

  return NextResponse.json({
    ok: true,
    updatedMatches,
    updatedPredictions,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function recalculatePoints(matchId: string, homeScore: number, awayScore: number) {
  const scoringRule = await prisma.scoringRule.findFirst({ where: { isActive: true } })
  if (!scoringRule) return

  const predictions = await prisma.prediction.findMany({ where: { matchId } })

  for (const pred of predictions) {
    const isExact = pred.homeScore === homeScore && pred.awayScore === awayScore
    const predResult = Math.sign(pred.homeScore - pred.awayScore)
    const realResult = Math.sign(homeScore - awayScore)
    const isCorrectResult = !isExact && predResult === realResult

    const points = isExact ? scoringRule.exactScore
      : isCorrectResult ? scoringRule.correctResult
      : scoringRule.noMatch

    await prisma.prediction.update({
      where: { id: pred.id },
      data: { points, isLocked: true },
    })

    await prisma.participant.update({
      where: { id: pred.participantId },
      data: {
        totalPoints: { increment: points },
        exactHits: isExact ? { increment: 1 } : undefined,
        resultHits: isCorrectResult ? { increment: 1 } : undefined,
      },
    })
  }
}
