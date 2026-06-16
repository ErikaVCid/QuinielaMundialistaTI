import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, ChevronRight, Star, Target, Trophy } from 'lucide-react'

function getPositionChange(current: number, prev: number | null): number {
  if (!prev) return 0
  return prev - current
}

// Deterministic gradient per user initial
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
  const idx = name.charCodeAt(0) % GRADIENTS.length
  return GRADIENTS[idx]
}

const RANK_COLORS = ['text-amber-400', 'text-gray-300', 'text-orange-400']
const RANK_RINGS  = ['ring-amber-400/50', 'ring-gray-400/40', 'ring-orange-400/40']
const RANK_BG     = ['bg-amber-500/10 border-amber-500/20', 'bg-gray-500/5 border-gray-500/20', 'bg-orange-500/5 border-orange-500/20']

export default async function PosicionesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const participants = await prisma.participant.findMany({
    include: {
      user: { select: { name: true, image: true } },
      _count: { select: { predictions: true } },
    },
    orderBy: [
      { totalPoints: 'desc' },
      { exactHits: 'desc' },
      { resultHits: 'desc' },
    ],
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
  const totalPredictions = participants.reduce((s, p) => s + p._count.predictions, 0)
  const topPoints = ranked[0]?.totalPoints ?? 0

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Comunidad</h1>
          <p className="text-gray-500 text-sm">
            {ranked.length} participantes · {totalPredictions} pronósticos registrados · Mundial FIFA México 2026
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

      {/* ── User card grid ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {ranked.map((p) => {
          const isMe = p.userId === session.user?.id
          const isTop3 = p.rank <= 3
          const rankColor = RANK_COLORS[p.rank - 1] ?? 'text-gray-500'
          const rankRing  = RANK_RINGS[p.rank - 1]  ?? ''
          const rankBg    = RANK_BG[p.rank - 1]     ?? 'bg-[#111118] border-[#1e1e2e]'
          const grad      = avatarGradient(p.displayName)

          return (
            <Link key={p.id} href={`/posiciones/${p.id}`} className="group">
              <div className={cn(
                'rounded-2xl border p-4 text-center transition-all',
                'group-hover:scale-[1.02] group-hover:shadow-lg',
                isMe ? 'bg-green-500/10 border-green-500/25 ring-1 ring-green-500/30' :
                isTop3 ? rankBg : 'bg-[#111118] border-[#1e1e2e] hover:border-[#2e2e3e]',
              )}>

                {/* Rank badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-lg font-black', isMe ? 'text-green-400' : rankColor)}>
                    #{p.rank}
                  </span>
                  {p.rank === 1 && <span className="text-base">🥇</span>}
                  {p.rank === 2 && <span className="text-base">🥈</span>}
                  {p.rank === 3 && <span className="text-base">🥉</span>}
                  {isMe && p.rank > 3 && <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">tú</span>}
                </div>

                {/* Avatar */}
                <div className={cn(
                  'w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center',
                  `bg-gradient-to-br ${grad}`,
                  'text-2xl font-black text-white shadow-lg',
                  isTop3 ? `ring-2 ring-offset-2 ring-offset-[#0a0a0f] ${rankRing}` : '',
                )}>
                  {p.displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div className={cn(
                  'text-sm font-bold truncate mb-1',
                  isMe ? 'text-green-400' : 'text-white'
                )}>
                  {p.displayName}
                </div>

                {/* Points */}
                <div className={cn(
                  'text-2xl font-black mb-2',
                  isMe ? 'text-green-400' :
                  p.rank === 1 ? 'text-amber-400' :
                  p.rank === 2 ? 'text-gray-300' :
                  p.rank === 3 ? 'text-orange-400' :
                  'text-white'
                )}>
                  {p.totalPoints}
                  <span className="text-xs font-medium text-gray-500 ml-0.5">pts</span>
                </div>

                {/* Stats mini bar */}
                <div className="flex justify-center gap-3 text-xs">
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Star className="w-2.5 h-2.5" />{p.exactHits}
                  </span>
                  <span className="flex items-center gap-0.5 text-green-400">
                    <Target className="w-2.5 h-2.5" />{p.resultHits}
                  </span>
                  <span className="text-gray-600">{p._count.predictions}⚽</span>
                </div>

                {/* Progress bar vs leader */}
                {topPoints > 0 && (
                  <div className="mt-3 h-1 bg-[#1a1a28] rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', isMe ? 'bg-green-500' : 'bg-[#3a3a4a]')}
                      style={{ width: `${Math.round((p.totalPoints / topPoints) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Detailed ranking table ───────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="text-white font-semibold">Tabla de Posiciones</h2>
          <div className="h-px flex-1 bg-[#1e1e2e]" />
        </div>

        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider border-b border-[#1e1e2e]">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Participante</div>
            <div className="col-span-2 text-center">Pts</div>
            <div className="col-span-2 text-center">⭐ Exactos</div>
            <div className="col-span-2 text-center">✓ Result.</div>
            <div className="col-span-1 text-center">Mov</div>
          </div>

          {ranked.map((p) => {
            const change = getPositionChange(p.rank, p.positionPrev)
            const isMe   = p.userId === session.user?.id
            return (
              <Link key={p.id} href={`/posiciones/${p.id}`}
                className={cn(
                  'grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-[#1e1e2e] last:border-0 transition-colors group',
                  isMe ? 'bg-green-500/5 hover:bg-green-500/8' : 'hover:bg-white/[0.02]',
                  p.rank === 1 ? 'border-l-2 border-l-amber-500' : '',
                )}>
                <div className="col-span-1 flex items-center">
                  <span className={cn('font-bold',
                    p.rank === 1 ? 'text-amber-400 text-base' :
                    p.rank === 2 ? 'text-gray-300' :
                    p.rank === 3 ? 'text-orange-400' : 'text-gray-500 text-sm'
                  )}>{p.rank}</span>
                </div>

                <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black text-white',
                    `bg-gradient-to-br ${avatarGradient(p.displayName)}`,
                  )}>
                    {p.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className={cn('font-semibold truncate', isMe ? 'text-green-400' : 'text-white')}>
                      {p.displayName}
                      {isMe && <span className="ml-1.5 text-xs text-green-600">(tú)</span>}
                    </div>
                    <div className="text-xs text-gray-600">{p._count.predictions} pronósticos</div>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-center">
                  <span className={cn('font-black text-base tabular-nums',
                    isMe ? 'text-green-400' :
                    p.rank === 1 ? 'text-amber-400' : 'text-white'
                  )}>{p.totalPoints}</span>
                </div>

                <div className="col-span-2 flex items-center justify-center">
                  <span className="font-semibold text-amber-400">{p.exactHits}</span>
                </div>

                <div className="col-span-2 flex items-center justify-center">
                  <span className="text-green-400">{p.resultHits}</span>
                </div>

                <div className="col-span-1 flex items-center justify-end gap-1">
                  {change > 0
                    ? <TrendingUp className="w-4 h-4 text-green-400" />
                    : change < 0
                    ? <TrendingDown className="w-4 h-4 text-red-400" />
                    : <Minus className="w-4 h-4 text-gray-700" />}
                  <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-400 hidden md:block" />
                </div>
              </Link>
            )
          })}

          {ranked.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              Aún no hay participantes registrados.
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1"><Star className="w-3 h-3 text-amber-400" /> Marcador exacto (5 pts)</span>
        <span className="flex items-center gap-1"><Target className="w-3 h-3 text-green-400" /> Resultado correcto (3 pts)</span>
        <span>La barra bajo los pts indica % del puntaje máximo</span>
      </div>
    </div>
  )
}
