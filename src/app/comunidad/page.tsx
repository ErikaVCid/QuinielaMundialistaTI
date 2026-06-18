import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { cn, formatMatchTime } from '@/lib/utils'
import { Star, Target, Users, Trophy, CheckCircle2, XCircle } from 'lucide-react'

const GRADIENTS = [
  'from-green-600 to-emerald-400',
  'from-blue-600 to-cyan-400',
  'from-purple-600 to-pink-400',
  'from-amber-600 to-yellow-400',
  'from-red-600 to-rose-400',
  'from-teal-600 to-cyan-400',
  'from-indigo-600 to-blue-400',
  'from-orange-600 to-amber-400',
]

function avatarGradient(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]
}

export default async function ComunidadPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Participants ranked
  const participants = await prisma.participant.findMany({
    include: {
      user: { select: { name: true } },
      _count: { select: { predictions: true } },
    },
    orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
  })

  type Ranked = typeof participants[0] & { rank: number }
  const ranked = participants.reduce<Ranked[]>((acc, p, i) => {
    const prev = acc[i - 1]
    const rank = (prev && p.totalPoints === prev.totalPoints && p.exactHits === prev.exactHits)
      ? prev.rank : i + 1
    acc.push({ ...p, rank })
    return acc
  }, [])

  const myParticipant = ranked.find(p => p.userId === session.user?.id)
  const topPoints = ranked[0]?.totalPoints ?? 0
  const totalPredictions = participants.reduce((s, p) => s + p._count.predictions, 0)

  // Finished matches with all predictions
  const finishedMatches = await prisma.match.findMany({
    where: { status: 'FINISHED', homeScore: { not: null }, awayScore: { not: null } },
    include: {
      homeTeam: { select: { name: true, code: true, flag: true } },
      awayTeam: { select: { name: true, code: true, flag: true } },
      predictions: {
        include: { participant: { select: { id: true, displayName: true } } },
      },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  // Build a lookup: matchId → participantId → prediction
  const predMap = new Map<string, Map<string, { homeScore: number; awayScore: number; points: number; isLocked: boolean }>>()
  for (const match of finishedMatches) {
    const byParticipant = new Map<string, { homeScore: number; awayScore: number; points: number; isLocked: boolean }>()
    for (const pred of match.predictions) {
      byParticipant.set(pred.participantId, {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        points: pred.points ?? 0,
        isLocked: pred.isLocked,
      })
    }
    predMap.set(match.id, byParticipant)
  }

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-6xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-5 h-5 text-green-400" />
            <h1 className="text-2xl font-bold text-white">Comunidad</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {ranked.length} participantes · {totalPredictions} pronósticos — Mundial FIFA México 2026
          </p>
        </div>
        {myParticipant && (
          <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2.5">
            <span className="text-xs text-gray-500">Tu posición</span>
            <span className="text-xl font-black text-green-400">#{myParticipant.rank}</span>
            <span className="text-sm font-bold text-white">{myParticipant.displayName}</span>
            <span className="text-green-400 font-bold">{myParticipant.totalPoints} pts</span>
          </div>
        )}
      </div>

      {/* ── Tabla de posiciones ── */}
      <section>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" /> Tabla de Posiciones
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e] text-gray-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 w-10">#</th>
                <th className="text-left px-4 py-3">Participante</th>
                <th className="text-right px-4 py-3">Pts</th>
                <th className="text-right px-4 py-3">
                  <Star className="w-3 h-3 inline text-amber-400" /> Exactos
                </th>
                <th className="text-right px-4 py-3">
                  <Target className="w-3 h-3 inline text-green-400" /> Resultados
                </th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Pronósticos</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p) => {
                const isMe = p.userId === session.user?.id
                const rankColors = ['text-amber-400', 'text-gray-300', 'text-orange-400']
                const grad = avatarGradient(p.displayName)
                const posChange = p.position !== null && p.positionPrev !== null
                  ? p.positionPrev - p.position : 0

                return (
                  <tr key={p.id}
                    className={cn(
                      'border-b border-[#1e1e2e] last:border-0 transition-colors',
                      isMe ? 'bg-green-500/8' : 'hover:bg-[#111118]'
                    )}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={cn('font-black text-base',
                          isMe ? 'text-green-400' : (rankColors[p.rank - 1] ?? 'text-gray-400')
                        )}>
                          {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : `#${p.rank}`}
                        </span>
                        {posChange > 0 && <span className="text-green-400 text-xs">▲{posChange}</span>}
                        {posChange < 0 && <span className="text-red-400 text-xs">▼{Math.abs(posChange)}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/posiciones/${p.id}`} className="flex items-center gap-2 group">
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0',
                          `bg-gradient-to-br ${grad}`
                        )}>
                          {p.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className={cn('font-semibold group-hover:underline',
                            isMe ? 'text-green-400' : 'text-white'
                          )}>
                            {p.displayName}
                          </span>
                          {isMe && <span className="ml-1.5 text-xs bg-green-500/20 text-green-400 px-1 py-0.5 rounded">tú</span>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('text-lg font-black',
                        isMe ? 'text-green-400' :
                        p.rank === 1 ? 'text-amber-400' :
                        p.rank === 2 ? 'text-gray-300' :
                        p.rank === 3 ? 'text-orange-400' : 'text-white'
                      )}>
                        {p.totalPoints}
                      </span>
                      <span className="text-xs text-gray-600 ml-0.5">pts</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-amber-400 font-bold">{p.exactHits}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-green-400 font-bold">{p.resultHits}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-500">
                      {p._count.predictions}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Tabla de pronósticos vs resultados ── */}
      {finishedMatches.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" /> Pronósticos vs Resultados
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[#1e1e2e]">
            <table className="text-sm min-w-max w-full">
              <thead>
                <tr className="border-b border-[#1e1e2e] text-gray-500 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 sticky left-0 bg-[#0d0d15] z-10 min-w-[140px]">
                    Participante
                  </th>
                  {finishedMatches.map(m => (
                    <th key={m.id} className="text-center px-3 py-3 min-w-[88px]">
                      <div className="text-white font-bold">{m.homeTeam.code}–{m.awayTeam.code}</div>
                      <div className="text-green-400 font-black">{m.homeScore}–{m.awayScore}</div>
                      <div className="text-gray-600 text-[10px]">{formatMatchTime(m.kickoffAt)}</div>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 sticky right-0 bg-[#0d0d15] z-10">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => {
                  const isMe = p.userId === session.user?.id
                  let rowPoints = 0

                  return (
                    <tr key={p.id}
                      className={cn(
                        'border-b border-[#1e1e2e] last:border-0',
                        isMe ? 'bg-green-500/8' : 'hover:bg-[#111118]'
                      )}>
                      {/* Name cell */}
                      <td className={cn(
                        'px-4 py-3 sticky left-0 z-10 font-semibold',
                        isMe ? 'bg-green-500/10 text-green-400' : 'bg-[#0a0a0f] text-white'
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 font-mono w-5">#{p.rank}</span>
                          <span className="truncate max-w-[100px]">{p.displayName}</span>
                        </div>
                      </td>

                      {/* Prediction cells */}
                      {finishedMatches.map(m => {
                        const pred = predMap.get(m.id)?.get(p.id)
                        const pts = pred?.points ?? 0
                        rowPoints += pts

                        if (!pred) {
                          return (
                            <td key={m.id} className="px-3 py-3 text-center">
                              <span className="text-gray-700 text-xs">—</span>
                            </td>
                          )
                        }

                        const isExact = pred.homeScore === m.homeScore && pred.awayScore === m.awayScore
                        const isCorrectResult = !isExact &&
                          Math.sign(pred.homeScore - pred.awayScore) === Math.sign((m.homeScore ?? 0) - (m.awayScore ?? 0))
                        const isWrong = !isExact && !isCorrectResult

                        return (
                          <td key={m.id} className="px-3 py-3 text-center">
                            <div className={cn(
                              'inline-flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-xs font-bold min-w-[60px]',
                              isExact       ? 'bg-amber-500/15 text-amber-300' :
                              isCorrectResult ? 'bg-green-500/15 text-green-400' :
                              'bg-red-500/10 text-red-400'
                            )}>
                              <span>{pred.homeScore}–{pred.awayScore}</span>
                              <span className="text-[10px] font-medium flex items-center gap-0.5">
                                {isExact && <><Star className="w-2.5 h-2.5" />{pts}pts</>}
                                {isCorrectResult && <><CheckCircle2 className="w-2.5 h-2.5" />{pts}pts</>}
                                {isWrong && <><XCircle className="w-2.5 h-2.5" />0pts</>}
                              </span>
                            </div>
                          </td>
                        )
                      })}

                      {/* Total */}
                      <td className={cn(
                        'px-4 py-3 text-right sticky right-0 z-10 font-black',
                        isMe ? 'bg-green-500/10 text-green-400' : 'bg-[#0a0a0f] text-white'
                      )}>
                        {rowPoints}
                        <span className="text-xs text-gray-600 ml-0.5">pts</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-amber-500/30 inline-block" />
              <Star className="w-3 h-3 text-amber-400" /> Marcador exacto
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500/20 inline-block" />
              <CheckCircle2 className="w-3 h-3 text-green-400" /> Resultado correcto
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-500/15 inline-block" />
              <XCircle className="w-3 h-3 text-red-400" /> Incorrecto
            </span>
            <span className="text-gray-600">— Sin pronóstico</span>
          </div>
        </section>
      )}

      <div className="text-center">
        <Link href="/posiciones" className="text-sm text-green-400 hover:text-green-300 transition-colors">
          Ver tabla de posiciones detallada →
        </Link>
      </div>
    </div>
  )
}
