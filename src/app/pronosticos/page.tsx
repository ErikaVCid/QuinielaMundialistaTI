import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchDate, formatMatchTime, isMatchLocked } from '@/lib/utils'
import { Lock, Clock, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

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
        <p className="text-gray-400 text-sm">Historial y estado de todos tus pronósticos</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold text-green-400">{participant.totalPoints}</div>
          <div className="text-xs text-gray-500 mt-0.5">Puntos totales</div>
        </div>
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{participant.exactHits}</div>
          <div className="text-xs text-gray-500 mt-0.5">Marcadores exactos</div>
        </div>
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{participant.resultHits}</div>
          <div className="text-xs text-gray-500 mt-0.5">Resultados acertados</div>
        </div>
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{withoutPrediction.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Pendientes</div>
        </div>
      </div>

      {/* Pending predictions alert */}
      {withoutPrediction.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 font-medium text-sm">Tienes {withoutPrediction.length} partidos sin pronóstico</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {withoutPrediction.slice(0, 3).map((m) => (
              <Link key={m.id} href={`/partidos/${m.id}`}
                className="text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-3 py-1.5 rounded-lg hover:bg-yellow-500/20 transition-all flex items-center gap-1">
                <Plus className="w-3 h-3" />
                {m.homeTeam.flag} {m.homeTeam.code} vs {m.awayTeam.flag} {m.awayTeam.code}
              </Link>
            ))}
            {withoutPrediction.length > 3 && (
              <span className="text-xs text-yellow-400">+{withoutPrediction.length - 3} más</span>
            )}
          </div>
        </div>
      )}

      {/* Predictions list */}
      <div className="space-y-3">
        {matches.map((match) => {
          const prediction = match.predictions[0]
          const locked = isMatchLocked(match.kickoffAt) || match.status !== 'SCHEDULED'

          return (
            <Link key={match.id} href={`/partidos/${match.id}`}>
              <div className={cn(
                'bg-[#111118] rounded-xl border p-4 match-card-hover',
                prediction ? 'border-[#1e1e2e]' : 'border-yellow-500/10',
              )}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-center min-w-16">
                      <div className="text-xs text-gray-500">{formatMatchTime(match.kickoffAt)}</div>
                      <div className="text-xs text-gray-600">{formatMatchDate(match.kickoffAt).split(' ').slice(0, 2).join(' ')}</div>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <span>{match.homeTeam.flag} {match.homeTeam.code}</span>
                      <span className="text-gray-500">vs</span>
                      <span>{match.awayTeam.flag} {match.awayTeam.code}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {prediction ? (
                      <>
                        <span className="text-base font-bold text-white tabular-nums font-mono">
                          {prediction.homeScore} – {prediction.awayScore}
                        </span>
                        {match.status === 'FINISHED' && (
                          <span className={cn(
                            'text-sm font-bold px-2 py-1 rounded-lg',
                            prediction.points === 5 ? 'bg-amber-500/20 text-amber-400' :
                            prediction.points === 3 ? 'bg-green-500/20 text-green-400' :
                            prediction.points === 1 ? 'bg-blue-500/20 text-blue-400' :
                            'bg-gray-500/10 text-gray-500'
                          )}>
                            {prediction.points ?? 0} pts
                          </span>
                        )}
                        {locked && match.status !== 'FINISHED' && (
                          <Lock className="w-3.5 h-3.5 text-gray-500" />
                        )}
                      </>
                    ) : (
                      <span className={cn(
                        'text-xs px-2 py-1 rounded-lg font-medium',
                        locked ? 'text-gray-500 bg-gray-500/10' : 'text-yellow-400 bg-yellow-500/10'
                      )}>
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
    </div>
  )
}
