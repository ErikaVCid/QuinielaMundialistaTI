import { auth } from '@/lib/auth'
import { TeamFlag } from '@/components/team-flag'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatMatchDate, formatMatchTime } from '@/lib/utils'
import { Target } from 'lucide-react'

export default async function MatchPredictionsPage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')

  const { matchId } = await params
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      predictions: {
        include: { participant: true },
        orderBy: { submittedAt: 'asc' },
      },
    },
  })

  if (!match) notFound()

  const totalParticipants = await prisma.participant.count()
  const noPrediction = await prisma.participant.findMany({
    where: { id: { notIn: match.predictions.map(p => p.participantId) } },
    select: { displayName: true },
  })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl">
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-5 mb-6">
        <div className="text-center mb-3 text-xs text-gray-500">{formatMatchDate(match.kickoffAt)} · {formatMatchTime(match.kickoffAt)}</div>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="mb-2 flex justify-center"><TeamFlag team={match.homeTeam} size="lg" /></div>
            <div className="text-white font-bold">{match.homeTeam.code}</div>
          </div>
          <div className="text-center">
            {match.status === 'FINISHED' ? (
              <div className="text-2xl font-bold text-white">{match.homeScore} – {match.awayScore}</div>
            ) : (
              <div className="text-lg font-bold text-gray-500">VS</div>
            )}
          </div>
          <div className="text-center">
            <div className="mb-2 flex justify-center"><TeamFlag team={match.awayTeam} size="lg" /></div>
            <div className="text-white font-bold">{match.awayTeam.code}</div>
          </div>
        </div>
      </div>

      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden mb-4">
        <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between">
          <h2 className="text-white font-semibold text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-green-400" />
            Pronósticos ({match.predictions.length}/{totalParticipants})
          </h2>
        </div>
        {match.predictions.map((pred) => (
          <div key={pred.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e2e] last:border-0 text-sm">
            <span className="text-gray-300">{pred.participant.displayName}</span>
            <div className="flex items-center gap-4">
              <span className="font-mono font-bold text-white">{pred.homeScore} – {pred.awayScore}</span>
              {pred.points !== null && (
                <span className={`font-bold text-xs px-2 py-0.5 rounded ${pred.points === 5 ? 'bg-amber-500/20 text-amber-400' : pred.points === 3 ? 'bg-green-500/20 text-green-400' : pred.points === 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/10 text-gray-500'}`}>
                  {pred.points} pts
                </span>
              )}
            </div>
          </div>
        ))}
        {match.predictions.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">Nadie ha pronosticado este partido aún</div>
        )}
      </div>

      {noPrediction.length > 0 && (
        <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-4">
          <div className="text-xs text-yellow-400 font-medium mb-2">Sin pronóstico ({noPrediction.length}):</div>
          <div className="flex flex-wrap gap-2">
            {noPrediction.map(p => (
              <span key={p.displayName} className="text-xs text-gray-400 bg-[#1a1a24] px-2 py-1 rounded">{p.displayName}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
