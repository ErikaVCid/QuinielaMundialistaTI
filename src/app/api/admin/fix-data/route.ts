import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// One-time score update for June 16-18 matches.
export async function POST(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token || !process.env.FIX_DATA_SECRET || token !== process.env.FIX_DATA_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  type MatchStatus = 'FINISHED' | 'LIVE' | 'SCHEDULED'
  const updates: { home: string; away: string; homeScore: number; awayScore: number; status: MatchStatus }[] = [
    // Jun 16
    { home: 'France',       away: 'Senegal',                          homeScore: 3, awayScore: 1, status: 'FINISHED' },
    { home: 'Iraq',         away: 'Norway',                           homeScore: 1, awayScore: 4, status: 'FINISHED' },
    { home: 'Argentina',    away: 'Algeria',                          homeScore: 3, awayScore: 0, status: 'FINISHED' },
    { home: 'Austria',      away: 'Jordan',                           homeScore: 3, awayScore: 1, status: 'FINISHED' },
    // Jun 17
    { home: 'Portugal',     away: 'Democratic Republic of the Congo', homeScore: 1, awayScore: 1, status: 'FINISHED' },
    { home: 'England',      away: 'Croatia',                          homeScore: 4, awayScore: 2, status: 'FINISHED' },
    { home: 'Ghana',        away: 'Panama',                           homeScore: 1, awayScore: 0, status: 'FINISHED' },
    { home: 'Uzbekistan',   away: 'Colombia',                         homeScore: 1, awayScore: 3, status: 'FINISHED' },
    // Jun 18 (en vivo)
    { home: 'Czech Republic', away: 'South Africa',                   homeScore: 1, awayScore: 0, status: 'LIVE'     },
  ]

  const results: Record<string, string> = {}

  for (const u of updates) {
    const homeTeam = await prisma.team.findFirst({ where: { name: u.home } })
    const awayTeam = await prisma.team.findFirst({ where: { name: u.away } })
    if (!homeTeam || !awayTeam) { results[`${u.home} vs ${u.away}`] = 'team not found'; continue }
    const match = await prisma.match.findFirst({ where: { homeTeamId: homeTeam.id, awayTeamId: awayTeam.id } })
    if (!match) { results[`${u.home} vs ${u.away}`] = 'match not found'; continue }
    await prisma.match.update({
      where: { id: match.id },
      data: { homeScore: u.homeScore, awayScore: u.awayScore, status: u.status },
    })
    results[`${u.home} vs ${u.away}`] = `${u.homeScore}-${u.awayScore} ${u.status}`
  }

  return NextResponse.json({ ok: true, results })
}
