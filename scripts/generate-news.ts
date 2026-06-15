/**
 * Genera noticias automáticas desde los resultados de partidos finalizados.
 * No requiere API key — usa los datos ya en la base de datos.
 *   npm run news:generate
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

function resultLabel(home: number, away: number): 'victoria local' | 'victoria visitante' | 'empate' {
  if (home > away) return 'victoria local'
  if (away > home) return 'victoria visitante'
  return 'empate'
}

function headlineFor(homeName: string, awayName: string, hs: number, as_: number): string {
  const diff = Math.abs(hs - as_)
  if (hs === as_) return `${homeName} y ${awayName} empatan ${hs}-${as_} en el Mundial 2026`
  const winner  = hs > as_ ? homeName : awayName
  const loser   = hs > as_ ? awayName : homeName
  const wScore  = hs > as_ ? hs : as_
  const lScore  = hs > as_ ? as_ : hs
  if (diff >= 3) return `Goleada de ${winner}: aplasta ${wScore}-${lScore} a ${loser}`
  if (diff === 2) return `${winner} vence con autoridad ${wScore}-${lScore} a ${loser}`
  return `${winner} supera por la mínima a ${loser} (${wScore}-${lScore})`
}

function summaryFor(homeName: string, awayName: string, hs: number, as_: number, stadium?: string | null, group?: string | null): string {
  const result = resultLabel(hs, as_)
  const venue  = stadium ? ` en el ${stadium}` : ''
  const grp    = group   ? ` del Grupo ${group}` : ''
  const base   = `En el partido${grp} de la fase de grupos del Mundial FIFA 2026${venue}, ${homeName} y ${awayName} disputaron un encuentro que terminó con ${result}: ${hs}-${as_}.`

  if (hs === as_) return `${base} Ambas selecciones suman un punto y siguen en carrera por avanzar a la siguiente ronda.`
  const winner = hs > as_ ? homeName : awayName
  const loser  = hs > as_ ? awayName : homeName
  return `${base} ${winner} se lleva los tres puntos y consolida su posición en la tabla, mientras que ${loser} deberá reaccionar en su próximo encuentro.`
}

function tagsFor(homeName: string, awayName: string, group?: string | null): string[] {
  const tags = ['Mundial 2026', 'Fase de Grupos', homeName, awayName]
  if (group) tags.push(`Grupo ${group}`)
  return tags
}

async function main() {
  console.log('📰  Generando noticias desde resultados...\n')

  const matches = await prisma.match.findMany({
    where: { status: 'FINISHED', homeScore: { not: null } },
    include: { homeTeam: true, awayTeam: true, group: true },
    orderBy: { kickoffAt: 'desc' },
  })

  console.log(`   ${matches.length} partidos finalizados encontrados\n`)

  let created = 0, skipped = 0

  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null) { skipped++; continue }

    const hs = match.homeScore
    const as_ = match.awayScore
    const hn = match.homeTeam.name
    const an = match.awayTeam.name
    const grp = match.group?.label ?? null

    const url = `https://quiniela-mundial.com/resultados/${match.id}`
    const title = headlineFor(hn, an, hs, as_)
    const summary = summaryFor(hn, an, hs, as_, match.stadium, grp)

    try {
      await prisma.news.upsert({
        where: { url },
        update: { title, summary },
        create: {
          title,
          summary,
          url,
          source: 'Quiniela Mundial 2026',
          publishedAt: match.kickoffAt,
          matchId: match.id,
          tags: tagsFor(hn, an, grp),
          isFeatured: Math.abs(hs - as_) >= 3 || hn === 'Mexico' || an === 'Mexico',
        },
      })
      console.log(`   ✓ ${hn} ${hs}-${as_} ${an}`)
      created++
    } catch (e) {
      console.error(`   ⚠️  ${match.id}: ${(e as Error).message}`)
    }
  }

  // Also fetch from RSS if available (optional, graceful fallback)
  await fetchRssNews()

  console.log(`\n✅  ${created} noticias generadas · ${skipped} omitidas`)
}

async function fetchRssNews() {
  // Free public RSS feeds — no API key required
  const feeds = [
    { url: 'https://www.fifa.com/fifaplus/en/articles/feed.rss', source: 'FIFA' },
  ]

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue

      const xml = await res.text()
      // Simple RSS item extraction (no xml parser dependency)
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []
      let count = 0

      for (const item of items.slice(0, 10)) {
        const title   = item.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1]   ?? item.match(/<title>(.*?)<\/title>/)?.[1]   ?? ''
        const link    = item.match(/<link>(.*?)<\/link>/)?.[1] ?? ''
        const desc    = item.match(/<description><!\[CDATA\[(.*?)\]\]>/)?.[1] ?? item.match(/<description>(.*?)<\/description>/)?.[1] ?? ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? ''
        const imgUrl  = item.match(/<media:thumbnail[^>]+url="([^"]+)"/)?.[1]
          ?? item.match(/<enclosure[^>]+url="([^"]+)"/)?.[1]

        if (!title || !link) continue

        const cleanTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        const cleanDesc  = desc.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').substring(0, 300)

        await prisma.news.upsert({
          where: { url: link },
          update: { title: cleanTitle },
          create: {
            title: cleanTitle,
            summary: cleanDesc || null,
            url: link,
            imageUrl: imgUrl ?? null,
            source: feed.source,
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            tags: ['Mundial 2026', feed.source],
          },
        }).catch(() => {}) // ignore constraint errors
        count++
      }
      if (count > 0) console.log(`   ✓ ${count} noticias de ${feed.source}`)
    } catch {
      // RSS feed unreachable — skip silently
    }
  }
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
