import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatMatchDate, formatMatchTime, phaseLabel, isMatchLocked } from '@/lib/utils'
import { PredictionForm } from '@/components/prediction-form'
import { MapPin, Clock, Trophy, Users } from 'lucide-react'

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      group: true,
    },
  })

  if (!match) notFound()

  const participant = await prisma.participant.findUnique({
    where: { userId: session.user.id },
  })

  const existingPrediction = participant
    ? await prisma.prediction.findUnique({
        where: { participantId_matchId: { participantId: participant.id, matchId: match.id } },
      })
    : null

  const locked = isMatchLocked(match.kickoffAt)

  // If finished, show all predictions
  const allPredictions =
    match.status === 'FINISHED'
      ? await prisma.prediction.findMany({
          where: { matchId: match.id },
          include: { participant: true },
          orderBy: { points: 'desc' },
        })
      : []

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl">
      {/* Match header */}
      <div className={`rounded-2xl border p-6 md:p-8 mb-6 ${match.status === 'LIVE' ? 'bg-gradient-to-r from-red-950/30 to-[#111118] border-red-500/20' : 'bg-[#111118] border-[#1e1e2e]'}`}>
        <div className="text-center mb-2">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
            {match.group ? `Grupo ${match.group.label} · ` : ''}{phaseLabel(match.phase)}
          </span>
        </div>

        {/* Teams and Score */}
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex-1 text-center">
            <div className="text-5xl mb-2">{match.homeTeam.flag}</div>
            <div className="text-lg font-bold text-white">{match.homeTeam.name}</div>
            <div className="text-sm text-gray-400">{match.homeTeam.code}</div>
          </div>

          <div className="text-center px-4">
            {match.status === 'FINISHED' || match.status === 'LIVE' ? (
              <>
                <div className="text-4xl font-bold text-white tabular-nums">
                  {match.homeScore ?? 0} – {match.awayScore ?? 0}
                </div>
                <div className={`text-xs font-semibold mt-1 ${match.status === 'LIVE' ? 'text-red-400' : 'text-green-400'}`}>
                  {match.status === 'LIVE' ? '⚡ EN VIVO' : '✓ FINALIZADO'}
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-gray-500">VS</div>
                <div className="text-sm text-green-400 font-semibold mt-1">
                  {formatMatchTime(match.kickoffAt)}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 text-center">
            <div className="text-5xl mb-2">{match.awayTeam.flag}</div>
            <div className="text-lg font-bold text-white">{match.awayTeam.name}</div>
            <div className="text-sm text-gray-400">{match.awayTeam.code}</div>
          </div>
        </div>

        {/* Match info */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-[#1e1e2e] text-xs text-gray-500">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatMatchDate(match.kickoffAt)}, {formatMatchTime(match.kickoffAt)}</span>
          {match.stadium && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{match.stadium}</span>}
          {match.city && <span>{match.city}</span>}
        </div>
      </div>

      {/* Prediction section */}
      {participant && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6 mb-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-green-400" />
            Tu Pronóstico
          </h2>
          {locked && match.status === 'SCHEDULED' ? (
            <div className="text-center py-4 text-yellow-400 text-sm">
              🔒 Este partido ya comenzó. No se pueden editar pronósticos.
            </div>
          ) : (
            <PredictionForm
              matchId={match.id}
              participantId={participant.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              existingPrediction={existingPrediction ? {
                homeScore: existingPrediction.homeScore,
                awayScore: existingPrediction.awayScore,
                isLocked: existingPrediction.isLocked,
              } : null}
              isLocked={locked || match.status !== 'SCHEDULED'}
            />
          )}
        </div>
      )}

      {/* All predictions (after match) */}
      {allPredictions.length > 0 && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" />
            Pronósticos de todos
          </h2>
          <div className="space-y-2">
            {allPredictions.map((pred) => (
              <div key={pred.id} className="flex items-center justify-between py-2 border-b border-[#1e1e2e] last:border-0">
                <span className="text-sm text-gray-300">{pred.participant.displayName}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-white font-bold">
                    {pred.homeScore} – {pred.awayScore}
                  </span>
                  <span className={`text-sm font-bold ${pred.points === 5 ? 'text-amber-400' : pred.points === 3 ? 'text-green-400' : pred.points === 1 ? 'text-blue-400' : 'text-gray-500'}`}>
                    {pred.points ?? 0} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
