import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Star, Target, Users } from 'lucide-react'

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

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl space-y-6">

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

      {/* User cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
        {ranked.map((p) => {
          const isMe = p.userId === session.user?.id
          const grad = avatarGradient(p.displayName)
          const isTop3 = p.rank <= 3
          const rankColors = ['text-amber-400', 'text-gray-300', 'text-orange-400']
          const rankRings  = ['ring-amber-400/50', 'ring-gray-400/40', 'ring-orange-400/40']
          const cardBg = isMe
            ? 'bg-green-500/10 border-green-500/25 ring-1 ring-green-500/30'
            : isTop3
            ? ['bg-amber-500/10 border-amber-500/20', 'bg-gray-500/5 border-gray-500/20', 'bg-orange-500/5 border-orange-500/20'][p.rank - 1]
            : 'bg-[#111118] border-[#1e1e2e] hover:border-[#2e2e3e]'

          return (
            <Link key={p.id} href={`/posiciones/${p.id}`} className="group">
              <div className={cn(
                'rounded-2xl border p-4 text-center transition-all group-hover:scale-[1.02] group-hover:shadow-lg',
                cardBg
              )}>
                {/* Rank */}
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-lg font-black',
                    isMe ? 'text-green-400' : (rankColors[p.rank - 1] ?? 'text-gray-500')
                  )}>#{p.rank}</span>
                  {p.rank === 1 && <span className="text-base">🥇</span>}
                  {p.rank === 2 && <span className="text-base">🥈</span>}
                  {p.rank === 3 && <span className="text-base">🥉</span>}
                  {isMe && p.rank > 3 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold">tú</span>
                  )}
                </div>

                {/* Avatar */}
                <div className={cn(
                  'w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center',
                  `bg-gradient-to-br ${grad}`,
                  'text-2xl font-black text-white shadow-lg',
                  isTop3 ? `ring-2 ring-offset-2 ring-offset-[#0a0a0f] ${rankRings[p.rank - 1]}` : '',
                )}>
                  {p.displayName.charAt(0).toUpperCase()}
                </div>

                {/* Name */}
                <div className={cn('text-sm font-bold truncate mb-1',
                  isMe ? 'text-green-400' : 'text-white'
                )}>
                  {p.displayName}
                </div>

                {/* Points */}
                <div className={cn('text-2xl font-black mb-2',
                  isMe ? 'text-green-400' :
                  p.rank === 1 ? 'text-amber-400' :
                  p.rank === 2 ? 'text-gray-300' :
                  p.rank === 3 ? 'text-orange-400' : 'text-white'
                )}>
                  {p.totalPoints}
                  <span className="text-xs font-medium text-gray-500 ml-0.5">pts</span>
                </div>

                {/* Mini stats */}
                <div className="flex justify-center gap-3 text-xs">
                  <span className="flex items-center gap-0.5 text-amber-400">
                    <Star className="w-2.5 h-2.5" />{p.exactHits}
                  </span>
                  <span className="flex items-center gap-0.5 text-green-400">
                    <Target className="w-2.5 h-2.5" />{p.resultHits}
                  </span>
                  <span className="text-gray-600">{p._count.predictions}⚽</span>
                </div>

                {/* Progress vs leader */}
                {topPoints > 0 && (
                  <div className="mt-3 h-1 bg-[#1a1a28] rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', isMe ? 'bg-green-500' : 'bg-[#3a3a4a]')}
                      style={{ width: `${Math.round((p.totalPoints / topPoints) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      <div className="text-center">
        <Link href="/posiciones" className="text-sm text-green-400 hover:text-green-300 transition-colors">
          Ver tabla de posiciones detallada →
        </Link>
      </div>
    </div>
  )
}
