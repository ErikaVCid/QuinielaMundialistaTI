import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient, Phase } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const BASE_URL = 'https://worldcup26.ir'
const TOKEN = process.env.WORLDCUP26_TOKEN!

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json() as Promise<T>
}

interface WC26Team { id: string; name_en: string; fifa_code: string; flag: string; groups: string }
interface WC26Game {
  id: string; home_team_id: string; away_team_id: string
  home_score: string | null; away_score: string | null
  group: string; matchday: string; local_date: string
  stadium_id: string; finished: string; time_elapsed: string | null; type: string
  home_team_name_en?: string; away_team_name_en?: string
}
interface WC26Stadium { id: string; name_en: string; city_en: string; country_en: string }

function parseDate(d: string): Date {
  const [date, time] = d.split(' ')
  const [mm, dd, yyyy] = date.split('/')
  const [hh, min] = time.split(':')
  return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min))
}

function mapStatus(g: WC26Game): 'SCHEDULED' | 'LIVE' | 'FINISHED' {
  if (g.finished === 'TRUE') return 'FINISHED'
  if (!g.time_elapsed || g.time_elapsed === 'notstarted') return 'SCHEDULED'
  return 'LIVE'
}

function mapPhase(type: string): Phase {
  switch (type) {
    case 'r16': case 'r32': return Phase.ROUND_OF_16
    case 'qf': return Phase.QUARTER_FINAL
    case 'sf': return Phase.SEMI_FINAL
    case 'third': return Phase.THIRD_PLACE
    case 'final': return Phase.FINAL
    default: return Phase.GROUP
  }
}

async function main() {
  console.log('Fetching data from worldcup26.ir...')
  const [{ teams }, { games }, { stadiums }] = await Promise.all([
    apiFetch<{ teams: WC26Team[] }>('/get/teams'),
    apiFetch<{ games: WC26Game[] }>('/get/games'),
    apiFetch<{ stadiums: WC26Stadium[] }>('/get/stadiums'),
  ])
  console.log(`  ${teams.length} teams, ${games.length} games, ${stadiums.length} stadiums`)

  const stadiumMap = new Map(stadiums.map(s => [s.id, s]))
  const groupLabels = [...new Set(teams.map(t => t.groups))].filter(Boolean).sort()
  const groupMap = new Map<string, string>()
  const teamCodeToId = new Map<string, string>()

  // Upsert groups
  for (const label of groupLabels) {
    const g = await prisma.tournamentGroup.upsert({
      where: { id: `group-${label}` },
      update: {},
      create: { id: `group-${label}`, name: `Grupo ${label}`, label },
    })
    groupMap.set(label, g.id)
  }
  console.log(`  ✓ ${groupLabels.length} grupos`)

  // Upsert teams
  for (const t of teams) {
    const team = await prisma.team.upsert({
      where: { code: t.fifa_code },
      update: { name: t.name_en, flag: t.flag, groupId: groupMap.get(t.groups), externalId: t.id },
      create: { name: t.name_en, code: t.fifa_code, flag: t.flag, groupId: groupMap.get(t.groups), externalId: t.id },
    })
    teamCodeToId.set(t.fifa_code, team.id)
  }
  console.log(`  ✓ ${teams.length} equipos`)

  // apiId → fifa_code map
  const teamApiIdToCode = new Map(teams.map(t => [t.id, t.fifa_code]))

  let matchCount = 0, skipped = 0
  for (const g of games) {
    // Skip knockout placeholders (teams not determined yet)
    if (g.home_team_id === '0' || g.away_team_id === '0') { skipped++; continue }

    const homeCode = teamApiIdToCode.get(g.home_team_id)
    const awayCode = teamApiIdToCode.get(g.away_team_id)
    if (!homeCode || !awayCode) { skipped++; continue }

    const homeTeamId = teamCodeToId.get(homeCode)
    const awayTeamId = teamCodeToId.get(awayCode)
    if (!homeTeamId || !awayTeamId) { skipped++; continue }

    const stadium = stadiumMap.get(g.stadium_id)
    const homeScore = g.home_score && g.home_score !== 'null' ? parseInt(g.home_score) : undefined
    const awayScore = g.away_score && g.away_score !== 'null' ? parseInt(g.away_score) : undefined

    await prisma.match.upsert({
      where: { externalId: `wc26-${g.id}` },
      update: {
        status: mapStatus(g),
        homeScore: homeScore ?? undefined,
        awayScore: awayScore ?? undefined,
        phase: mapPhase(g.type),
        stadium: stadium?.name_en,
        city: stadium?.city_en,
      },
      create: {
        externalId: `wc26-${g.id}`,
        homeTeamId,
        awayTeamId,
        kickoffAt: parseDate(g.local_date),
        stadium: stadium?.name_en,
        city: stadium?.city_en,
        phase: mapPhase(g.type),
        groupId: g.group ? groupMap.get(g.group) : undefined,
        status: mapStatus(g),
        homeScore,
        awayScore,
        matchday: parseInt(g.matchday),
      },
    })
    matchCount++
  }
  console.log(`  ✓ ${matchCount} partidos upserted (${skipped} placeholders omitidos)`)
  console.log('\n🎉 Sync completo. Actualiza el navegador en http://localhost:3000')
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
