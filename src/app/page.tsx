import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchDate, formatMatchTime, phaseLabel } from '@/lib/utils'
import { Trophy, Target, Calendar, TrendingUp, ChevronRight, Zap } from 'lucide-react'

export default async function HomePage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const now = new Date()
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const [liveMatches, upcomingMatches, participant, totalParticipants] = await Promise.all([
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
  ])

  const userPosition = participant?.position ?? null

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-7xl">
      {/* Hero banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-green-900/40 via-green-800/20 to-transparent border border-green-500/10 p-6 md:p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-green-500/10 via-transparent to-transparent" />
        <div className="relative">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-green-400 text-sm font-semibold uppercase tracking-wider mb-1">
                ⚽ FIFA World Cup 2026
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Bienvenido, {participant?.displayName ?? session.user.name}
              </h1>
              <p className="text-gray-400 text-sm">
                Haz tus pronósticos antes del kickoff y compite con todos.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="bg-white/5 rounded-xl p-4 text-center min-w-20">
                <div className="text-2xl font-bold text-white">
                  {userPosition ? `#${userPosition}` : '—'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Posición</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center min-w-20">
                <div className="text-2xl font-bold text-green-400">
                  {participant?.totalPoints ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Puntos</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center min-w-20">
                <div className="text-2xl font-bold text-amber-400">
                  {participant?.exactHits ?? 0}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Exactos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live matches */}
      {liveMatches.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
            <h2 className="text-white font-semibold">En Vivo</h2>
            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20 font-medium">
              LIVE
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {liveMatches.map((match) => (
              <Link key={match.id} href={`/partidos/${match.id}`}>
                <div className="bg-[#111118] rounded-xl border border-red-500/20 p-4 match-card-hover cursor-pointer">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{match.group ? `Grupo ${match.group.label}` : phaseLabel(match.phase)}</span>
                    <span className="flex items-center gap-1 text-red-400 font-medium">
                      <Zap className="w-3 h-3" /> EN VIVO
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-right">
                      <div className="text-lg font-bold text-white">{match.homeTeam.flag} {match.homeTeam.code}</div>
                      <div className="text-xs text-gray-400">{match.homeTeam.name}</div>
                    </div>
                    <div className="text-center px-4">
                      <div className="text-2xl font-bold text-white tabular-nums">
                        {match.homeScore ?? 0} – {match.awayScore ?? 0}
                      </div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-lg font-bold text-white">{match.awayTeam.flag} {match.awayTeam.code}</div>
                      <div className="text-xs text-gray-400">{match.awayTeam.name}</div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Trophy, label: 'Posición general', value: userPosition ? `#${userPosition}` : '—', sub: `de ${totalParticipants}`, color: 'text-amber-400' },
          { icon: Target, label: 'Pronósticos', value: participant?._count.predictions ?? 0, sub: 'realizados', color: 'text-green-400' },
          { icon: TrendingUp, label: 'Exactos', value: participant?.exactHits ?? 0, sub: 'marcadores exactos', color: 'text-blue-400' },
          { icon: Calendar, label: 'Próximos', value: upcomingMatches.length, sub: 'en los próximos 3 días', color: 'text-purple-400' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Upcoming matches */}
      {upcomingMatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Próximos Partidos</h2>
            <Link href="/partidos" className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.map((match) => (
              <Link key={match.id} href={`/partidos/${match.id}`}>
                <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 match-card-hover cursor-pointer">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{match.group ? `Grupo ${match.group.label}` : phaseLabel(match.phase)}</span>
                    <span className="text-green-400">{formatMatchTime(match.kickoffAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 text-right">
                      <div className="text-base font-bold text-white">{match.homeTeam.flag}</div>
                      <div className="text-xs text-gray-300 font-medium">{match.homeTeam.code}</div>
                    </div>
                    <div className="text-center px-3">
                      <div className="text-xs text-gray-500 font-medium">VS</div>
                      <div className="text-xs text-gray-600 mt-0.5">{formatMatchDate(match.kickoffAt)}</div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-base font-bold text-white">{match.awayTeam.flag}</div>
                      <div className="text-xs text-gray-300 font-medium">{match.awayTeam.code}</div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-[#1e1e2e] flex items-center justify-between">
                    <span className="text-xs text-gray-500">{match.city}</span>
                    <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                      <Target className="w-3 h-3" /> Predecir
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
