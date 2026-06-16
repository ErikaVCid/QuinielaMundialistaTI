import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchTime, isMatchLocked } from '@/lib/utils'
import { Lock, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { FillWeekButton } from '@/components/fill-week-button'
import { TeamFlag } from '@/components/team-flag'
import { InlinePrediction } from '@/components/inline-prediction'

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PronosticosPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const participant = await prisma.participant.findUnique({
    where: { userId: session.user.id },
  })
  if (!participant) redirect('/login')

  const matches = await prisma.match.findMany({
    include: {
      homeTeam: true,
      awayTeam: true,
      group: true,
      predictions: { where: { participantId: participant.id } },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  const upcoming = matches.filter(
    (m) => m.status === 'SCHEDULED' && !isMatchLocked(m.kickoffAt)
  )
  const withoutPrediction = upcoming.filter((m) => m.predictions.length === 0)

  // Group matches by date label
  type Match = typeof matches[0]
  const grouped = matches.reduce<Record<string, Match[]>>((acc, m) => {
    const key = new Date(m.kickoffAt.getTime() - 6 * 3600 * 1000).toISOString().split('T')[0]  // use CDMX date, not UTC
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-4xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Mis Pronósticos</h1>
          <p className="text-gray-500 text-sm">Historial y estado de todos tus pronósticos</p>
        </div>
        {withoutPrediction.length > 0 && <FillWeekButton />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { value: participant.totalPoints,     label: 'Puntos totales',      color: 'text-green-400' },
          { value: participant.exactHits,       label: 'Marcadores exactos',  color: 'text-amber-400' },
          { value: participant.resultHits,      label: 'Resultados acertados',color: 'text-blue-400'  },
          { value: withoutPrediction.length,    label: 'Pendientes',          color: 'text-yellow-400'},
        ].map(({ value, label, color }) => (
          <div key={label} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
            <div className={cn('text-2xl font-bold', color)}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {withoutPrediction.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <span className="text-yellow-400 font-medium text-sm">
              {withoutPrediction.length} partido{withoutPrediction.length !== 1 ? 's' : ''} pendientes de pronóstico
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {withoutPrediction.slice(0, 4).map((m) => (
              <Link key={m.id} href={`/partidos/${m.id}`}
                className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-2.5 py-1.5 rounded-lg hover:bg-yellow-500/20 transition-all">
                <TeamFlag team={m.homeTeam} size="xs" />
                <span className="font-medium">{m.homeTeam.code}</span>
                <span className="text-yellow-700">–</span>
                <span className="font-medium">{m.awayTeam.code}</span>
                <TeamFlag team={m.awayTeam} size="xs" />
              </Link>
            ))}
            {withoutPrediction.length > 4 && (
              <span className="text-xs text-yellow-600 flex items-center px-1">
                +{withoutPrediction.length - 4} más
              </span>
            )}
          </div>
        </div>
      )}

      {/* Matches grouped by day */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([dateKey, dayMatches]) => {
          const [dy, dm, dd] = dateKey.split('-').map(Number)
          const label = format(new Date(dy, dm - 1, dd), "EEEE d 'de' MMMM", { locale: es })
          return (
            <div key={dateKey}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {label}
                </span>
                <div className="h-px flex-1 bg-[#1e1e2e]" />
              </div>

              {/* Matches */}
              <div className="space-y-1.5">
                {dayMatches.map((match) => {
                  const prediction = match.predictions[0]
                  const locked = isMatchLocked(match.kickoffAt) || match.status !== 'SCHEDULED'
                  const isFinished = match.status === 'FINISHED'
                  const isLive = match.status === 'LIVE'

                  return (
                    <Link key={match.id} href={`/partidos/${match.id}`} className="block group">
                      <div className={cn(
                        'rounded-xl border px-4 py-3 transition-all grid items-center gap-2',
                        'group-hover:border-green-500/20 group-hover:bg-[#131320]',
                        isLive     ? 'bg-red-950/20 border-red-500/20' :
                        prediction ? 'bg-[#111118] border-[#1e1e2e]' :
                                     'bg-[#0f0f17] border-yellow-500/10',
                      )}
                      style={{ gridTemplateColumns: '3.5rem 1fr auto 1fr auto' }}
                      >
                        {/* Time */}
                        <div className="text-center">
                          {isLive
                            ? <span className="text-xs font-bold text-red-400">EN VIVO</span>
                            : <>
                                <div className="text-xs font-semibold text-gray-300 leading-tight">
                                  {formatMatchTime(match.kickoffAt)}
                                </div>
                                <div className="text-xs text-gray-600 leading-tight">
                                  {match.group ? `Grupo ${match.group.label}` : ''}
                                </div>
                              </>
                          }
                        </div>

                        {/* Home team — right aligned */}
                        <div className="flex items-center justify-end gap-2 min-w-0">
                          <span className="text-sm font-semibold text-white truncate text-right">
                            {match.homeTeam.name}
                          </span>
                          <TeamFlag team={match.homeTeam} size="sm" />
                        </div>

                        {/* Center: inline prediction or result */}
                        <div className="flex justify-center px-1">
                          {isFinished ? (
                            <div className="flex flex-col items-center">
                              {prediction && (
                                <span className="text-sm font-bold text-white tabular-nums font-mono leading-tight">
                                  {prediction.homeScore}–{prediction.awayScore}
                                </span>
                              )}
                              {match.homeScore !== null && (
                                <span className={cn(
                                  'text-xs tabular-nums',
                                  prediction ? 'text-gray-600' : 'text-gray-400 font-bold'
                                )}>
                                  {prediction ? `(${match.homeScore}–${match.awayScore})` : `${match.homeScore}–${match.awayScore}`}
                                </span>
                              )}
                              {!prediction && !match.homeScore && (
                                <span className="text-xs text-gray-600">Fin</span>
                              )}
                            </div>
                          ) : locked ? (
                            // Match started, prediction locked
                            prediction ? (
                              <span className="text-sm font-bold text-white tabular-nums font-mono">
                                {prediction.homeScore}–{prediction.awayScore}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-600">—</span>
                            )
                          ) : (
                            // Open for prediction — show inline inputs
                            <InlinePrediction
                              matchId={match.id}
                              participantId={participant.id}
                              existingHome={prediction?.homeScore}
                              existingAway={prediction?.awayScore}
                            />
                          )}
                        </div>

                        {/* Away team — left aligned */}
                        <div className="flex items-center justify-start gap-2 min-w-0">
                          <TeamFlag team={match.awayTeam} size="sm" />
                          <span className="text-sm font-semibold text-white truncate">
                            {match.awayTeam.name}
                          </span>
                        </div>

                        {/* Status badge */}
                        <div className="flex items-center justify-end w-16">
                          {isFinished && prediction ? (
                            <span className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums',
                              prediction.points === 5 ? 'bg-amber-500/20 text-amber-400' :
                              prediction.points === 3 ? 'bg-green-500/20 text-green-400' :
                              prediction.points === 1 ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/10 text-gray-500'
                            )}>
                              {prediction.points ?? 0} pts
                            </span>
                          ) : locked && !isFinished ? (
                            <Lock className="w-3.5 h-3.5 text-gray-600" />
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
