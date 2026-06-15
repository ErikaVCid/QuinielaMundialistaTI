import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchDate, formatMatchTime, phaseLabel } from '@/lib/utils'
import { Target, Zap, CheckCircle, Clock } from 'lucide-react'
import { Phase, MatchStatus } from '@prisma/client'

export default async function PartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; grupo?: string; estado?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const params = await searchParams
  const { fase, grupo, estado } = params

  const matches = await prisma.match.findMany({
    where: {
      ...(fase && Object.values(Phase).includes(fase as Phase) ? { phase: fase as Phase } : {}),
      ...(grupo ? { group: { label: grupo } } : {}),
      ...(estado && Object.values(MatchStatus).includes(estado as MatchStatus) ? { status: estado as MatchStatus } : {}),
    },
    include: { homeTeam: true, awayTeam: true, group: true },
    orderBy: { kickoffAt: 'asc' },
  })

  // Group by date
  const grouped = matches.reduce((acc, match) => {
    const date = formatMatchDate(match.kickoffAt)
    if (!acc[date]) acc[date] = []
    acc[date].push(match)
    return acc
  }, {} as Record<string, typeof matches>)

  const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
    SCHEDULED: { label: 'Programado', icon: Clock, color: 'text-gray-400' },
    LIVE: { label: 'En Vivo', icon: Zap, color: 'text-red-400' },
    FINISHED: { label: 'Finalizado', icon: CheckCircle, color: 'text-green-400' },
    POSTPONED: { label: 'Pospuesto', icon: Clock, color: 'text-yellow-400' },
  }

  const groups = await prisma.tournamentGroup.findMany({ orderBy: { label: 'asc' } })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Calendario de Partidos</h1>
        <p className="text-gray-400 text-sm">Mundial FIFA 2026 — Del 15 de junio a la Final</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/partidos" className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!fase && !grupo && !estado ? 'bg-green-600 text-white' : 'bg-[#111118] border border-[#1e1e2e] text-gray-400 hover:text-white'}`}>
          Todos
        </Link>
        <Link href="/partidos?estado=LIVE" className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${estado === 'LIVE' ? 'bg-red-600 text-white' : 'bg-[#111118] border border-[#1e1e2e] text-gray-400 hover:text-white'}`}>
          <Zap className="w-3 h-3" /> En Vivo
        </Link>
        <Link href="/partidos?estado=SCHEDULED" className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${estado === 'SCHEDULED' ? 'bg-blue-600 text-white' : 'bg-[#111118] border border-[#1e1e2e] text-gray-400 hover:text-white'}`}>
          Programados
        </Link>
        <Link href="/partidos?estado=FINISHED" className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${estado === 'FINISHED' ? 'bg-gray-600 text-white' : 'bg-[#111118] border border-[#1e1e2e] text-gray-400 hover:text-white'}`}>
          Finalizados
        </Link>
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/partidos?grupo=${g.label}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${grupo === g.label ? 'bg-green-600 text-white' : 'bg-[#111118] border border-[#1e1e2e] text-gray-400 hover:text-white'}`}
          >
            Grupo {g.label}
          </Link>
        ))}
      </div>

      {/* Matches grouped by date */}
      <div className="space-y-8">
        {Object.entries(grouped).map(([date, dateMatches]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-[#1e1e2e]" />
              {date}
              <div className="h-px flex-1 bg-[#1e1e2e]" />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dateMatches.map((match) => {
                const sc = statusConfig[match.status] ?? statusConfig['SCHEDULED']
                const StatusIcon = sc.icon
                return (
                  <Link key={match.id} href={`/partidos/${match.id}`}>
                    <div className={`bg-[#111118] rounded-xl border p-4 match-card-hover cursor-pointer ${match.status === 'LIVE' ? 'border-red-500/30' : 'border-[#1e1e2e]'}`}>
                      <div className="flex items-center justify-between text-xs mb-3">
                        <span className="text-gray-500">
                          {match.group ? `Grupo ${match.group.label}` : phaseLabel(match.phase)}
                          {match.matchday && ` · Jornada ${match.matchday}`}
                        </span>
                        <span className={`flex items-center gap-1 ${sc.color} font-medium`}>
                          <StatusIcon className="w-3 h-3" />
                          {match.status === 'LIVE' ? 'EN VIVO' : formatMatchTime(match.kickoffAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 flex items-center gap-2 justify-end">
                          <div className="text-right">
                            <div className="text-sm font-bold text-white">{match.homeTeam.name}</div>
                            <div className="text-xs text-gray-500">{match.homeTeam.code}</div>
                          </div>
                          <span className="text-xl">{match.homeTeam.flag}</span>
                        </div>
                        <div className="text-center px-2">
                          {match.status === 'FINISHED' || match.status === 'LIVE' ? (
                            <div className="text-xl font-bold text-white tabular-nums">
                              {match.homeScore} – {match.awayScore}
                            </div>
                          ) : (
                            <div className="text-sm font-bold text-gray-500">VS</div>
                          )}
                        </div>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xl">{match.awayTeam.flag}</span>
                          <div>
                            <div className="text-sm font-bold text-white">{match.awayTeam.name}</div>
                            <div className="text-xs text-gray-500">{match.awayTeam.code}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-[#1e1e2e] flex items-center justify-between">
                        <span className="text-xs text-gray-500">{match.stadium}, {match.city}</span>
                        {match.status === 'SCHEDULED' && (
                          <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                            <Target className="w-3 h-3" /> Pronóstico
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-16 text-gray-500">
          No se encontraron partidos con los filtros seleccionados.
        </div>
      )}
    </div>
  )
}
