/**
 * Sync all World Cup 2026 fixtures from api-football v3.
 *   npm run sync:af
 *
 * Requires API_FOOTBALL_KEY in .env.local
 * Free tier: 100 req/day — this script uses 1 request.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, Phase } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const API_KEY = process.env.API_FOOTBALL_KEY ?? process.env.FOOTBALL_API_KEY ?? ''

if (!API_KEY) {
  console.error('❌  Falta API_FOOTBALL_KEY en .env.local')
  process.exit(1)
}

interface ApiFixture {
  fixture: {
    id: number
    date: string
    venue: { name: string | null; city: string | null }
    status: { short: string }
  }
  league: { round: string }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const DONE = new Set(['FT', 'AET', 'PEN'])
const POST = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

const NAME_TO_CODE: Record<string, string> = {
  'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR', 'Czech Republic': 'CZE',
  'Canada': 'CAN', 'Bosnia and Herzegovina': 'BIH', 'Qatar': 'QAT', 'Switzerland': 'SUI',
  'Haiti': 'HAI', 'Scotland': 'SCO', 'Australia': 'AUS', 'Turkey': 'TUR',
  'United States': 'USA', 'Panama': 'PAN', 'Iraq': 'IRQ', 'Norway': 'NOR',
  'Brazil': 'BRA', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
  'Germany': 'GER', 'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE',
  'Tunisia': 'TUN', 'France': 'FRA', 'Senegal': 'SEN', 'Argentina': 'ARG',
  'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR', 'England': 'ENG',
  'Croatia': 'CRO', 'Portugal': 'POR', 'DR Congo': 'COD', 'Uruguay': 'URU',
  'Tahiti': 'TAH', 'Saudi Arabia': 'KSA', 'Morocco': 'MAR', 'Iran': 'IRN',
  'New Zealand': 'NZL', 'Chile': 'CHI', 'Peru': 'PER', 'Colombia': 'COL',
  'Belgium': 'BEL', 'Egypt': 'EGY', 'Serbia': 'SRB', 'Indonesia': 'IDN',
  'Spain': 'ESP', 'Greece': 'GRE', 'Romania': 'ROU', 'Ghana': 'GHA',
  'Uzbekistan': 'UZB', 'Hungary': 'HUN', 'Costa Rica': 'CRC', 'Cameroon': 'CMR',
  'Nigeria': 'NGA', 'Italy': 'ITA', 'Paraguay': 'PAR', 'Kenya': 'KEN',
  'Honduras': 'HON', 'Venezuela': 'VEN', 'Angola': 'ANG', 'Gambia': 'GAM',
  'Trinidad and Tobago': 'TRI', 'Azerbaijan': 'AZE', 'Bolivia': 'BOL',
}

function teamCode(name: string, id: number): string {
  return NAME_TO_CODE[name] ?? `AF${id}`
}

function mapStatus(short: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (LIVE.has(short)) return 'LIVE'
  if (DONE.has(short)) return 'FINISHED'
  if (POST.has(short)) return 'POSTPONED'
  return 'SCHEDULED'
}

function mapPhase(round: string): Phase {
  const r = round.toLowerCase()
  if (r.includes('group')) return Phase.GROUP
  if (r.includes('round of 16') || r.includes('last 16')) return Phase.ROUND_OF_16
  if (r.includes('quarter')) return Phase.QUARTER_FINAL
  if (r.includes('semi')) return Phase.SEMI_FINAL
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return Phase.THIRD_PLACE
  if (r.includes('final')) return Phase.FINAL
  return Phase.GROUP
}

async function main() {
  console.log('Fetching fixtures from api-football v3...')
  const res = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026', {
    headers: { 'x-apisports-key': API_KEY },
  })

  if (!res.ok) {
    console.error(`❌  HTTP ${res.status}:`, await res.text())
    process.exit(1)
  }

  const json = await res.json() as {
    response: ApiFixture[]
    errors: unknown
    results: number
    paging: { current: number; total: number }
  }

  if (json.errors && typeof json.errors === 'object' && Object.keys(json.errors as object).length > 0) {
    console.error('❌  API errors:', json.errors)
    process.exit(1)
  }

  const fixtures: ApiFixture[] = json.response ?? []
  console.log(`  ${fixtures.length} fixtures recibidos (paging: ${json.paging?.current}/${json.paging?.total})`)

  if (fixtures.length === 0) {
    console.log('  Sin datos — verifica que la key sea válida y el torneo esté en la base de datos.')
    return
  }

  // Extract unique teams
  const teamsMap = new Map<number, { id: number; name: string; logo: string }>()
  for (const f of fixtures) {
    teamsMap.set(f.teams.home.id, f.teams.home)
    teamsMap.set(f.teams.away.id, f.teams.away)
  }

  // Upsert teams (code = FIFA code or AF{id})
  const teamDbIdByApiId = new Map<number, string>()
  let teamsUpserted = 0

  for (const t of teamsMap.values()) {
    const code = teamCode(t.name, t.id)
    const team = await prisma.team.upsert({
      where: { code },
      update: { name: t.name, flag: t.logo, externalId: String(t.id) },
      create: { name: t.name, code, flag: t.logo, externalId: String(t.id) },
    })
    teamDbIdByApiId.set(t.id, team.id)
    teamsUpserted++
  }
  console.log(`  ✓ ${teamsUpserted} equipos`)

  // Upsert matches
  let matchesUpserted = 0, errors = 0

  for (const f of fixtures) {
    try {
      const homeTeamId = teamDbIdByApiId.get(f.teams.home.id)
      const awayTeamId = teamDbIdByApiId.get(f.teams.away.id)
      if (!homeTeamId || !awayTeamId) continue

      const short = f.fixture.status.short
      const status = mapStatus(short)
      const homeScore = f.score.fulltime.home ?? f.goals.home ?? undefined
      const awayScore = f.score.fulltime.away ?? f.goals.away ?? undefined
      const matchdayMatch = f.league.round.match(/(\d+)$/)
      const matchday = matchdayMatch ? parseInt(matchdayMatch[1]) : undefined

      await prisma.match.upsert({
        where: { externalId: `af-${f.fixture.id}` },
        update: {
          status,
          homeScore: homeScore ?? undefined,
          awayScore: awayScore ?? undefined,
          stadium: f.fixture.venue.name ?? undefined,
          city: f.fixture.venue.city ?? undefined,
          phase: mapPhase(f.league.round),
        },
        create: {
          externalId: `af-${f.fixture.id}`,
          homeTeamId,
          awayTeamId,
          kickoffAt: new Date(f.fixture.date),
          stadium: f.fixture.venue.name ?? undefined,
          city: f.fixture.venue.city ?? undefined,
          phase: mapPhase(f.league.round),
          status,
          homeScore: homeScore ?? undefined,
          awayScore: awayScore ?? undefined,
          matchday,
        },
      })
      matchesUpserted++
    } catch (e) {
      console.error(`  ⚠️  fixture ${f.fixture.id}:`, (e as Error).message)
      errors++
    }
  }

  console.log(`  ✓ ${matchesUpserted} partidos upserted`)
  if (errors > 0) console.log(`  ⚠️  ${errors} errores`)
  console.log('\n🎉 Sync completo.')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
