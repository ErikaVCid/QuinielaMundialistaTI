import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchTime, isMatchLocked } from '@/lib/utils'
import { Lock, Clock, Plus, CheckCircle, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function TeamFlag({ flag, name, size = 'sm' }: { flag: string | null; name: string; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-5 h-auto' : 'w-6 h-auto'
  if (!flag) return <span className={cn('rounded bg-[#2e2e3e] inline-block', size === 'xs' ? 'w-5 h-3.5' : 'w-6 h-4')} />
  if (flag.startsWith('http')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={flag} alt={name} className={cn(cls, 'rounded-sm object-cover inline-block flex-shrink-0')} />
    )
  }
  return <span className={size === 'xs' ? 'text-base leading-none' : 'text-lg leading-none'}>{flag}</span>
}

function shortDate(date: Date) {
  return format(date, "d MMM", { locale: es })
}

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

  const withoutPrediction = matches.filter(
    (m) => m.predictions.length === 0 && m.status === 'SCHEDULED' && !isMatchLocked(m.kickoffAt)
  )

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Mis Pronósticos</h1>
        <p className="text-gray-500 text-sm">Historial y estado de todos tus pronósticos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { value: participant.totalPoints, label: 'Puntos totales',     color: 'text-green-400' },
          { value: participant.exactHits,   label: 'Marcadores exactos', color: 'text-amber-400' },
          { value: participant.resultHits,  label: 'Resultados acertados', color: 'text-blue-400' },
          { value: withoutPrediction.length, label: 'Pendientes',        color: 'text-yellow-400' },
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
              Tienes {withoutPrediction.length} partido{withoutPrediction.length !== 1 ? 's' : ''} sin pronóstico
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {withoutPrediction.slice(0, 3).map((m) => (
              <Link key={m.id} href={`/partidos/${m.id}`}
                className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20 transition-all">
                <Plus className="w-3 h-3 flex-shrink-0" />
                <TeamFlag flag={m.homeTeam.flag} name={m.homeTeam.name} size="xs" />
                <span>{m.homeTeam.code}</span>
                <span className="text-yellow-600">vs</span>
                <TeamFlag flag={m.awayTeam.flag} name={m.awayTeam.name} size="xs" />
                <span>{m.awayTeam.code}</span>
              </Link>
            ))}
            {withoutPrediction.length > 3 && (
              <span className="text-xs text-yellow-500 flex items-center px-2">
                +{withoutPrediction.length - 3} más
              </span>
            )}
          </div>
        </div>
      )}

      {/* Match list */}
      <div className="space-y-2">
        {matches.map((match) => {
          const prediction = match.predictions[0]
          const locked = isMatchLocked(match.kickoffAt) || match.status !== 'SCHEDULED'
          const isFinished = match.status === 'FINISHED'
          const isLive = match.status === 'LIVE'

          return (
            <Link key={match.id} href={`/partidos/${match.id}`} className="block group">
              <div className={cn(
                'bg-[#111118] rounded-xl border px-4 py-3 transition-all',
                'group-hover:border-green-500/20 group-hover:bg-[#131320]',
                isLive ? 'border-red-500/30' :
                prediction ? 'border-[#1e1e2e]' : 'border-yellow-500/15',
              )}>
                <div className="flex items-center gap-3">

                  {/* Date/time */}
                  <div className="text-center w-14 flex-shrink-0">
                    <div className="text-xs font-medium text-white">{formatMatchTime(match.kickoffAt)}</div>
                    <div className="text-xs text-gray-600">{shortDate(match.kickoffAt)}</div>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TeamFlag flag={match.homeTeam.flag} name={match.homeTeam.name} />
                      <span className="text-sm font-medium text-white truncate">{match.homeTeam.name}</span>
                    </div>
                    <span className="text-gray-600 text-xs flex-shrink-0">vs</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <TeamFlag flag={match.awayTeam.flag} name={match.awayTeam.name} />
                      <span className="text-sm font-medium text-white truncate">{match.awayTeam.name}</span>
                    </div>
                  </div>

                  {/* Prediction / status */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {prediction ? (
                      <>
                        {/* User's prediction */}
                        <span className="text-sm font-bold text-white tabular-nums font-mono">
                          {prediction.homeScore}–{prediction.awayScore}
                        </span>

                        {/* Points badge (finished matches) */}
                        {isFinished && (
                          <span className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded-lg',
                            prediction.points === 5 ? 'bg-amber-500/20 text-amber-400' :
                            prediction.points === 3 ? 'bg-green-500/20 text-green-400' :
                            prediction.points === 1 ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/10 text-gray-500'
                          )}>
                            {prediction.points ?? 0} pts
                          </span>
                        )}

                        {/* Match score (finished) */}
                        {isFinished && match.homeScore !== null && (
                          <span className="text-xs text-gray-500 tabular-nums">
                            ({match.homeScore}–{match.awayScore})
                          </span>
                        )}

                        {/* Locked icon */}
                        {locked && !isFinished && <Lock className="w-3 h-3 text-gray-600" />}
                        {!locked && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                      </>
                    ) : (
                      <span className={cn(
                        'text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1',
                        locked
                          ? 'text-gray-600 bg-gray-500/10'
                          : 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
                      )}>
                        {!locked && <Target className="w-3 h-3" />}
                        {locked ? 'Sin pronóstico' : 'Pendiente'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {matches.length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">No hay partidos disponibles.</div>
      )}
    </div>
  )
}
