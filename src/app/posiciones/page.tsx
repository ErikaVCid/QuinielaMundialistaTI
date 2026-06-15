import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react'

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

  // Assign positions (handling ties)
  type Ranked = typeof participants[0] & { rank: number }
  const ranked = participants.reduce<Ranked[]>((acc, p, i) => {
    const prev = acc[i - 1]
    const rank = (prev && p.totalPoints === prev.totalPoints && p.exactHits === prev.exactHits)
      ? prev.rank
      : i + 1
    acc.push({ ...p, rank })
    return acc
  }, [])

  const myParticipant = ranked.find((p) => p.userId === session.user?.id)

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Tabla de Posiciones</h1>
        <p className="text-gray-400 text-sm">Ranking general — Mundial FIFA 2026</p>
      </div>

      {/* My position banner */}
      {myParticipant && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-green-400 font-medium mb-0.5">Tu posición</div>
            <div className="text-white font-bold">#{myParticipant.rank} — {myParticipant.displayName}</div>
          </div>
          <div className="flex gap-6 text-center">
            <div>
              <div className="text-xl font-bold text-green-400">{myParticipant.totalPoints}</div>
              <div className="text-xs text-gray-500">pts</div>
            </div>
            <div>
              <div className="text-xl font-bold text-amber-400">{myParticipant.exactHits}</div>
              <div className="text-xs text-gray-500">exactos</div>
            </div>
          </div>
        </div>
      )}

      {/* Top 3 podium */}
      {ranked.length >= 3 && (
        <div className="flex items-end justify-center gap-3 mb-6">
          {/* Silver - #2 */}
          <div className="flex-1 max-w-48 rounded-xl border border-gray-500/30 bg-gray-500/5 p-4 text-center" style={{ minHeight: '96px' }}>
            <Medal className="w-4 h-4 text-gray-300 mx-auto mb-1" />
            <div className="text-xs font-bold text-gray-300 truncate">{ranked[1]?.displayName}</div>
            <div className="text-base font-bold text-gray-300">{ranked[1]?.totalPoints} pts</div>
            <div className="text-xs text-gray-500">#2</div>
          </div>
          {/* Gold - #1 */}
          <div className="flex-1 max-w-48 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center" style={{ minHeight: '128px' }}>
            <Medal className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-sm font-bold text-amber-400 truncate">{ranked[0]?.displayName}</div>
            <div className="text-xl font-bold text-amber-400">{ranked[0]?.totalPoints} pts</div>
            <div className="text-xs text-amber-600">#1</div>
          </div>
          {/* Bronze - #3 */}
          <div className="flex-1 max-w-48 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 text-center" style={{ minHeight: '80px' }}>
            <Medal className="w-4 h-4 text-orange-400 mx-auto mb-1" />
            <div className="text-xs font-bold text-orange-400 truncate">{ranked[2]?.displayName}</div>
            <div className="text-base font-bold text-orange-400">{ranked[2]?.totalPoints} pts</div>
            <div className="text-xs text-orange-600">#3</div>
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-[#1e1e2e]">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Participante</div>
          <div className="col-span-2 text-center">Puntos</div>
          <div className="col-span-2 text-center">Exactos</div>
          <div className="col-span-2 text-center">Resultados</div>
          <div className="col-span-1 text-center">Mov</div>
        </div>

        {ranked.map((p) => {
          const change = getPositionChange(p.rank, p.positionPrev)
          const isMe = p.userId === session.user?.id
          return (
            <div
              key={p.id}
              className={cn(
                'grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-[#1e1e2e] last:border-0 transition-colors',
                isMe ? 'bg-green-500/5' : 'hover:bg-white/[0.02]',
                p.rank === 1 ? 'border-l-2 border-l-amber-500' : '',
              )}
            >
              <div className="col-span-1 flex items-center">
                <span className={cn(
                  'font-bold text-base',
                  p.rank === 1 ? 'text-amber-400' :
                  p.rank === 2 ? 'text-gray-300' :
                  p.rank === 3 ? 'text-orange-400' :
                  'text-gray-400'
                )}>
                  {p.rank}
                </span>
              </div>
              <div className="col-span-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-[#2e2e3e] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {p.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className={cn('font-medium truncate', isMe ? 'text-green-400' : 'text-white')}>
                    {p.displayName} {isMe && <span className="text-xs text-green-500">(tú)</span>}
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex items-center justify-center">
                <span className="font-bold text-green-400 text-base">{p.totalPoints}</span>
              </div>
              <div className="col-span-2 flex items-center justify-center">
                <span className="font-medium text-amber-400">{p.exactHits}</span>
              </div>
              <div className="col-span-2 flex items-center justify-center">
                <span className="text-blue-400">{p.resultHits}</span>
              </div>
              <div className="col-span-1 flex items-center justify-center">
                {change > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-400" />
                ) : change < 0 ? (
                  <TrendingDown className="w-4 h-4 text-red-400" />
                ) : (
                  <Minus className="w-4 h-4 text-gray-600" />
                )}
              </div>
            </div>
          )
        })}

        {ranked.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aún no hay participantes registrados.
          </div>
        )}
      </div>
    </div>
  )
}

function getPositionChange(current: number, prev: number | null): number {
  if (!prev) return 0
  return prev - current
}
