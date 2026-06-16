import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time fix: correct kickoff times and scores for June 15-16 2026 matches.
// Protected by AUTH_SECRET token. Call with:
//   curl -X POST https://quiniela-mundialmx.vercel.app/api/admin/fix-data \
//     -H "Authorization: Bearer <AUTH_SECRET>"
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token || token !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, string> = {}

  // --- Kickoff time fixes (stored as CST = UTC-6, displayed as CST) ---
  const timeFixes = [
    // Jun 15
    { home: 'Spain',        away: 'Cape Verde',  time: '2026-06-15T10:00:00' },
    { home: 'Belgium',      away: 'Egypt',        time: '2026-06-15T13:00:00' },
    { home: 'Saudi Arabia', away: 'Uruguay',      time: '2026-06-15T16:00:00' },
    { home: 'Iran',         away: 'New Zealand',  time: '2026-06-15T19:00:00' },
    // Jun 16
    { home: 'France',       away: 'Senegal',      time: '2026-06-16T13:00:00' },
    { home: 'Iraq',         away: 'Norway',       time: '2026-06-16T16:00:00' },
    { home: 'Argentina',    away: 'Algeria',      time: '2026-06-16T19:00:00' },
    { home: 'Austria',      away: 'Jordan',       time: '2026-06-16T22:00:00' },
  ]

  for (const fix of timeFixes) {
    const homeTeam = await prisma.team.findFirst({ where: { name: fix.home } })
    const awayTeam = await prisma.team.findFirst({ where: { name: fix.away } })
    if (!homeTeam || !awayTeam) {
      results[`${fix.home} vs ${fix.away}`] = 'team not found'
      continue
    }
    const match = await prisma.match.findFirst({
      where: { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id },
    })
    if (!match) {
      results[`${fix.home} vs ${fix.away}`] = 'match not found'
      continue
    }
    await prisma.match.update({
      where: { id: match.id },
      data: { kickoffAt: new Date(fix.time) },
    })
    results[`${fix.home} vs ${fix.away}`] = `time → ${fix.time}`
  }

  // --- Score fixes for finished matches ---
  const scoreFixes = [
    { home: 'Spain',        away: 'Cape Verde',  homeScore: 0, awayScore: 0, status: 'FINISHED' as const },
    { home: 'Belgium',      away: 'Egypt',        homeScore: 1, awayScore: 1, status: 'FINISHED' as const },
    { home: 'Saudi Arabia', away: 'Uruguay',      homeScore: 1, awayScore: 1, status: 'FINISHED' as const },
    { home: 'Iran',         away: 'New Zealand',  homeScore: 2, awayScore: 2, status: 'FINISHED' as const },
    { home: 'France',       away: 'Senegal',      homeScore: 0, awayScore: 0, status: 'LIVE'     as const },
  ]

  for (const fix of scoreFixes) {
    const homeTeam = await prisma.team.findFirst({ where: { name: fix.home } })
    const awayTeam = await prisma.team.findFirst({ where: { name: fix.away } })
    if (!homeTeam || !awayTeam) continue
    const match = await prisma.match.findFirst({
      where: { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id },
    })
    if (!match) continue
    await prisma.match.update({
      where: { id: match.id },
      data: { homeScore: fix.homeScore, awayScore: fix.awayScore, status: fix.status },
    })
    results[`score:${fix.home} vs ${fix.away}`] = `${fix.homeScore}-${fix.awayScore} ${fix.status}`
  }

  return NextResponse.json({ ok: true, results })
}
