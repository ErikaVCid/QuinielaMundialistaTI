import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatMatchDate, formatMatchTime } from '@/lib/utils'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { TeamFlag } from '@/components/team-flag'

export default async function AdminPronosticosPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')

  const matches = await prisma.match.findMany({
    include: {
      homeTeam: true,
      awayTeam: true,
      _count: { select: { predictions: true } },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  const totalParticipants = await prisma.participant.count()

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Revisión de Pronósticos</h1>
        <p className="text-gray-400 text-sm">{totalParticipants} participantes registrados</p>
      </div>

      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
        {matches.map((match) => {
          const pct = totalParticipants > 0 ? Math.round((match._count.predictions / totalParticipants) * 100) : 0
          return (
            <Link key={match.id} href={`/admin/pronosticos/${match.id}`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e] last:border-0 hover:bg-white/[0.02] cursor-pointer group">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="text-center min-w-16">
                    <div className="text-xs text-gray-500">{formatMatchTime(match.kickoffAt)}</div>
                    <div className="text-xs text-gray-600">{formatMatchDate(match.kickoffAt).split(' ').slice(0, 2).join(' ')}</div>
                  </div>
                  <div className="text-sm font-medium text-white">
                    <><TeamFlag team={match.homeTeam} size="xs" /> {match.homeTeam.code} vs <TeamFlag team={match.awayTeam} size="xs" /> {match.awayTeam.code}</>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{match._count.predictions}/{totalParticipants}</div>
                    <div className="text-xs text-gray-500">{pct}% completado</div>
                  </div>
                  <div className="w-16 h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-green-400 transition-colors" />
                </div>
              </div>
            </Link>
          )
        })}
        {matches.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">No hay partidos registrados</div>
        )}
      </div>
    </div>
  )
}
