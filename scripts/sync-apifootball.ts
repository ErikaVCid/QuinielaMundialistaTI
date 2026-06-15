/**
 * Sincroniza equipos y partidos del Mundial 2026 desde API-Football v3.
 * Usa 1 sola request — no gasta cuota innecesariamente.
 *   npm run sync:af
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, Phase } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const API_KEY = process.env.API_FOOTBALL_KEY ?? ''
const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io'

if (!API_KEY) {
  console.error('❌  Falta API_FOOTBALL_KEY en .env.local')
  process.exit(1)
}

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface AfFixture {
  fixture: {
    id: number
    date: string
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const LIVE_ST = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const DONE_ST = new Set(['FT', 'AET', 'PEN'])
const POST_ST = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

function mapStatus(s: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (LIVE_ST.has(s)) return 'LIVE'
  if (DONE_ST.has(s)) return 'FINISHED'
  if (POST_ST.has(s)) return 'POSTPONED'
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
  console.log('🔄  Fetching fixtures from API-Football (league=1, season=2026)...')

  const res = await fetch(`${BASE_URL}/fixtures?league=1&season=2026`, {
    headers: { 'x-apisports-key': API_KEY },
  })

  if (!res.ok) {
    console.error(`❌  HTTP ${res.status}: ${await res.text()}`)
    process.exit(1)
  }

  const json = await res.json() as {
    response: AfFixture[]
    errors: Record<string, string>
    results: number
    paging: { current: number; total: number }
  }

  if (Object.keys(json.errors ?? {}).length > 0) {
    console.error('❌  API errors:', JSON.stringify(json.errors))
    process.exit(1)
  }

  const fixtures = json.response ?? []
  console.log(`   ${fixtures.length} fixtures · pág ${json.paging?.current}/${json.paging?.total}`)

  if (fixtures.length === 0) {
    console.log('   Sin datos. Verifica que la key sea válida y el torneo esté disponible.')
    return
  }

  // ── Equipos ──────────────────────────────────────────────────────────────────

  console.log('\n📦  Sincronizando equipos...')
  const teamsMap = new Map<number, { name: string; logo: string }>()
  for (const f of fixtures) {
    teamsMap.set(f.teams.home.id, { name: f.teams.home.name, logo: f.teams.home.logo })
    teamsMap.set(f.teams.away.id, { name: f.teams.away.name, logo: f.teams.away.logo })
  }

  const teamDbId = new Map<number, string>()   // apiId → DB cuid

  for (const [apiId, t] of teamsMap) {
    // Derive a readable 3-letter code; fall back to AF{id} if collision
    const readableCode = t.name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase()
    const fallbackCode = `A${String(apiId).slice(-2).padStart(2, '0')}`

    let team
    // Try to find existing team by externalId first
    const existing = await prisma.team.findFirst({ where: { externalId: `af-team-${apiId}` } })
    if (existing) {
      team = await prisma.team.update({
        where: { id: existing.id },
        data: { name: t.name, flag: t.logo },
      })
    } else {
      // Try readable code, fall back to numeric if taken
      const code = (await prisma.team.findUnique({ where: { code: readableCode } })) === null
        ? readableCode
        : fallbackCode
      team = await prisma.team.create({
        data: { name: t.name, code, flag: t.logo, externalId: `af-team-${apiId}` },
      })
    }

    teamDbId.set(apiId, team.id)
  }
  console.log(`   ✓ ${teamsMap.size} equipos upserted`)

  // ── Partidos ─────────────────────────────────────────────────────────────────

  console.log('\n📅  Sincronizando partidos...')
  let upserted = 0, updated = 0, errors = 0

  for (const f of fixtures) {
    try {
      const homeTeamId = teamDbId.get(f.teams.home.id)
      const awayTeamId = teamDbId.get(f.teams.away.id)
      if (!homeTeamId || !awayTeamId) { errors++; continue }

      const externalId = `af-${f.fixture.id}`
      const status = mapStatus(f.fixture.status.short)
      const sc = score(f)
      const phase = mapPhase(f.league.round)
      const md = matchday(f.league.round)

      // Determine winner
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
            homeScore: sc.home ?? existing.homeScore,
            awayScore: sc.away ?? existing.awayScore,
            winnerTeamId: winnerTeamId ?? existing.winnerTeamId,
            stadium: f.fixture.venue.name ?? existing.stadium,
            city: f.fixture.venue.city ?? existing.city,
            phase,
            round: f.league.round,
          },
        })
        updated++
      } else {
        await prisma.match.create({
          data: {
            externalId,
            homeTeamId,
            awayTeamId,
            kickoffAt: new Date(f.fixture.date),
            stadium: f.fixture.venue.name ?? undefined,
            city: f.fixture.venue.city ?? undefined,
            phase,
            status,
            homeScore: sc.home ?? undefined,
            awayScore: sc.away ?? undefined,
            winnerTeamId,
            matchday: md,
            round: f.league.round,
          },
        })
        upserted++
      }
    } catch (e) {
      console.error(`   ⚠️  fixture ${f.fixture.id}:`, (e as Error).message)
      errors++
    }
  }

  console.log(`   ✓ ${upserted} nuevos · ${updated} actualizados · ${errors} errores`)

  // ── Resumen ──────────────────────────────────────────────────────────────────

  const finished = fixtures.filter(f => DONE_ST.has(f.fixture.status.short)).length
  const live = fixtures.filter(f => LIVE_ST.has(f.fixture.status.short)).length
  const scheduled = fixtures.length - finished - live

  console.log(`\n📊  Resumen:`)
  console.log(`   Finalizados: ${finished}`)
  console.log(`   En vivo:     ${live}`)
  console.log(`   Programados: ${scheduled}`)
  console.log('\n✅  Sync completo. Recarga http://localhost:3000/partidos')
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
