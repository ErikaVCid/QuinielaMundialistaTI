import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ExternalLink, Zap, Trophy } from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function ScoreBadge({ title }: { title: string }) {
  // Extract score from title like "Mexico 2-0 South Africa"
  const match = title.match(/(\d+)-(\d+)/)
  if (!match) return null
  return (
    <span className="text-xs font-bold tabular-nums font-mono text-white bg-white/10 px-2 py-0.5 rounded">
      {match[1]}–{match[2]}
    </span>
  )
}

function SourceBadge({ source }: { source: string }) {
  const isLocal = source === 'Quiniela Mundial 2026'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      isLocal
        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
        : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
    }`}>
      {isLocal ? '⚽ Resultado' : source}
    </span>
  )
}

export default async function NoticiasPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const news = await prisma.news.findMany({
    include: {
      match: { include: { homeTeam: true, awayTeam: true } },
      team: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 40,
  })

  const featured = news.filter(n => n.isFeatured).slice(0, 3)
  const rest = news.filter(n => !n.isFeatured)

  // Group rest by date
  const byDate = rest.reduce<Record<string, typeof rest>>((acc, n) => {
    const key = n.publishedAt.toISOString().split('T')[0]
    if (!acc[key]) acc[key] = []
    acc[key].push(n)
    return acc
  }, {})

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Noticias del Mundial</h1>
        <p className="text-gray-500 text-sm">
          Resultados y novedades del Mundial FIFA México 2026 · {news.length} artículos
        </p>
      </div>

      {news.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-10">

          {/* Featured — horizontal card */}
          {featured.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Destacadas</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featured.map(n => (
                  <NewsCard key={n.id} n={n} variant="featured" />
                ))}
              </div>
            </section>
          )}

          {/* Rest grouped by date */}
          {Object.entries(byDate).map(([dateKey, items]) => {
            const [dy, dm, dd] = dateKey.split('-').map(Number)
            const label = format(new Date(dy, dm - 1, dd), "EEEE d 'de' MMMM", { locale: es })
            return (
              <section key={dateKey}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
                  <div className="h-px flex-1 bg-[#1e1e2e]" />
                </div>
                <div className="space-y-2">
                  {items.map(n => <NewsCard key={n.id} n={n} variant="list" />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Card components ────────────────────────────────────────────────────────────

type NewsItem = Awaited<ReturnType<typeof prisma.news.findMany>>[0] & {
  match: ({ homeTeam: { flag: string | null; name: string }; awayTeam: { flag: string | null; name: string } } | null)
}

function TeamFlag({ flag, name }: { flag: string | null; name: string }) {
  if (!flag) return null
  if (flag.startsWith('http')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={flag} alt={name} className="w-5 h-auto rounded-sm inline-block" />
  }
  return <span className="text-base">{flag}</span>
}

function NewsCard({ n, variant }: { n: NewsItem; variant: 'featured' | 'list' }) {
  const isLocal = n.source === 'Quiniela Mundial 2026'
  const relTime = formatRelativeTime(n.publishedAt)

  if (variant === 'featured') {
    return (
      <a href={isLocal ? '#' : n.url} target={isLocal ? '_self' : '_blank'} rel="noopener noreferrer"
        className="group block bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden hover:border-green-500/25 transition-all">

        {/* Match teams banner */}
        {n.match ? (
          <div className="bg-gradient-to-r from-green-900/30 to-[#0d0d17] border-b border-[#1e1e2e] px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TeamFlag flag={n.match.homeTeam.flag} name={n.match.homeTeam.name} />
                <span className="text-xs font-semibold text-white">{n.match.homeTeam.name}</span>
              </div>
              <ScoreBadge title={n.title} />
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">{n.match.awayTeam.name}</span>
                <TeamFlag flag={n.match.awayTeam.flag} name={n.match.awayTeam.name} />
              </div>
            </div>
          </div>
        ) : n.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={n.imageUrl} alt="" className="w-full h-36 object-cover" />
        ) : null}

        <div className="p-4">
          <h3 className="text-white text-sm font-semibold leading-snug group-hover:text-green-400 transition-colors mb-2">
            {n.title}
          </h3>
          {n.summary && (
            <p className="text-gray-500 text-xs leading-relaxed line-clamp-2 mb-3">{n.summary}</p>
          )}
          <div className="flex items-center justify-between">
            <SourceBadge source={n.source} />
            <span className="text-xs text-gray-600">{relTime}</span>
          </div>
        </div>
      </a>
    )
  }

  // List variant
  return (
    <a href={isLocal ? '#' : n.url} target={isLocal ? '_self' : '_blank'} rel="noopener noreferrer"
      className="group flex items-center gap-4 bg-[#111118] rounded-xl border border-[#1e1e2e] px-4 py-3 hover:border-green-500/20 hover:bg-[#131320] transition-all">

      {/* Teams mini badge */}
      {n.match ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 w-28">
          <TeamFlag flag={n.match.homeTeam.flag} name={n.match.homeTeam.name} />
          <ScoreBadge title={n.title} />
          <TeamFlag flag={n.match.awayTeam.flag} name={n.match.awayTeam.name} />
        </div>
      ) : n.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={n.imageUrl} alt="" className="w-14 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-10 rounded-lg bg-[#1a1a24] flex-shrink-0 flex items-center justify-center">
          <Zap className="w-4 h-4 text-gray-600" />
        </div>
      )}

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium line-clamp-1 group-hover:text-green-400 transition-colors">
          {n.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <SourceBadge source={n.source} />
          <span className="text-xs text-gray-600">{relTime}</span>
          {n.tags.slice(0, 2).map(t => (
            <span key={t} className="text-xs text-gray-700">{t}</span>
          ))}
        </div>
      </div>

      {!isLocal && <ExternalLink className="w-3.5 h-3.5 text-gray-700 flex-shrink-0" />}
    </a>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-[#111118] border border-[#1e1e2e] flex items-center justify-center mx-auto mb-4">
        <Trophy className="w-7 h-7 text-gray-600" />
      </div>
      <p className="text-gray-400 font-medium mb-1">No hay noticias todavía</p>
      <p className="text-gray-600 text-sm">
        Corre{' '}
        <code className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-green-400 text-xs">
          npm run news:generate
        </code>{' '}
        para generar noticias desde los resultados
      </p>
    </div>
  )
}
