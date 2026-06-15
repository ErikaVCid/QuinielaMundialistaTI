/**
 * Sincroniza logos HD y highlights desde TheSportsDB (gratis, sin API key).
 *   npm run sync:tsdb
 *
 * Actualiza:
 *   - Team.badge  → logo/escudo HD del equipo
 *   - Match.highlightUrl → YouTube highlights
 *   - Match.posterUrl    → imagen del partido
 *   - Match.attendees    → asistencia
 *   - Match.matchDescription → narrativa del resultado
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const BASE = 'https://www.thesportsdb.com/api/v1/json/3'

interface TsdbTeam {
  idTeam: string; strTeam: string; strTeamShort: string | null
  strBadge: string | null; idAPIfootball: string | null
}
interface TsdbEvent {
  idEvent: string; strHomeTeam: string; strAwayTeam: string
  intHomeScore: string | null; intAwayScore: string | null
  dateEvent: string; strTime: string; strStatus: string
  strGroup: string | null; strVenue: string | null; strCity: string | null
  intSpectators: string | null; strResult: string | null
  strVideo: string | null; strPoster: string | null
  strHomeTeamBadge: string | null; strAwayTeamBadge: string | null
  idHomeTeam: string; idAwayTeam: string
}

async function tsdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`TheSportsDB ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

async function getAllEvents(): Promise<TsdbEvent[]> {
  const [season, past, next] = await Promise.all([
    tsdbFetch<{ events: TsdbEvent[] | null }>('/eventsseason.php?id=4429&s=2026').then(d => d.events ?? []).catch(() => []),
    tsdbFetch<{ events: TsdbEvent[] | null }>('/eventspastleague.php?id=4429').then(d => d.events ?? []).catch(() => []),
    tsdbFetch<{ events: TsdbEvent[] | null }>('/eventsnextleague.php?id=4429').then(d => d.events ?? []).catch(() => []),
  ])
  const seen = new Set<string>()
  return [...season, ...past, ...next].filter(e => { if (seen.has(e.idEvent)) return false; seen.add(e.idEvent); return true })
}

async function main() {
  console.log('🏟️   TheSportsDB sync — logos HD + highlights\n')

  // ── 1. Get all available WC2026 events ────────────────────────────────────
  console.log('Fetching events from TheSportsDB...')
  const events = await getAllEvents()
  console.log(`   ${events.length} eventos encontrados\n`)

  // ── 2. Update team badges ─────────────────────────────────────────────────
  console.log('📦  Actualizando logos de equipos...')

  // Collect unique team names from events + all teams in DB
  const dbTeams = await prisma.team.findMany({ select: { id: true, name: true, badge: true } })

  // Build a name → badge map from events (quick, no extra requests)
  const badgeByName = new Map<string, string>()
  for (const ev of events) {
    if (ev.strHomeTeamBadge) badgeByName.set(ev.strHomeTeam.toLowerCase(), ev.strHomeTeamBadge)
    if (ev.strAwayTeamBadge) badgeByName.set(ev.strAwayTeam.toLowerCase(), ev.strAwayTeamBadge)
  }

  // For teams not in events, search individually (up to 48 teams but rate-limited)
  const teamsNeedingBadge = dbTeams.filter(t => !badgeByName.has(t.name.toLowerCase()) && !t.badge)
  console.log(`   ${badgeByName.size} badges via events · ${teamsNeedingBadge.length} búsquedas adicionales`)

  let badgesUpdated = 0
  for (const team of dbTeams) {
    const badge = badgeByName.get(team.name.toLowerCase())
    if (!badge && team.badge) continue // already have one, skip API call
    if (!badge) {
      // Individual search
      try {
        const data = await tsdbFetch<{ teams: TsdbTeam[] | null }>(`/searchteams.php?t=${encodeURIComponent(team.name)}`)
        const found = data.teams?.[0]
        if (found?.strBadge) {
          await prisma.team.update({
            where: { id: team.id },
            data: { badge: found.strBadge, tsdbId: found.idTeam },
          })
          badgesUpdated++
          process.stdout.write('.')
        }
        await new Promise(r => setTimeout(r, 200)) // gentle rate limiting
      } catch { /* skip */ }
      continue
    }
    await prisma.team.update({ where: { id: team.id }, data: { badge } })
    badgesUpdated++
  }
  console.log(`\n   ✓ ${badgesUpdated} logos actualizados\n`)

  // ── 3. Update match highlights + media ────────────────────────────────────
  console.log('🎬  Actualizando highlights y media de partidos...')
  let matchesUpdated = 0

  for (const ev of events) {
    // Find our match by team names + date
    const matchDate = ev.dateEvent // YYYY-MM-DD
    const matches = await prisma.match.findMany({
      where: {
        homeTeam: { name: ev.strHomeTeam },
        awayTeam: { name: ev.strAwayTeam },
      },
      include: { homeTeam: true, awayTeam: true },
    })

    // Pick the match closest to the event date
    const match = matches.find(m => m.kickoffAt.toISOString().startsWith(matchDate))
      ?? matches[0]

    if (!match) {
      // Try swapped names (TheSportsDB sometimes has different casing)
      continue
    }

    const updateData: Record<string, unknown> = {}
    if (ev.strVideo && !match.highlightUrl)       updateData.highlightUrl     = ev.strVideo
    if (ev.strPoster && !match.posterUrl)         updateData.posterUrl        = ev.strPoster
    if (ev.intSpectators && !match.attendees)     updateData.attendees        = parseInt(ev.intSpectators)
    if (ev.strResult && !match.matchDescription)  updateData.matchDescription = ev.strResult

    if (Object.keys(updateData).length > 0) {
      await prisma.match.update({ where: { id: match.id }, data: updateData })
      matchesUpdated++
      const hasVideo = !!updateData.highlightUrl
      console.log(`   ✓ ${ev.strHomeTeam} vs ${ev.strAwayTeam}${hasVideo ? ' 🎬' : ''}`)
    }

    // Update team badges from event data
    if (ev.strHomeTeamBadge) {
      await prisma.team.update({ where: { id: match.homeTeamId }, data: { badge: ev.strHomeTeamBadge, tsdbId: ev.idHomeTeam } }).catch(() => {})
    }
    if (ev.strAwayTeamBadge) {
      await prisma.team.update({ where: { id: match.awayTeamId }, data: { badge: ev.strAwayTeamBadge, tsdbId: ev.idAwayTeam } }).catch(() => {})
    }
  }

  console.log(`   ✓ ${matchesUpdated} partidos actualizados\n`)

  // ── Summary ───────────────────────────────────────────────────────────────
  const withBadge = await prisma.team.count({ where: { badge: { not: null } } })
  const withHighlight = await prisma.match.count({ where: { highlightUrl: { not: null } } })
  const withPoster = await prisma.match.count({ where: { posterUrl: { not: null } } })

  console.log('📊  Resumen:')
  console.log(`   Equipos con logo HD: ${withBadge}`)
  console.log(`   Partidos con highlights: ${withHighlight}`)
  console.log(`   Partidos con poster: ${withPoster}`)
  console.log('\n✅  Sync completo.')
}

main()
  .catch(e => { console.error('❌', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
