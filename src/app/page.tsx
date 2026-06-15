import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchTime, phaseLabel } from '@/lib/utils'
import { Trophy, Target, Calendar, TrendingUp, ChevronRight, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// ── Flag helper ────────────────────────────────────────────────────────────────

function Flag({ flag, name, size = 'md' }: { flag: string | null; name: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'w-10 h-auto' : size === 'md' ? 'w-7 h-auto' : 'w-5 h-auto'
  if (!flag) return <span className="inline-block w-7 h-5 rounded bg-[#2e2e3e]" />
  if (flag.startsWith('http')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={flag} alt={name} className={`${cls} rounded-sm object-cover flex-shrink-0 inline-block`} />
  }
  return <span className={size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-base'}>{flag}</span>
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const [liveMatches, upcomingMatches, participant, totalParticipants, topRanking] = await Promise.all([
    prisma.match.findMany({
      where: { status: 'LIVE' },
      include: { homeTeam: true, awayTeam: true, group: true },
      orderBy: { kickoffAt: 'asc' },
    }),
    prisma.match.findMany({
      where: { status: 'SCHEDULED', kickoffAt: { gte: now, lte: threeDaysLater } },
      include: { homeTeam: true, awayTeam: true, group: true },
      orderBy: { kickoffAt: 'asc' },
      take: 6,
    }),
    prisma.participant.findUnique({
      where: { userId: session.user.id },
      include: { _count: { select: { predictions: true } } },
    }),
    prisma.participant.count(),
    prisma.participant.findMany({
      orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
      take: 5,
      select: { id: true, displayName: true, totalPoints: true, exactHits: true, userId: true },
    }),
  ])

  const userPosition = participant?.position ?? null
  const todayLabel = format(now, "EEEE d 'de' MMMM", { locale: es })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-6xl space-y-8">

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-green-900/40 via-green-800/20 to-transparent border border-green-500/10 p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent" />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1.5">
              ⚽ FIFA World Cup · México 2026
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              Bienvenido, {participant?.displayName ?? session.user.name}
            </h1>
            <p className="text-gray-500 text-sm capitalize">{todayLabel}</p>
          </div>
          <div className="flex gap-3">
            {[
              { label: 'Posición', value: userPosition ? `#${userPosition}` : '—', color: 'text-white' },
              { label: 'Puntos',   value: participant?.totalPoints ?? 0,            color: 'text-green-400' },
              { label: 'Exactos',  value: participant?.exactHits ?? 0,              color: 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-xl px-5 py-3 text-center min-w-[72px]">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── En Vivo ────────────────────────────────────────────────────────── */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <h2 className="text-white font-semibold">En Vivo</h2>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-bold">
              LIVE
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <Link key={match.id} href={`/partidos/${match.id}`} className="block group">
                <div className="bg-[#111118] rounded-xl border border-red-500/25 p-5 group-hover:border-red-500/50 transition-all">
                  <div className="flex items-center justify-between text-xs mb-4">
                    <span className="text-gray-500">
                      {match.group ? `Grupo ${match.group.label}` : phaseLabel(match.phase)}
                    </span>
                    <span className="flex items-center gap-1 text-red-400 font-bold">
                      <Zap className="w-3 h-3" /> EN VIVO
                    </span>
                  </div>
                  {/* Teams */}
                  <div className="flex items-center gap-3">
                    {/* Home */}
                    <div className="flex-1 flex items-center justify-end gap-2">
                      <span className="text-sm font-bold text-white truncate">{match.homeTeam.name}</span>
                      <Flag flag={match.homeTeam.flag} name={match.homeTeam.name} size="md" />
                    </div>
                    {/* Score */}
                    <div className="text-center px-3">
                      <div className="text-2xl font-bold text-white tabular-nums font-mono">
                        {match.homeScore ?? 0}–{match.awayScore ?? 0}
                      </div>
                    </div>
                    {/* Away */}
                    <div className="flex-1 flex items-center justify-start gap-2">
                      <Flag flag={match.awayTeam.flag} name={match.awayTeam.name} size="md" />
                      <span className="text-sm font-bold text-white truncate">{match.awayTeam.name}</span>
                    </div>
                  </div>
                  {match.stadium && (
                    <p className="text-xs text-gray-600 text-center mt-3">{match.stadium}, {match.city}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Stats rápidos ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Trophy,    label: 'Posición general', value: userPosition ? `#${userPosition}` : '—',         sub: `de ${totalParticipants} participantes`, color: 'text-amber-400'  },
          { icon: Target,    label: 'Pronósticos',       value: participant?._count.predictions ?? 0,            sub: 'realizados',                            color: 'text-green-400'  },
          { icon: TrendingUp,label: 'Exactos',           value: participant?.exactHits ?? 0,                     sub: 'marcadores exactos',                    color: 'text-blue-400'   },
          { icon: Calendar,  label: 'Próximos',          value: upcomingMatches.length,                          sub: 'en 3 días',                             color: 'text-purple-400' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Próximos partidos + Ranking side-by-side ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Upcoming matches — 2/3 width */}
        {upcomingMatches.length > 0 && (
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Próximos Partidos</h2>
              <Link href="/partidos?estado=SCHEDULED" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                Ver todos <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Link key={match.id} href={`/partidos/${match.id}`} className="block group">
                  <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] px-4 py-3 group-hover:border-green-500/20 group-hover:bg-[#131320] transition-all"
                    style={{ display: 'grid', gridTemplateColumns: '3.5rem 1fr auto 1fr auto', alignItems: 'center', gap: '0.5rem' }}>

                    {/* Time + group */}
                    <div className="text-center">
                      <div className="text-xs font-semibold text-gray-300">{formatMatchTime(match.kickoffAt)}</div>
                      <div className="text-xs text-gray-600">{match.group ? `G.${match.group.label}` : ''}</div>
                    </div>

                    {/* Home — right aligned */}
                    <div className="flex items-center justify-end gap-2 min-w-0">
                      <span className="text-sm font-semibold text-white truncate">{match.homeTeam.name}</span>
                      <Flag flag={match.homeTeam.flag} name={match.homeTeam.name} size="sm" />
                    </div>

                    {/* VS */}
                    <div className="text-center px-1">
                      <span className="text-xs font-bold text-gray-600">VS</span>
                    </div>

                    {/* Away — left aligned */}
                    <div className="flex items-center justify-start gap-2 min-w-0">
                      <Flag flag={match.awayTeam.flag} name={match.awayTeam.name} size="sm" />
                      <span className="text-sm font-semibold text-white truncate">{match.awayTeam.name}</span>
                    </div>

                    {/* CTA */}
                    <div className="flex justify-end">
                      <span className="text-xs text-green-500 flex items-center gap-0.5 font-medium">
                        <Target className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Top ranking — 1/3 width */}
        {topRanking.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-semibold">Tabla de Posiciones</h2>
              <Link href="/posiciones" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
                Ver todo <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
              {topRanking.map((p, i) => {
                const isMe = p.userId === session.user?.id
                const medal = i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'
                return (
                  <div key={p.id}
                    className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e1e2e] last:border-0 ${isMe ? 'bg-green-500/5' : ''}`}>
                    <span className={`text-sm font-bold w-5 text-center ${medal}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${isMe ? 'text-green-400' : 'text-white'}`}>
                        {p.displayName} {isMe && <span className="text-xs text-green-600">(tú)</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-green-400">{p.totalPoints}</div>
                      <div className="text-xs text-gray-600">{p.exactHits} exactos</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Empty state — no upcoming */}
      {upcomingMatches.length === 0 && liveMatches.length === 0 && (
        <div className="text-center py-12 text-gray-500 text-sm">
          No hay partidos próximos en los próximos 3 días.
          <Link href="/partidos" className="block mt-2 text-green-400 hover:text-green-300">
            Ver calendario completo →
          </Link>
        </div>
      )}
    </div>
  )
}
