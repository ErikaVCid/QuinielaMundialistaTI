import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time fix: correct kickoff times (stored as UTC) and scores for June 15-16 2026.
// All times are UTC so formatInTimeZone(..., 'America/Mexico_City') renders correct CST.
// Call with: curl -X POST https://quiniela-mundialmx.vercel.app/api/admin/fix-data
//              -H "Authorization: Bearer <FIX_DATA_SECRET>"
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  const validToken = process.env.FIX_DATA_SECRET
  if (!token || !validToken || token !== validToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const results: Record<string, string> = {}

  // Kickoff times stored in UTC → displayed as CST (UTC-6) via formatInTimeZone
  const timeFixes = [
    // Jun 15 — CST times: 10:00, 13:00, 16:00, 19:00
    { home: 'Spain',        away: 'Cape Verde',  utc: '2026-06-15T16:00:00Z' }, // 10:00 CST
    { home: 'Belgium',      away: 'Egypt',        utc: '2026-06-15T19:00:00Z' }, // 13:00 CST
    { home: 'Saudi Arabia', away: 'Uruguay',      utc: '2026-06-15T22:00:00Z' }, // 16:00 CST
    { home: 'Iran',         away: 'New Zealand',  utc: '2026-06-16T01:00:00Z' }, // 19:00 CST
    // Jun 16 — CST times: 13:00, 16:00, 19:00, 22:00
    { home: 'France',       away: 'Senegal',      utc: '2026-06-16T19:00:00Z' }, // 13:00 CST
    { home: 'Iraq',         away: 'Norway',       utc: '2026-06-16T22:00:00Z' }, // 16:00 CST
    { home: 'Argentina',    away: 'Algeria',      utc: '2026-06-17T01:00:00Z' }, // 19:00 CST
    { home: 'Austria',      away: 'Jordan',       utc: '2026-06-17T04:00:00Z' }, // 22:00 CST
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
      data: { kickoffAt: new Date(fix.utc) },
    })
    results[`${fix.home} vs ${fix.away}`] = `→ ${fix.utc}`
  }

  // Score fixes for finished/live matches
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
