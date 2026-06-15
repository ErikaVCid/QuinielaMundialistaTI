import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatMatchTime } from '@/lib/utils'
import { Trophy, Target, TrendingUp, Calendar } from 'lucide-react'
import { EditProfileForm } from '@/components/edit-profile-form'
import { TeamFlag } from '@/components/team-flag'

export default async function PerfilPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const participant = await prisma.participant.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      predictions: {
        include: { match: { include: { homeTeam: true, awayTeam: true } } },
        orderBy: { submittedAt: 'desc' },
        take: 10,
      },
    },
  })

  if (!participant) redirect('/login')

  const stats = [
    { icon: Trophy, label: 'Puntos totales', value: participant.totalPoints, color: 'text-green-400' },
    { icon: Target, label: 'Exactos', value: participant.exactHits, color: 'text-amber-400' },
    { icon: TrendingUp, label: 'Resultados', value: participant.resultHits, color: 'text-blue-400' },
    { icon: Calendar, label: 'Pronósticos', value: participant.predictions.length, color: 'text-purple-400' },
  ]

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl">
      {/* Profile header */}
      <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-blue-500/30 border border-[#2e2e3e] flex items-center justify-center text-2xl font-bold text-white">
            {participant.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <EditProfileForm participantId={participant.id} currentDisplayName={participant.displayName} />
            <p className="text-gray-400 text-sm mt-0.5">{participant.user.email}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Posición #{participant.position ?? '—'} en el ranking
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
            <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent predictions */}
      <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6">
        <h2 className="text-white font-semibold mb-4">Pronósticos recientes</h2>
        <div className="space-y-3">
          {participant.predictions.map((pred) => (
            <div key={pred.id} className="flex items-center justify-between py-2 border-b border-[#1e1e2e] last:border-0">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">{formatMatchTime(pred.match.kickoffAt)}</span>
                <span className="text-white font-medium">
                  <><TeamFlag team={pred.match.homeTeam} size="xs" /> {pred.match.homeTeam.code} vs <TeamFlag team={pred.match.awayTeam} size="xs" /> {pred.match.awayTeam.code}</>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-bold text-white">{pred.homeScore}–{pred.awayScore}</span>
                {pred.points !== null && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${pred.points === 5 ? 'bg-amber-500/20 text-amber-400' : pred.points === 3 ? 'bg-green-500/20 text-green-400' : pred.points === 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/10 text-gray-500'}`}>
                    {pred.points} pts
                  </span>
                )}
              </div>
            </div>
          ))}
          {participant.predictions.length === 0 && (
            <p className="text-center text-gray-500 py-6 text-sm">Aún no has registrado ningún pronóstico.</p>
          )}
        </div>
      </div>
    </div>
  )
}
