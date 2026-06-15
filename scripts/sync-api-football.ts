/**
 * Sincroniza equipos y partidos del Mundial 2026 desde API-Football v3.
 * Una sola request — no gasta cuota innecesariamente.
 *
 *   npm run sync:af
 *
 * Requiere: API_FOOTBALL_KEY en .env.local
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, Phase } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// ── Validación de entorno ──────────────────────────────────────────────────────

const API_KEY = process.env.API_FOOTBALL_KEY ?? ''
const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io'
const PROVIDER = process.env.FOOTBALL_API_PROVIDER ?? 'api-football'

if (!API_KEY) {
  console.error('❌  API_FOOTBALL_KEY no está definida en .env.local')
  console.error('   Agrega: API_FOOTBALL_KEY="tu_key" en .env.local')
  process.exit(1)
}
if (PROVIDER !== 'api-football') {
  console.warn(`⚠️  FOOTBALL_API_PROVIDER="${PROVIDER}" — se esperaba "api-football"`)
}

// ── Tipos de API-Football v3 ───────────────────────────────────────────────────

interface AfFixture {
  fixture: {
    id: number
    date: string                 // ISO 8601 UTC
    timezone: string
    venue: { id: number | null; name: string | null; city: string | null }
    status: { long: string; short: string; elapsed: number | null }
  }
  league: { id: number; name: string; season: number; round: string }
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

// ── Mapeo de nombres a códigos FIFA ───────────────────────────────────────────
// api-football usa nombres en inglés; los mapeamos a códigos FIFA estándar.

const NAME_TO_FIFA_CODE: Record<string, string> = {
  'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR', 'Czech Republic': 'CZE',
  'Canada': 'CAN', 'Bosnia and Herzegovina': 'BIH', 'Qatar': 'QAT', 'Switzerland': 'SUI',
  'Haiti': 'HAI', 'Scotland': 'SCO', 'Australia': 'AUS', 'Turkey': 'TUR',
  'United States': 'USA', 'Panama': 'PAN', 'Iraq': 'IRQ', 'Norway': 'NOR',
  'Brazil': 'BRA', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
  'Germany': 'GER', 'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE',
  'Tunisia': 'TUN', 'France': 'FRA', 'Senegal': 'SEN', 'Argentina': 'ARG',
  'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR', 'England': 'ENG',
  'Croatia': 'CRO', 'Portugal': 'POR', 'DR Congo': 'COD', 'Congo DR': 'COD',
  'Uruguay': 'URU', 'Tahiti': 'TAH', 'Saudi Arabia': 'KSA', 'Morocco': 'MAR',
  'Iran': 'IRN', 'New Zealand': 'NZL', 'Chile': 'CHI', 'Peru': 'PER',
  'Colombia': 'COL', 'Belgium': 'BEL', 'Egypt': 'EGY', 'Serbia': 'SRB',
  'Indonesia': 'IDN', 'Spain': 'ESP', 'Greece': 'GRE', 'Romania': 'ROU',
  'Ghana': 'GHA', 'Uzbekistan': 'UZB', 'Hungary': 'HUN', 'Costa Rica': 'CRC',
  'Cameroon': 'CMR', 'Nigeria': 'NGA', 'Italy': 'ITA', 'Paraguay': 'PAR',
  'Kenya': 'KEN', 'Honduras': 'HON', 'Venezuela': 'VEN', 'Angola': 'ANG',
  'Gambia': 'GAM', 'Trinidad and Tobago': 'TRI', 'Azerbaijan': 'AZE',
  'Bolivia': 'BOL', "Côte d'Ivoire": 'CIV', 'Curacao': 'CUW',
}

function fifaCode(name: string, apiId: number): string {
  return NAME_TO_FIFA_CODE[name] ?? `AF${apiId}`
}

// ── Helpers de status / fase ───────────────────────────────────────────────────

const LIVE_ST  = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const DONE_ST  = new Set(['FT', 'AET', 'PEN'])
const POST_ST  = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

function mapStatus(s: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (LIVE_ST.has(s)) return 'LIVE'
  if (DONE_ST.has(s)) return 'FINISHED'
  if (POST_ST.has(s)) return 'POSTPONED'
  return 'SCHEDULED'
}

function mapPhase(round: string): Phase {
  const r = round.toLowerCase()
  if (r.includes('group'))                              return Phase.GROUP
  if (r.includes('round of 16') || r.includes('last 16')) return Phase.ROUND_OF_16
  if (r.includes('quarter'))                            return Phase.QUARTER_FINAL
  if (r.includes('semi'))                               return Phase.SEMI_FINAL
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return Phase.THIRD_PLACE
  if (r.includes('final'))                              return Phase.FINAL
  return Phase.GROUP
}

function matchday(round: string): number | undefined {
  const m = round.match(/(\d+)$/)
  return m ? parseInt(m[1]) : undefined
}

function score(f: AfFixture) {
  return {
    home: f.score.fulltime.home ?? f.goals.home ?? undefined,
    away: f.score.fulltime.away ?? f.goals.away ?? undefined,
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🔄  API-Football sync — league=1, season=2026`)
  console.log(`    Base URL: ${BASE_URL}\n`)

  // ── 1. Fetch fixtures ────────────────────────────────────────────────────────

  const res = await fetch(`${BASE_URL}/fixtures?league=1&season=2026`, {
    headers: { 'x-apisports-key': API_KEY },
  })

  if (!res.ok) {
    console.error(`❌  HTTP ${res.status} ${res.statusText}`)
    console.error(await res.text())
    process.exit(1)
  }

  const json = await res.json() as {
    response: AfFixture[]
    errors: Record<string, string>
    results: number
    paging: { current: number; total: number }
  }

  if (json.errors && Object.keys(json.errors).length > 0) {
    console.error('❌  API errors:', JSON.stringify(json.errors))
    process.exit(1)
  }

  const fixtures = json.response ?? []
  console.log(`✅  ${fixtures.length} fixtures recibidos`)
  console.log(`    Páginas: ${json.paging?.current ?? 1}/${json.paging?.total ?? 1}\n`)

  if (fixtures.length === 0) {
    console.log('ℹ️   Sin datos. Verifica que la key sea válida y que el torneo esté disponible.')
    return
  }

  // ── 2. Upsert equipos ────────────────────────────────────────────────────────

  console.log('📦  Sincronizando equipos...')

  // Collect unique teams from fixtures
  const teamsMap = new Map<number, { name: string; logo: string }>()
  for (const f of fixtures) {
    teamsMap.set(f.teams.home.id, { name: f.teams.home.name, logo: f.teams.home.logo })
    teamsMap.set(f.teams.away.id, { name: f.teams.away.name, logo: f.teams.away.logo })
  }

  const teamDbId = new Map<number, string>()   // apiId → DB id

  for (const [apiId, t] of teamsMap) {
    const code = fifaCode(t.name, apiId)
    const externalId = `af-team-${apiId}`

    // Upsert by code (unique field)
    const team = await prisma.team.upsert({
      where: { code },
      update: {
        name: t.name,
        flag: t.logo,
        externalId,
      },
      create: {
        name: t.name,
        code,
        flag: t.logo,
        externalId,
      },
    })

    teamDbId.set(apiId, team.id)
  }

  console.log(`   ✓ ${teamsMap.size} equipos upserted\n`)

  // ── 3. Upsert partidos ───────────────────────────────────────────────────────

  console.log('📅  Sincronizando partidos...')

  let created = 0, updated = 0, errors = 0

  for (const f of fixtures) {
    try {
      const homeTeamId = teamDbId.get(f.teams.home.id)
      const awayTeamId = teamDbId.get(f.teams.away.id)
      if (!homeTeamId || !awayTeamId) { errors++; continue }

      const externalId = `af-${f.fixture.id}`
      const status = mapStatus(f.fixture.status.short)
      const sc = score(f)
      const phase = mapPhase(f.league.round)

      // Winner
      let winnerTeamId: string | undefined
      if (status === 'FINISHED') {
        if (f.teams.home.winner === true) winnerTeamId = homeTeamId
        else if (f.teams.away.winner === true) winnerTeamId = awayTeamId
      }

      const existing = await prisma.match.findUnique({ where: { externalId } })

      if (existing) {
        await prisma.match.update({
          where: { externalId },
          data: {
            status,
            homeScore:    sc.home   ?? existing.homeScore,
            awayScore:    sc.away   ?? existing.awayScore,
            winnerTeamId: winnerTeamId ?? existing.winnerTeamId,
            stadium:      f.fixture.venue.name ?? existing.stadium,
            city:         f.fixture.venue.city ?? existing.city,
            phase,
            round:        f.league.round,
          },
        })
        updated++
      } else {
        await prisma.match.create({
          data: {
            externalId,
            homeTeamId,
            awayTeamId,
            kickoffAt:   new Date(f.fixture.date),
            stadium:     f.fixture.venue.name ?? undefined,
            city:        f.fixture.venue.city ?? undefined,
            phase,
            status,
            homeScore:   sc.home   ?? undefined,
            awayScore:   sc.away   ?? undefined,
            winnerTeamId,
            matchday:    matchday(f.league.round),
            round:       f.league.round,
          },
        })
        created++
      }
    } catch (e) {
      console.error(`   ⚠️  fixture ${f.fixture.id}: ${(e as Error).message}`)
      errors++
    }
  }

  console.log(`   ✓ ${created} nuevos · ${updated} actualizados · ${errors} errores\n`)

  // ── 4. Resumen ───────────────────────────────────────────────────────────────

  const byStatus = fixtures.reduce((acc, f) => {
    const s = mapStatus(f.fixture.status.short)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log('📊  Resumen del torneo:')
  console.log(`    Finalizados: ${byStatus['FINISHED'] ?? 0}`)
  console.log(`    En vivo:     ${byStatus['LIVE'] ?? 0}`)
  console.log(`    Programados: ${byStatus['SCHEDULED'] ?? 0}`)
  if (byStatus['POSTPONED']) console.log(`    Pospuestos:  ${byStatus['POSTPONED']}`)

  console.log('\n✅  Sync completo. Corre: npm run predictions:generate')
}

main()
  .catch(e => { console.error('❌  Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
