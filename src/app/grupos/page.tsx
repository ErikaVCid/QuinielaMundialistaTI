import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { TeamFlag } from '@/components/team-flag'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamStats {
  id: string
  name: string
  flag: string | null
  badge: string | null
  code: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number   // goals for
  ga: number   // goals against
  gd: number   // goal difference
  pts: number
}

// ── Standings builder ──────────────────────────────────────────────────────────

function buildStandings(
  teams: { id: string; name: string; flag: string | null; badge: string | null; code: string }[],
  matches: { homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null; status: string }[]
): TeamStats[] {
  const stats = new Map<string, TeamStats>()

  for (const t of teams) {
    stats.set(t.id, { id: t.id, name: t.name, flag: t.flag, badge: t.badge, code: t.code, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 })
  }

  for (const m of matches) {
    if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue

    const home = stats.get(m.homeTeamId)
    const away = stats.get(m.awayTeamId)
    if (!home || !away) continue

    const hs = m.homeScore
    const as_ = m.awayScore

    home.played++; away.played++
    home.gf += hs; home.ga += as_
    away.gf += as_; away.ga += hs
    home.gd = home.gf - home.ga
    away.gd = away.gf - away.ga

    if (hs > as_) {
      home.won++; home.pts += 3
      away.lost++
    } else if (hs < as_) {
      away.won++; away.pts += 3
      home.lost++
    } else {
      home.drawn++; home.pts++
      away.drawn++; away.pts++
    }
  }

  return [...stats.values()].sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name)
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function GruposPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const groups = await prisma.tournamentGroup.findMany({
    include: {
      teams: {
        select: { id: true, name: true, flag: true, badge: true, code: true },
      },
      matches: {
        select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true, status: true, kickoffAt: true },
      },
    },
    orderBy: { label: 'asc' },
  })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Tabla de Grupos</h1>
        <p className="text-gray-500 text-sm">Posiciones por grupo — Mundial FIFA México 2026</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {groups.map((group) => {
          const standings = buildStandings(group.teams, group.matches)
          const finished  = group.matches.filter(m => m.status === 'FINISHED').length
          const total     = group.matches.length

          return (
            <div key={group.id} className="bg-[#111118] rounded-2xl border border-[#1e1e2e] overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0d0d17] border-b border-[#1e1e2e]">
                <span className="text-sm font-bold text-white">Grupo {group.label}</span>
                <span className="text-xs text-gray-500">{finished}/{total} partidos</span>
              </div>

              {/* Standings table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-600 uppercase tracking-wider border-b border-[#1e1e2e]">
                      <th className="text-left pl-4 pr-2 py-2 font-medium">#</th>
                      <th className="text-left px-2 py-2 font-medium">Equipo</th>
                      <th className="text-center px-1.5 py-2 font-medium w-7" title="Jugados">J</th>
                      <th className="text-center px-1.5 py-2 font-medium w-7" title="Ganados">G</th>
                      <th className="text-center px-1.5 py-2 font-medium w-7" title="Empatados">E</th>
                      <th className="text-center px-1.5 py-2 font-medium w-7" title="Perdidos">P</th>
                      <th className="text-center px-1.5 py-2 font-medium w-10" title="Diferencia de goles">DG</th>
                      <th className="text-center px-1.5 py-2 font-medium w-9 pr-4" title="Puntos">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((team, i) => {
                      const qualifies = i < 2  // top 2 advance in WC 2026 (best 3rd also advance)
                      const isThird = i === 2

                      return (
                        <tr key={team.id} className={cn(
                          'border-b border-[#1e1e2e] last:border-0 transition-colors hover:bg-white/[0.02]',
                          qualifies && team.played > 0 ? 'bg-green-500/[0.04]' : '',
                        )}>
                          <td className="pl-4 pr-2 py-2.5">
                            <span className={cn(
                              'font-bold',
                              i === 0 ? 'text-amber-400' :
                              i === 1 ? 'text-green-400' :
                              isThird ? 'text-blue-400' :
                              'text-gray-600'
                            )}>
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <Link href={`/partidos?grupo=${group.label}`} className="flex items-center gap-2 hover:text-green-400 transition-colors">
                              <TeamFlag team={team} size="xs" />
                              <span className={cn(
                                'font-medium truncate max-w-[100px]',
                                qualifies && team.played > 0 ? 'text-white' : 'text-gray-300'
                              )}>
                                {team.name}
                              </span>
                            </Link>
                          </td>
                          <td className="text-center px-1.5 py-2.5 text-gray-400">{team.played}</td>
                          <td className="text-center px-1.5 py-2.5 text-gray-400">{team.won}</td>
                          <td className="text-center px-1.5 py-2.5 text-gray-400">{team.drawn}</td>
                          <td className="text-center px-1.5 py-2.5 text-gray-400">{team.lost}</td>
                          <td className={cn(
                            'text-center px-1.5 py-2.5 font-medium',
                            team.gd > 0 ? 'text-green-400' : team.gd < 0 ? 'text-red-400' : 'text-gray-500'
                          )}>
                            {team.gd > 0 ? `+${team.gd}` : team.gd}
                          </td>
                          <td className="text-center px-1.5 py-2.5 pr-4">
                            <span className={cn(
                              'font-bold',
                              i === 0 && team.played > 0 ? 'text-amber-400' :
                              i === 1 && team.played > 0 ? 'text-green-400' :
                              'text-white'
                            )}>
                              {team.pts}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Group matches summary */}
              <div className="px-4 py-2 border-t border-[#1e1e2e] flex gap-3">
                <Link href={`/partidos?grupo=${group.label}`}
                  className="text-xs text-green-400 hover:text-green-300 transition-colors">
                  Ver partidos del grupo →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span> 1° — Clasifica directo</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400"></span> 2° — Clasifica directo</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"></span> 3° — Posible clasificación</span>
        <span className="ml-2">J=Jugados · G=Ganados · E=Empatados · P=Perdidos · DG=Diferencia de goles · Pts=Puntos</span>
      </div>
    </div>
  )
}
