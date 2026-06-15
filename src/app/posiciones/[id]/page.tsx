import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { ArrowLeft, Trophy, Star, TrendingUp, Calendar, Target } from 'lucide-react'
import { TeamFlag } from '@/components/team-flag'
import { cn } from '@/lib/utils'

export default async function ParticipantStatsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params

  const participant = await prisma.participant.findUnique({
    where: { id },
    include: {
      user: { select: { name: true } },
      predictions: {
        include: { match: { include: { homeTeam: true, awayTeam: true } } },
        orderBy: { submittedAt: 'desc' },
      },
    },
  })
  if (!participant) notFound()

  const isMe = participant.userId === session.user?.id

  const finished = participant.predictions.filter(p => p.match.status === 'FINISHED')
  const pending  = participant.predictions.filter(p => p.match.status === 'SCHEDULED')
  const exactPct  = finished.length > 0 ? Math.round((participant.exactHits  / finished.length) * 100) : 0
  const resultPct = finished.length > 0 ? Math.round((participant.resultHits / finished.length) * 100) : 0
  const bestGame  = finished.reduce((max, p) => (p.points ?? 0) > (max?.points ?? 0) ? p : max, finished[0])

  // Ranking context
  const allParticipants = await prisma.participant.count()

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl space-y-6">

      {/* Back */}
      <Link href="/posiciones" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-sm transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Tabla de posiciones
      </Link>

      {/* Header */}
      <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-blue-500/30 border border-[#2e2e3e] flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            {participant.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{participant.displayName}</h1>
              {isMe && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">Tú</span>}
            </div>
            <p className="text-gray-500 text-sm mt-0.5">{participant.user.name}</p>
            <p className="text-gray-600 text-xs mt-1">
              Posición #{participant.position ?? '—'} de {allParticipants} participantes
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy,    label: 'Puntos',    value: participant.totalPoints,  color: 'text-green-400', sub: `#${participant.position ?? '—'} ranking` },
          { icon: Star,      label: 'Exactos',   value: `${participant.exactHits} (${exactPct}%)`, color: 'text-amber-400', sub: 'marcador exacto' },
          { icon: TrendingUp,label: 'Resultados',value: `${participant.resultHits} (${resultPct}%)`, color: 'text-blue-400', sub: 'resultado acertado' },
          { icon: Calendar,  label: 'Pronósticos',value: participant.predictions.length, color: 'text-purple-400', sub: `${pending.length} pendientes` },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
            <Icon className={`w-4 h-4 ${color} mx-auto mb-2`} />
            <div className={`text-xl font-bold ${color} leading-tight`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium">{label}</div>
            <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Best prediction */}
      {bestGame && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <Star className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">Mejor pronóstico</p>
            <div className="flex items-center gap-2">
              <TeamFlag team={bestGame.match.homeTeam} size="xs" />
              <span className="text-sm text-white">{bestGame.match.homeTeam.name}</span>
              <span className="text-xs text-gray-500 font-mono">{bestGame.homeScore}–{bestGame.awayScore}</span>
              <span className="text-sm text-white">{bestGame.match.awayTeam.name}</span>
              <TeamFlag team={bestGame.match.awayTeam} size="xs" />
            </div>
          </div>
          <span className="text-xl font-bold text-amber-400 flex-shrink-0">{bestGame.points} pts</span>
        </div>
      )}

      {/* Finished predictions */}
      {finished.length > 0 && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e2e]">
            <h2 className="text-white font-semibold">Historial de resultados</h2>
          </div>
          <div className="divide-y divide-[#1e1e2e]">
            {finished.map((pred) => {
              const m = pred.match
              return (
                <Link key={pred.id} href={`/partidos/${m.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TeamFlag team={m.homeTeam} size="xs" />
                    <span className="text-xs text-gray-400 truncate hidden sm:block">{m.homeTeam.name}</span>
                    <span className={cn(
                      'text-xs font-bold tabular-nums font-mono px-2 py-0.5 rounded',
                      pred.points === 5 ? 'bg-amber-500/20 text-amber-400' :
                      pred.points === 3 ? 'bg-green-500/20 text-green-300' :
                      'bg-[#1a1a24] text-gray-400'
                    )}>
                      {pred.homeScore}–{pred.awayScore}
                    </span>
                    <span className="text-xs text-gray-400 truncate hidden sm:block">{m.awayTeam.name}</span>
                    <TeamFlag team={m.awayTeam} size="xs" />
                  </div>
                  <div className="text-xs text-gray-600 flex-shrink-0">
                    Real: {m.homeScore}–{m.awayScore}
                  </div>
                  <div className={cn(
                    'text-sm font-bold w-12 text-right flex-shrink-0',
                    pred.points === 5 ? 'text-amber-400' :
                    pred.points === 3 ? 'text-green-400' :
                    pred.points === 1 ? 'text-blue-400' : 'text-gray-600'
                  )}>
                    {pred.points !== null ? `${pred.points}p` : '—'}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {participant.predictions.length === 0 && (
        <div className="text-center py-12">
          <Target className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            {isMe ? 'Aún no has registrado ningún pronóstico.' : 'Este participante aún no tiene pronósticos.'}
          </p>
        </div>
      )}
    </div>
  )
}
