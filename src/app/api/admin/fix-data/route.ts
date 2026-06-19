import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { calcPoints, DEFAULT_SCORING } from '@/lib/scoring'

export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token || !process.env.FIX_DATA_SECRET || token !== process.env.FIX_DATA_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Score corrections for June 18
  const scoreUpdates = [
    { home: 'Mexico',  away: 'South Korea', homeScore: 1, awayScore: 0, status: 'FINISHED' as const },
    { home: 'Canada',  away: 'Qatar',        homeScore: 6, awayScore: 0, status: 'FINISHED' as const },
  ]

  const scoreResults: Record<string, string> = {}
  for (const u of scoreUpdates) {
    const ht = await prisma.team.findFirst({ where: { name: u.home } })
    const at = await prisma.team.findFirst({ where: { name: u.away } })
    if (!ht || !at) { scoreResults[`${u.home} vs ${u.away}`] = 'not found'; continue }
    const match = await prisma.match.findFirst({ where: { homeTeamId: ht.id, awayTeamId: at.id } })
    if (!match) { scoreResults[`${u.home} vs ${u.away}`] = 'match not found'; continue }
    await prisma.match.update({ where: { id: match.id }, data: { homeScore: u.homeScore, awayScore: u.awayScore, status: u.status } })
    scoreResults[`${u.home} vs ${u.away}`] = `${u.homeScore}-${u.awayScore} FINISHED`
  }

  // Full recalculate from scratch
  const config = (await prisma.scoringRule.findFirst({ where: { isActive: true } })) ?? DEFAULT_SCORING
  await prisma.participant.updateMany({ data: { totalPoints: 0, exactHits: 0, resultHits: 0 } })
  await prisma.prediction.updateMany({ data: { points: 0, isLocked: false } })

  const finished = await prisma.match.findMany({ where: { status: 'FINISHED', homeScore: { not: null }, awayScore: { not: null } } })
  let predictionsScored = 0
  for (const m of finished) {
    const preds = await prisma.prediction.findMany({ where: { matchId: m.id } })
    for (const p of preds) {
      const pts = calcPoints(p.homeScore, p.awayScore, m.homeScore!, m.awayScore!, config)
      const ex = p.homeScore === m.homeScore && p.awayScore === m.awayScore
      const res = !ex && Math.sign(p.homeScore - p.awayScore) === Math.sign(m.homeScore! - m.awayScore!)
      await prisma.prediction.update({ where: { id: p.id }, data: { points: pts, isLocked: true } })
      await prisma.participant.update({ where: { id: p.participantId }, data: {
        totalPoints: { increment: pts },
        exactHits: ex ? { increment: 1 } : undefined,
        resultHits: res ? { increment: 1 } : undefined,
      }})
      predictionsScored++
    }
  }

  // Rebuild rankings
  const all = await prisma.participant.findMany({ orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }, { resultHits: 'desc' }] })
  let pos = 1
  for (let i = 0; i < all.length; i++) {
    if (i > 0 && (all[i].totalPoints !== all[i-1].totalPoints || all[i].exactHits !== all[i-1].exactHits)) pos = i + 1
    await prisma.participant.update({ where: { id: all[i].id }, data: { positionPrev: all[i].position, position: pos } })
  }

  return NextResponse.json({
    ok: true,
    scoresUpdated: scoreResults,
    matchesScored: finished.length,
    predictionsScored,
    participants: all.length,
    top5: all.slice(0, 5).map((p, i) => `#${i + 1} ${p.displayName}: ${p.totalPoints}pts (★${p.exactHits} ✓${p.resultHits})`),
  })
}
