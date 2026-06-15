import { Phase } from '@prisma/client'
import { prisma } from '@/lib/db'
import { WorldCup26Provider } from '@/lib/football-provider'
import { calcPoints, getPhaseMultiplier } from '@/lib/scoring'

export interface FullSyncResult {
  teams: number
  groups: number
  matches: number
  matchesUpdated: number
  scoresCalculated: number
  errors: string[]
}

// Full sync: teams → groups → matches. Run once on deploy or from admin panel.
export async function syncWorldCup26Full(): Promise<FullSyncResult> {
  const result: FullSyncResult = { teams: 0, groups: 0, matches: 0, matchesUpdated: 0, scoresCalculated: 0, errors: [] }
  const api = new WorldCup26Provider()

  // 1. Fetch all source data in parallel
  let teams, matches
  try {
    ;[teams, matches] = await Promise.all([api.getTeams(), api.getMatches()])
  } catch (err) {
    result.errors.push(`fetch failed: ${String(err)}`)
    return result
  }

  // 2. Upsert groups A-L
  const groupLabels = [...new Set(teams.map(t => t.group).filter(Boolean))].sort()
  const groupMap = new Map<string, string>() // label → DB id

  for (const label of groupLabels) {
    try {
      const g = await prisma.tournamentGroup.upsert({
        where: { id: `group-${label}` },
        update: {},
        create: { id: `group-${label}`, name: `Grupo ${label}`, label },
      })
      groupMap.set(label, g.id)
      result.groups++
    } catch (err) {
      result.errors.push(`group ${label}: ${String(err)}`)
    }
  }

  // 3. Upsert teams by fifa_code
  const teamCodeToId = new Map<string, string>() // fifa_code → DB id

  for (const t of teams) {
    try {
      const team = await prisma.team.upsert({
        where: { code: t.fifaCode },
        update: {
          name: t.nameEn,
          flag: t.flagUrl,
          groupId: groupMap.get(t.group),
          externalId: t.apiId,
        },
        create: {
          name: t.nameEn,
          code: t.fifaCode,
          flag: t.flagUrl,
          groupId: groupMap.get(t.group),
          externalId: t.apiId,
        },
      })
      teamCodeToId.set(t.fifaCode, team.id)
      result.teams++
    } catch (err) {
      result.errors.push(`team ${t.fifaCode}: ${String(err)}`)
    }
  }

  // 4. Upsert matches
  for (const m of matches) {
    try {
      const homeTeamId = teamCodeToId.get(m.homeTeamCode)
      const awayTeamId = teamCodeToId.get(m.awayTeamCode)

      if (!homeTeamId || !awayTeamId) {
        // Knockout placeholder — teams not yet determined, skip
        continue
      }

      const existing = await prisma.match.findUnique({ where: { externalId: m.externalId } })
      const wasFinished = existing?.status === 'FINISHED'

      await prisma.match.upsert({
        where: { externalId: m.externalId },
        update: {
          status: m.status,
          homeScore: m.homeScore ?? existing?.homeScore,
          awayScore: m.awayScore ?? existing?.awayScore,
          phase: m.phase,
          stadium: m.stadium,
          city: m.city,
        },
        create: {
          externalId: m.externalId,
          homeTeamId,
          awayTeamId,
          kickoffAt: m.kickoffAt,
          stadium: m.stadium,
          city: m.city,
          phase: m.phase as Phase,
          groupId: m.group ? groupMap.get(m.group) : undefined,
          status: m.status,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          matchday: m.matchday,
        },
      })

      result.matches++

      // Calculate scores when a match just finished
      if (!wasFinished && m.status === 'FINISHED' && m.homeScore !== undefined && m.awayScore !== undefined) {
        const match = await prisma.match.findUnique({ where: { externalId: m.externalId } })
        if (match) {
          const n = await calculateMatchPoints(match.id, m.homeScore, m.awayScore)
          result.scoresCalculated += n
          result.matchesUpdated++
        }
      }
    } catch (err) {
      result.errors.push(`match ${m.externalId}: ${String(err)}`)
    }
  }

  return result
}

// Lightweight live sync — only updates scores for matches in LIVE/FINISHED state
export async function syncWorldCup26Live(): Promise<{ updated: number; scored: number; errors: string[] }> {
  const result = { updated: 0, scored: 0, errors: [] as string[] }
  const api = new WorldCup26Provider()

  let liveMatches
  try {
    liveMatches = await api.getMatches()
  } catch (err) {
    result.errors.push(String(err))
    return result
  }

  // Only care about matches that changed status or score
  const relevantMatches = liveMatches.filter(m => m.status === 'LIVE' || m.status === 'FINISHED')

  for (const m of relevantMatches) {
    try {
      const existing = await prisma.match.findUnique({ where: { externalId: m.externalId } })
      if (!existing) continue

      const wasFinished = existing.status === 'FINISHED'

      await prisma.match.update({
        where: { id: existing.id },
        data: {
          status: m.status,
          homeScore: m.homeScore ?? existing.homeScore,
          awayScore: m.awayScore ?? existing.awayScore,
        },
      })
      result.updated++

      if (!wasFinished && m.status === 'FINISHED' && m.homeScore !== undefined && m.awayScore !== undefined) {
        const n = await calculateMatchPoints(existing.id, m.homeScore, m.awayScore)
        result.scored += n
      }
    } catch (err) {
      result.errors.push(`${m.externalId}: ${String(err)}`)
    }
  }

  return result
}

async function calculateMatchPoints(matchId: string, homeScore: number, awayScore: number): Promise<number> {
  const [scoringRule, match] = await Promise.all([
    prisma.scoringRule.findFirst({ where: { isActive: true } }),
    prisma.match.findUnique({ where: { id: matchId } }),
  ])
  if (!scoringRule || !match) return 0

  const phaseMultiplier = getPhaseMultiplier(match.phase)
  const config = {
    exactScore: scoringRule.exactScore,
    correctResult: scoringRule.correctResult,
    goalDiff: scoringRule.goalDiff,
    noMatch: scoringRule.noMatch,
    bonusMultiplier: scoringRule.bonusMultiplier * phaseMultiplier,
  }

  const predictions = await prisma.prediction.findMany({ where: { matchId } })
  let updated = 0

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
    updated++
  }

  if (updated > 0) await rebuildRanking()
  return updated
}

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
      data: { positionPrev: p.position, position },
    })
  }
}
