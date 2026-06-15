import { prisma } from '@/lib/db'
import { calcPoints, getPhaseMultiplier } from '@/lib/scoring'
import { createFootballProvider, createNewsProvider } from '@/lib/football-provider'

export interface SyncResult {
  matchesUpdated: number
  scoresCalculated: number
  newsUpserted: number
  errors: string[]
}

export async function syncLiveScores(): Promise<SyncResult> {
  const result: SyncResult = { matchesUpdated: 0, scoresCalculated: 0, newsUpserted: 0, errors: [] }
  const provider = createFootballProvider()

  try {
    const liveMatches = await provider.getLiveScores()

    for (const data of liveMatches) {
      try {
        const match = await prisma.match.findFirst({
          where: { externalId: data.externalId },
        })
        if (!match) continue

        await prisma.match.update({
          where: { id: match.id },
          data: {
            status: data.status,
            homeScore: data.homeScore ?? match.homeScore,
            awayScore: data.awayScore ?? match.awayScore,
            phase: data.phase,
          },
        })
        result.matchesUpdated++

        // When a match finishes, calculate points for all predictions
        if (data.status === 'FINISHED' && match.status !== 'FINISHED'
            && data.homeScore !== undefined && data.awayScore !== undefined) {
          const calculated = await calculateMatchPoints(match.id, data.homeScore, data.awayScore)
          result.scoresCalculated += calculated
        }
      } catch (err) {
        result.errors.push(`match ${data.externalId}: ${String(err)}`)
      }
    }
  } catch (err) {
    result.errors.push(`getLiveScores: ${String(err)}`)
  }

  return result
}

export async function syncAllMatches(): Promise<SyncResult> {
  const result: SyncResult = { matchesUpdated: 0, scoresCalculated: 0, newsUpserted: 0, errors: [] }
  const provider = createFootballProvider()

  try {
    const matches = await provider.getMatches()

    for (const data of matches) {
      try {
        const existing = await prisma.match.findFirst({
          where: { externalId: data.externalId },
          include: { homeTeam: true, awayTeam: true },
        })

        if (!existing) {
          // Try to find teams by code and create the match
          const homeTeam = await prisma.team.findUnique({ where: { code: data.homeTeamCode } })
          const awayTeam = await prisma.team.findUnique({ where: { code: data.awayTeamCode } })
          if (!homeTeam || !awayTeam) continue

          await prisma.match.create({
            data: {
              externalId: data.externalId,
              homeTeamId: homeTeam.id,
              awayTeamId: awayTeam.id,
              kickoffAt: data.kickoffAt,
              stadium: data.stadium,
              city: data.city,
              status: data.status,
              phase: data.phase,
              homeScore: data.homeScore,
              awayScore: data.awayScore,
            },
          })
        } else {
          const wasFinished = existing.status === 'FINISHED'
          await prisma.match.update({
            where: { id: existing.id },
            data: {
              status: data.status,
              homeScore: data.homeScore ?? existing.homeScore,
              awayScore: data.awayScore ?? existing.awayScore,
              stadium: data.stadium ?? existing.stadium,
              city: data.city ?? existing.city,
              phase: data.phase,
            },
          })

          if (!wasFinished && data.status === 'FINISHED'
              && data.homeScore !== undefined && data.awayScore !== undefined) {
            const calculated = await calculateMatchPoints(existing.id, data.homeScore, data.awayScore)
            result.scoresCalculated += calculated
          }
        }
        result.matchesUpdated++
      } catch (err) {
        result.errors.push(`match ${data.externalId}: ${String(err)}`)
      }
    }
  } catch (err) {
    result.errors.push(`getMatches: ${String(err)}`)
  }

  return result
}

export async function syncNews(): Promise<SyncResult> {
  const result: SyncResult = { matchesUpdated: 0, scoresCalculated: 0, newsUpserted: 0, errors: [] }
  const provider = createNewsProvider()

  try {
    const items = await provider.getLatestNews('FIFA World Cup 2026')
    for (const item of items) {
      try {
        await prisma.news.upsert({
          where: { url: item.url },
          update: {
            title: item.title,
            summary: item.summary,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
            tags: item.tags,
          },
          create: {
            title: item.title,
            summary: item.summary,
            url: item.url,
            imageUrl: item.imageUrl,
            source: item.source,
            publishedAt: item.publishedAt,
            tags: item.tags,
          },
        })
        result.newsUpserted++
      } catch (err) {
        result.errors.push(`news "${item.title}": ${String(err)}`)
      }
    }
  } catch (err) {
    result.errors.push(`getLatestNews: ${String(err)}`)
  }

  return result
}

// Calculates points for all predictions of a finished match, updates participant totals + ranking
async function calculateMatchPoints(matchId: string, homeScore: number, awayScore: number): Promise<number> {
  const scoringRule = await prisma.scoringRule.findFirst({ where: { isActive: true } })
  if (!scoringRule) return 0

  const match = await prisma.match.findUnique({ where: { id: matchId } })
  if (!match) return 0

  const phaseMultiplier = getPhaseMultiplier(match.phase)
  const config = {
    exactScore: scoringRule.exactScore,
    correctResult: scoringRule.correctResult,
    goalDiff: scoringRule.goalDiff,
    noMatch: scoringRule.noMatch,
    bonusMultiplier: scoringRule.bonusMultiplier * phaseMultiplier,
  }

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
  })

  let updated = 0
  const participantIds: string[] = []

  for (const pred of predictions) {
    const points = calcPoints(pred.homeScore, pred.awayScore, homeScore, awayScore, config)
    const isExact = pred.homeScore === homeScore && pred.awayScore === awayScore
    const predResult = Math.sign(pred.homeScore - pred.awayScore)
    const realResult = Math.sign(homeScore - awayScore)
    const isCorrectResult = !isExact && predResult === realResult

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
        pendingCount: { decrement: 1 },
      },
    })

    participantIds.push(pred.participantId)
    updated++
  }

  // Rebuild ranking positions
  if (participantIds.length > 0) {
    await rebuildRanking()
  }

  return updated
}

// Recalculates and saves position for all participants
async function rebuildRanking(): Promise<void> {
  const participants = await prisma.participant.findMany({
    orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
  })

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]
    const prev = participants[i - 1]
    const position = (prev && p.totalPoints === prev.totalPoints && p.exactHits === prev.exactHits)
      ? (prev.position ?? i + 1)
      : i + 1

    await prisma.participant.update({
      where: { id: p.id },
      data: {
        positionPrev: p.position,
        position,
      },
    })
  }
}
