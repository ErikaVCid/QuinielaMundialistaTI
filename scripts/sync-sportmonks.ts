/**
 * Sync World Cup 2026 fixtures from Sportmonks v3.
 *   npm run sync:sm           — sync fixtures (requires SPORTMONKS_SEASON_ID)
 *   npm run sync:sm:discover  — find & print available World Cup seasons
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, Phase } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })
const API_KEY = process.env.SPORTMONKS_API_KEY ?? ''
const SEASON_ID = process.env.SPORTMONKS_SEASON_ID ?? ''
const BASE = 'https://api.sportmonks.com/v3/football'

if (!API_KEY) {
  console.error('❌  Falta SPORTMONKS_API_KEY en .env.local')
  process.exit(1)
}

async function smFetch<T>(path: string): Promise<{ data: T; pagination?: { has_more: boolean; next_page: string | null } }> {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: API_KEY } })
  if (!res.ok) throw new Error(`Sportmonks ${res.status}: ${await res.text()}`)
  return res.json() as Promise<{ data: T; pagination?: { has_more: boolean; next_page: string | null } }>
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const sep = path.includes('?') ? '&' : '?'
  const includes = 'participants;scores;venue;round'
  let current = `${path}${sep}include=${includes}&per_page=50&page=1`
  const all: T[] = []
  while (current) {
    const res = await smFetch<T[]>(current)
    all.push(...res.data)
    current = (res.pagination?.has_more && res.pagination.next_page)
      ? res.pagination.next_page.replace(BASE, '')
      : ''
  }
  return all
}

interface SmParticipant {
  id: number; name: string; short_code: string; image_path: string
  meta: { location: 'home' | 'away'; winner: boolean | null }
}
interface SmScore {
  score: { goals: number; participant: 'home' | 'away' }
  description: string
}
interface SmFixture {
  id: number; state_id: number; starting_at: string
  participants?: SmParticipant[]
  scores?: SmScore[]
  venue?: { id: number; name: string; city_name: string | null }
  round?: { name: string }
  stage?: { name: string }
}

const SM_LIVE = new Set([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14])
const SM_DONE = new Set([15, 16, 17, 21])
const SM_POST = new Set([18, 19, 20])

function mapStatus(sid: number): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (SM_LIVE.has(sid)) return 'LIVE'
  if (SM_DONE.has(sid)) return 'FINISHED'
  if (SM_POST.has(sid)) return 'POSTPONED'
  return 'SCHEDULED'
}

function mapPhase(round?: string, stage?: string): Phase {
  const r = (round ?? stage ?? '').toLowerCase()
  if (r.includes('group')) return Phase.GROUP
  if (r.includes('round of 16') || r.includes('last 16') || r.includes('1/8')) return Phase.ROUND_OF_16
  if (r.includes('quarter')) return Phase.QUARTER_FINAL
  if (r.includes('semi')) return Phase.SEMI_FINAL
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return Phase.THIRD_PLACE
  if (r.includes('final')) return Phase.FINAL
  return Phase.GROUP
}

// ── DISCOVER MODE ──────────────────────────────────────────────────────────────
async function discover() {
  console.log('Buscando temporadas de FIFA World Cup en Sportmonks...\n')
  const res = await smFetch<Array<{ id: number; name: string; league_id: number }>>(
    '/seasons?filters[seasonLeagueIds]=8'
  )
  const seasons = Array.isArray(res.data) ? res.data : []
  if (seasons.length === 0) {
    // Try without filter — Sportmonks league ID might differ
    console.log('Liga 8 sin resultados. Buscando por nombre...')
    const all = await smFetch<Array<{ id: number; name: string; league_id: number }>>('/seasons?per_page=50')
    const wc = (Array.isArray(all.data) ? all.data : []).filter(s => /world.?cup/i.test(s.name) || s.league_id === 8)
    if (wc.length === 0) {
      console.log('No se encontraron temporadas de World Cup. Muestra de temporadas disponibles:')
      ;(Array.isArray(all.data) ? all.data : []).slice(0, 10).forEach(s =>
        console.log(`  id=${s.id}  league=${s.league_id}  name="${s.name}"`)
      )
    } else {
      console.log('Temporadas encontradas:')
      wc.forEach(s => console.log(`  id=${s.id}  league=${s.league_id}  name="${s.name}"`))
    }
  } else {
    console.log('Temporadas de FIFA World Cup (liga 8):')
    seasons.forEach(s => console.log(`  id=${s.id}  name="${s.name}"`))
    console.log(`\nAgrega a .env.local:\n  SPORTMONKS_SEASON_ID="${seasons[seasons.length - 1].id}"`)
  }
}

// ── SYNC MODE ──────────────────────────────────────────────────────────────────
async function sync() {
  if (!SEASON_ID) {
    console.error('❌  Falta SPORTMONKS_SEASON_ID en .env.local')
    console.error('   Corre primero: npm run sync:sm:discover')
    process.exit(1)
  }

  console.log(`Fetching fixtures — season ${SEASON_ID}...`)
  let fixtures: SmFixture[]
  try {
    fixtures = await fetchAllPages<SmFixture>(`/fixtures/seasons/${SEASON_ID}`)
  } catch (e) {
    console.error('❌  Error fetching fixtures:', (e as Error).message)
    process.exit(1)
  }
  console.log(`  ${fixtures.length} fixtures recibidos`)

  const teamCodeToDbId = new Map<string, string>()
  let teamsUpserted = 0, matchesUpserted = 0, errors = 0

  for (const f of fixtures) {
    const home = f.participants?.find(p => p.meta.location === 'home')
    const away = f.participants?.find(p => p.meta.location === 'away')
    if (!home || !away) continue

    // Upsert teams
    for (const t of [home, away]) {
      const code = t.short_code || t.name.substring(0, 3).toUpperCase()
      if (!teamCodeToDbId.has(code)) {
        const team = await prisma.team.upsert({
          where: { code },
          update: { name: t.name, flag: t.image_path, externalId: String(t.id) },
          create: { name: t.name, code, flag: t.image_path, externalId: String(t.id) },
        })
        teamCodeToDbId.set(code, team.id)
        teamsUpserted++
      }
    }

    const homeCode = home.short_code || home.name.substring(0, 3).toUpperCase()
    const awayCode = away.short_code || away.name.substring(0, 3).toUpperCase()
    const homeTeamId = teamCodeToDbId.get(homeCode)
    const awayTeamId = teamCodeToDbId.get(awayCode)
    if (!homeTeamId || !awayTeamId) continue

    const currentScores = (f.scores ?? []).filter(s => s.description === 'CURRENT')
    const homeScore = currentScores.find(s => s.score.participant === 'home')?.score.goals
    const awayScore = currentScores.find(s => s.score.participant === 'away')?.score.goals
    const status = mapStatus(f.state_id)
    const phase = mapPhase(f.round?.name, f.stage?.name)

    try {
      await prisma.match.upsert({
        where: { externalId: `sm-${f.id}` },
        update: {
          status,
          homeScore: homeScore ?? undefined,
          awayScore: awayScore ?? undefined,
          stadium: f.venue?.name ?? undefined,
          city: f.venue?.city_name ?? undefined,
          phase,
        },
        create: {
          externalId: `sm-${f.id}`,
          homeTeamId,
          awayTeamId,
          kickoffAt: new Date(f.starting_at),
          stadium: f.venue?.name ?? undefined,
          city: f.venue?.city_name ?? undefined,
          phase,
          status,
          homeScore: homeScore ?? undefined,
          awayScore: awayScore ?? undefined,
        },
      })
      matchesUpserted++
    } catch (e) {
      console.error(`  ⚠️  fixture ${f.id}:`, (e as Error).message)
      errors++
    }
  }

  console.log(`  ✓ ${teamsUpserted} equipos`)
  console.log(`  ✓ ${matchesUpserted} partidos`)
  if (errors > 0) console.log(`  ⚠️  ${errors} errores`)
  console.log('\n🎉 Sync completo.')
}

// Run
const mode = process.argv[2]
const fn = mode === 'discover' ? discover : sync
fn().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
