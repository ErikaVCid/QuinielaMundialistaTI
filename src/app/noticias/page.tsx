import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatRelativeTime } from '@/lib/utils'
import { ExternalLink, Newspaper } from 'lucide-react'

export default async function NoticiasPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const news = await prisma.news.findMany({
    include: { team: true, match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 30,
  })

  const featuredNews = news.filter((n) => n.isFeatured)
  const regularNews = news.filter((n) => !n.isFeatured)

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Noticias del Mundial</h1>
        <p className="text-gray-400 text-sm">Últimas noticias del Mundial FIFA 2026</p>
      </div>

      {news.length === 0 ? (
        <div className="text-center py-16">
          <Newspaper className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500">Las noticias aparecerán aquí una vez configurada la API de noticias.</p>
          <p className="text-gray-600 text-sm mt-2">Configura <code className="bg-[#1a1a24] px-1.5 py-0.5 rounded text-green-400">NEWS_API_KEY</code> en tu .env.local</p>
        </div>
      ) : (
        <div className="space-y-6">
          {featuredNews.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Destacadas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {featuredNews.slice(0, 2).map((n) => (
                  <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                    className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden match-card-hover group">
                    {n.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.imageUrl} alt={n.title} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-green-400 font-medium">{n.source}</span>
                        <span className="text-xs text-gray-500">{formatRelativeTime(n.publishedAt)}</span>
                      </div>
                      <h3 className="text-white font-semibold text-sm group-hover:text-green-400 transition-colors">{n.title}</h3>
                      {n.summary && <p className="text-gray-400 text-xs mt-2 line-clamp-2">{n.summary}</p>}
                      <div className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                        <ExternalLink className="w-3 h-3" /> Leer más
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Recientes</h2>
            <div className="space-y-3">
              {regularNews.map((n) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-4 bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 match-card-hover group">
                  {n.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.imageUrl} alt="" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-sm group-hover:text-green-400 transition-colors line-clamp-2">{n.title}</h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span>{n.source}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(n.publishedAt)}</span>
                      {n.team && <span>· {n.team.flag} {n.team.name}</span>}
                    </div>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                </a>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
