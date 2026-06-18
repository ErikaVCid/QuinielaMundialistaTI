import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcPoints, DEFAULT_SCORING } from '@/lib/scoring'

// Updates June 18 scores and recalculates all points from scratch.
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token || !process.env.FIX_DATA_SECRET || token !== process.env.FIX_DATA_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 1. Update June 18 scores
  const scoreUpdates = [
    { home: 'Czech Republic',  away: 'South Africa',           homeScore: 1, awayScore: 1, status: 'FINISHED' as const },
    { home: 'Switzerland',     away: 'Bosnia and Herzegovina', homeScore: 4, awayScore: 1, status: 'FINISHED' as const },
    { home: 'Canada',          away: 'Qatar',                  homeScore: 1, awayScore: 0, status: 'FINISHED' as const },
  ]

  const scoreResults: Record<string, string> = {}
  for (const u of scoreUpdates) {
    const ht = await prisma.team.findFirst({ where: { name: u.home } })
    const at = await prisma.team.findFirst({ where: { name: u.away } })
    if (!ht || !at) { scoreResults[`${u.home} vs ${u.away}`] = 'team not found'; continue }
    const match = await prisma.match.findFirst({ where: { homeTeamId: ht.id, awayTeamId: at.id } })
    if (!match) { scoreResults[`${u.home} vs ${u.away}`] = 'match not found'; continue }
    await prisma.match.update({
      where: { id: match.id },
      data: { homeScore: u.homeScore, awayScore: u.awayScore, status: u.status },
    })
    scoreResults[`${u.home} vs ${u.away}`] = `${u.homeScore}-${u.awayScore} FINISHED`
  }

  // 2. Recalculate all points from scratch
  const scoringRule = await prisma.scoringRule.findFirst({ where: { isActive: true } })
  const config = scoringRule ?? DEFAULT_SCORING

  await prisma.participant.updateMany({ data: { totalPoints: 0, exactHits: 0, resultHits: 0 } })
  await prisma.prediction.updateMany({ data: { points: 0, isLocked: false } })

  const finishedMatches = await prisma.match.findMany({
    where: { status: 'FINISHED', homeScore: { not: null }, awayScore: { not: null } },
  })

  let predictionsScored = 0
  for (const match of finishedMatches) {
    const predictions = await prisma.prediction.findMany({ where: { matchId: match.id } })
    for (const pred of predictions) {
      const pts = calcPoints(pred.homeScore, pred.awayScore, match.homeScore!, match.awayScore!, config)
      const isExact = pred.homeScore === match.homeScore && pred.awayScore === match.awayScore
      const isResult = !isExact && Math.sign(pred.homeScore - pred.awayScore) === Math.sign(match.homeScore! - match.awayScore!)
      await prisma.prediction.update({ where: { id: pred.id }, data: { points: pts, isLocked: true } })
      await prisma.participant.update({
        where: { id: pred.participantId },
        data: {
          totalPoints: { increment: pts },
          exactHits: isExact ? { increment: 1 } : undefined,
          resultHits: isResult ? { increment: 1 } : undefined,
        },
      })
      predictionsScored++
    }
  }

  // 3. Rebuild rankings
  const all = await prisma.participant.findMany({
    orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }, { resultHits: 'desc' }],
  })
  let pos = 1
  for (let i = 0; i < all.length; i++) {
    if (i > 0 && (all[i].totalPoints !== all[i-1].totalPoints || all[i].exactHits !== all[i-1].exactHits)) pos = i + 1
    await prisma.participant.update({
      where: { id: all[i].id },
      data: { positionPrev: all[i].position, position: pos },
    })
  }

  const top5 = all.slice(0, 5).map((p, i) => `#${i+1} ${p.displayName}: ${p.totalPoints}pts`)

  return NextResponse.json({
    ok: true,
    scoresUpdated: scoreResults,
    matchesScored: finishedMatches.length,
    predictionsScored,
    participants: all.length,
    top5,
  })
}
