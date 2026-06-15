/**
 * Cron de desarrollo local — actualiza marcadores y predicciones automáticamente.
 * Equivale al cron de Vercel pero corriendo en tu máquina.
 *
 *   npm run cron:dev
 *
 * Intervalos:
 *   - Partidos en vivo detectados → cada 60s
 *   - Sin partidos en vivo        → cada 5 min
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import * as cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

const WORLDCUP26_TOKEN = process.env.WORLDCUP26_TOKEN ?? ''
const BASE_WC26 = 'https://worldcup26.ir'

// ── Sync desde worldcup26.ir ──────────────────────────────────────────────────

interface WC26Game {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: string | null
  away_score: string | null
  finished: string
  time_elapsed: string | null
  type: string
  matchday: string
  local_date: string
  stadium_id: string
}

interface WC26Stadium {
  id: string
  name_en: string
  city_en: string
}

async function fetchWC26<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_WC26}${path}`, {
    headers: { Authorization: `Bearer ${WORLDCUP26_TOKEN}` },
  })
  if (!res.ok) throw new Error(`worldcup26.ir ${res.status} ${path}`)
  return res.json() as Promise<T>
}

function mapStatus(g: WC26Game): 'SCHEDULED' | 'LIVE' | 'FINISHED' {
  if (g.finished === 'TRUE') return 'FINISHED'
  if (!g.time_elapsed || g.time_elapsed === 'notstarted') return 'SCHEDULED'
  return 'LIVE'
}

// ── Tarea de sync ─────────────────────────────────────────────────────────────

async function runSync(): Promise<{ updated: number; live: number; errors: string[] }> {
  const result = { updated: 0, live: 0, errors: [] as string[] }

  try {
    const [{ games }, { stadiums }] = await Promise.all([
      fetchWC26<{ games: WC26Game[] }>('/get/games'),
      fetchWC26<{ stadiums: WC26Stadium[] }>('/get/stadiums'),
    ])

    const stadiumMap = new Map(stadiums.map(s => [s.id, s]))

    // Only process active matches (live or recently changed)
    const activeGames = games.filter(g => {
      if (g.home_team_id === '0' || g.away_team_id === '0') return false
      const status = mapStatus(g)
      return status === 'LIVE' || status === 'FINISHED'
    })

    result.live = activeGames.filter(g => mapStatus(g) === 'LIVE').length

    for (const g of activeGames) {
      try {
        const existing = await prisma.match.findUnique({
          where: { externalId: `wc26-${g.id}` },
        })
        if (!existing) continue

        const status = mapStatus(g)
        const homeScore = g.home_score && g.home_score !== 'null' ? parseInt(g.home_score) : null
        const awayScore = g.away_score && g.away_score !== 'null' ? parseInt(g.away_score) : null
        const stadium = stadiumMap.get(g.stadium_id)

        const changed =
          existing.status !== status ||
          existing.homeScore !== homeScore ||
          existing.awayScore !== awayScore

        if (changed) {
          await prisma.match.update({
            where: { id: existing.id },
            data: {
              status,
              homeScore: homeScore ?? existing.homeScore,
              awayScore: awayScore ?? existing.awayScore,
              stadium: stadium?.name_en ?? existing.stadium,
              city: stadium?.city_en ?? existing.city,
            },
          })
          result.updated++
        }
      } catch (e) {
        result.errors.push(`wc26-${g.id}: ${(e as Error).message}`)
      }
    }
  } catch (e) {
    result.errors.push(`fetch: ${(e as Error).message}`)
  }

  return result
}

// ── Scheduler dinámico ────────────────────────────────────────────────────────

let currentSchedule = '*/5 * * * *'    // 5 min por defecto
let activeCron: ReturnType<typeof cron.schedule> | null = null

function startCron(schedule: string) {
  if (activeCron) activeCron.stop()
  activeCron = cron.schedule(schedule, async () => {
    const now = new Date().toLocaleTimeString('es-MX')
    process.stdout.write(`[${now}] Sincronizando... `)

    const result = await runSync()

    if (result.errors.length > 0) {
      console.log(`❌ ${result.errors[0]}`)
    } else if (result.updated > 0) {
      console.log(`✅ ${result.updated} partido(s) actualizado(s)`)
    } else {
      console.log(`✓ sin cambios`)
    }

    // Cambiar a modo rápido si hay partidos en vivo
    const newSchedule = result.live > 0 ? '* * * * *' : '*/5 * * * *'
    if (newSchedule !== currentSchedule) {
      currentSchedule = newSchedule
      const label = result.live > 0
        ? `🔴 ${result.live} partido(s) en vivo — cambiando a cada 1 min`
        : `⚪ Sin partidos en vivo — cambiando a cada 5 min`
      console.log(label)
      startCron(newSchedule)
    }
  })
}

// ── Inicio ────────────────────────────────────────────────────────────────────

async function main() {
  if (!WORLDCUP26_TOKEN) {
    console.error('❌  WORLDCUP26_TOKEN no está configurado en .env.local')
    process.exit(1)
  }

  console.log('⏰  Cron de desarrollo iniciado')
  console.log('    Intervalo inicial: cada 5 minutos')
  console.log('    En partidos en vivo: cada 1 minuto')
  console.log('    Ctrl+C para detener\n')

  // Primera ejecución inmediata
  console.log('🔄  Primera sincronización...')
  const initial = await runSync()
  const status = initial.live > 0
    ? `🔴 ${initial.live} EN VIVO`
    : initial.updated > 0 ? `✅ ${initial.updated} actualizados` : '✓ todo al día'
  console.log(`    ${status}\n`)

  // Ajustar intervalo según estado inicial
  if (initial.live > 0) {
    currentSchedule = '* * * * *'
    console.log('🔴 Partidos en vivo detectados — modo rápido (1 min)\n')
  }

  startCron(currentSchedule)
}

main().catch(e => { console.error('❌', e); process.exit(1) })

// Limpieza al salir
process.on('SIGINT', () => {
  console.log('\n\nCron detenido.')
  activeCron?.stop()
  prisma.$disconnect()
  process.exit(0)
})
