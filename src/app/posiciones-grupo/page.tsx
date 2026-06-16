import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { TeamFlag } from '@/components/team-flag'
import { formatMatchTime, formatMatchDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, Star, Minus } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildGroupStandings(
  teams: { id: string; name: string; flag: string | null; badge: string | null; code: string }[],
  matches: { homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null; status: string }[]
) {
  const s = new Map(teams.map(t => [t.id, { ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 }]))

  for (const m of matches) {
    if (m.status !== 'FINISHED' || m.homeScore === null || m.awayScore === null) continue
    const h = s.get(m.homeTeamId)
    const a = s.get(m.awayTeamId)
    if (!h || !a) continue
    const hs = m.homeScore, as_ = m.awayScore
    h.played++; a.played++
    h.gf += hs; h.ga += as_; h.gd = h.gf - h.ga
    a.gf += as_; a.ga += hs; a.gd = a.gf - a.ga
    if (hs > as_) { h.won++; h.pts += 3; a.lost++ }
    else if (as_ > hs) { a.won++; a.pts += 3; h.lost++ }
    else { h.drawn++; h.pts++; a.drawn++; a.pts++ }
  }

  return [...s.values()].sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}

function predResult(pred: { homeScore: number; awayScore: number }, real: { homeScore: number; awayScore: number }) {
  if (pred.homeScore === real.homeScore && pred.awayScore === real.awayScore) return 'exact'
  const pr = Math.sign(pred.homeScore - pred.awayScore)
  const rr = Math.sign(real.homeScore - real.awayScore)
  if (pr === rr) return 'result'
  return 'miss'
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function PosicionesGrupoPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [groups, participants] = await Promise.all([
    prisma.tournamentGroup.findMany({
      include: {
        teams: { select: { id: true, name: true, flag: true, badge: true, code: true } },
        matches: {
          include: {
            homeTeam: { select: { id: true, name: true, flag: true, badge: true, code: true } },
            awayTeam: { select: { id: true, name: true, flag: true, badge: true, code: true } },
            predictions: {
              include: { participant: { select: { id: true, displayName: true, userId: true } } },
              orderBy: { points: 'desc' },
            },
          },
          orderBy: { kickoffAt: 'asc' },
        },
      },
      orderBy: { label: 'asc' },
    }),
    prisma.participant.findMany({
      select: { id: true, displayName: true, userId: true },
      orderBy: { displayName: 'asc' },
    }),
  ])

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Posiciones por Grupo</h1>
        <p className="text-gray-500 text-sm">
          Tabla del torneo + pronósticos de la quiniela — Mundial FIFA México 2026
        </p>
      </div>

      <div className="space-y-10">
        {groups.map((group) => {
          const standings  = buildGroupStandings(group.teams, group.matches)
          const finished   = group.matches.filter(m => m.status === 'FINISHED')
          // Quiniela points per participant in this group
          type ParticipantStats = { id: string; name: string; pts: number; exact: number; result: number; isMe: boolean }
          const quinielaStats = new Map<string, ParticipantStats>()
          for (const p of participants) {
            quinielaStats.set(p.id, { id: p.id, name: p.displayName, pts: 0, exact: 0, result: 0, isMe: p.userId === session.user?.id })
          }
          for (const m of finished) {
            for (const pred of m.predictions) {
              const stat = quinielaStats.get(pred.participant.id)
              if (!stat || m.homeScore === null || m.awayScore === null) continue
              const r = predResult(pred, { homeScore: m.homeScore!, awayScore: m.awayScore! })
              if (r === 'exact') { stat.pts += pred.points ?? 5; stat.exact++ }
              else if (r === 'result') { stat.pts += pred.points ?? 3; stat.result++ }
            }
          }
          const quinielaRanking = [...quinielaStats.values()]
            .filter(s => s.pts > 0 || finished.some(m => m.predictions.some(p => p.participant.id === s.id)))
            .sort((a, b) => b.pts - a.pts || b.exact - a.exact)

          return (
            <section key={group.id}>
              {/* Group title */}
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-green-600 text-white font-bold text-sm px-3 py-1 rounded-lg">
                  Grupo {group.label}
                </div>
                <div className="h-px flex-1 bg-[#1e1e2e]" />
                <span className="text-xs text-gray-600">{finished.length}/{group.matches.length} jugados</span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-5">

                {/* ── Team standings ── */}
                <div className="lg:col-span-2 bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#0d0d17] border-b border-[#1e1e2e]">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tabla del Torneo</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-600 border-b border-[#1e1e2e]">
                        <th className="text-left pl-3 pr-1 py-2">#</th>
                        <th className="text-left px-2 py-2">Selección</th>
                        <th className="text-center px-1 py-2 w-6">J</th>
                        <th className="text-center px-1 py-2 w-6">G</th>
                        <th className="text-center px-1 py-2 w-6">E</th>
                        <th className="text-center px-1 py-2 w-6">P</th>
                        <th className="text-center px-1 py-2 w-8">DG</th>
                        <th className="text-center px-1 py-2 w-8 pr-3">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((t, i) => (
                        <tr key={t.id} className={cn(
                          'border-b border-[#1e1e2e] last:border-0',
                          i < 2 && t.played > 0 ? 'bg-green-500/[0.04]' : ''
                        )}>
                          <td className="pl-3 pr-1 py-2.5">
                            <span className={cn('font-bold text-xs',
                              i === 0 ? 'text-amber-400' : i === 1 ? 'text-green-400' : i === 2 ? 'text-blue-400' : 'text-gray-600'
                            )}>{i + 1}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <TeamFlag team={t} size="xs" />
                              <span className={cn('truncate max-w-[90px]', i < 2 && t.played > 0 ? 'text-white font-medium' : 'text-gray-300')}>
                                {t.name}
                              </span>
                            </div>
                          </td>
                          <td className="text-center px-1 py-2.5 text-gray-500">{t.played}</td>
                          <td className="text-center px-1 py-2.5 text-gray-500">{t.won}</td>
                          <td className="text-center px-1 py-2.5 text-gray-500">{t.drawn}</td>
                          <td className="text-center px-1 py-2.5 text-gray-500">{t.lost}</td>
                          <td className={cn('text-center px-1 py-2.5 font-medium',
                            t.gd > 0 ? 'text-green-400' : t.gd < 0 ? 'text-red-400' : 'text-gray-600'
                          )}>
                            {t.gd > 0 ? `+${t.gd}` : t.gd}
                          </td>
                          <td className="text-center px-1 py-2.5 pr-3 font-bold text-white">{t.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── Quiniela standings for this group ── */}
                <div className="lg:col-span-3 bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#0d0d17] border-b border-[#1e1e2e]">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quiniela — Puntos del Grupo</span>
                  </div>

                  {quinielaRanking.length === 0 ? (
                    <div className="px-4 py-6 text-center text-gray-600 text-xs">
                      Aún no hay pronósticos registrados para este grupo
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1e1e2e]">
                      {quinielaRanking.map((s, i) => (
                        <div key={s.id} className={cn(
                          'flex items-center gap-3 px-4 py-3',
                          s.isMe ? 'bg-green-500/[0.05]' : ''
                        )}>
                          <span className={cn('text-sm font-bold w-5 text-center',
                            i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-400' : 'text-gray-600'
                          )}>{i + 1}</span>
                          <span className={cn('flex-1 text-sm font-medium', s.isMe ? 'text-green-400' : 'text-white')}>
                            {s.name} {s.isMe && <span className="text-xs text-green-600">(tú)</span>}
                          </span>
                          <div className="flex items-center gap-3 text-xs">
                            {s.exact > 0 && (
                              <span className="flex items-center gap-1 text-amber-400">
                                <Star className="w-3 h-3" />{s.exact}
                              </span>
                            )}
                            {s.result > 0 && (
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-3 h-3" />{s.result}
                              </span>
                            )}
                            <span className="font-bold text-white bg-[#1a1a28] px-2 py-0.5 rounded-lg">
                              {s.pts} pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Match cards with predictions ── */}
              <div className="space-y-3">
                {group.matches.map((match) => {
                  const isFinished = match.status === 'FINISHED'
                  const hasResult  = isFinished && match.homeScore !== null

                  return (
                    <div key={match.id} className={cn(
                      'bg-[#111118] rounded-xl border overflow-hidden',
                      isFinished ? 'border-[#1e1e2e]' : 'border-[#1e1e2e] opacity-70'
                    )}>
                      {/* Match header */}
                      <div className="flex items-center gap-4 px-4 py-3 border-b border-[#1e1e2e]">
                        <span className="text-xs text-gray-500">Jornada {match.matchday ?? '?'}</span>

                        {/* Teams + result */}
                        <div className="flex-1 flex items-center justify-center gap-3">
                          <div className="flex items-center gap-2">
                            <TeamFlag team={match.homeTeam} size="xs" />
                            <span className={cn('text-sm font-semibold',
                              hasResult && match.homeScore! > match.awayScore! ? 'text-white' : 'text-gray-300'
                            )}>{match.homeTeam.name}</span>
                          </div>

                          <div className="text-center min-w-[4rem]">
                            {hasResult ? (
                              <span className="text-base font-bold text-white tabular-nums font-mono">
                                {match.homeScore}–{match.awayScore}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {formatMatchTime(match.kickoffAt)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={cn('text-sm font-semibold',
                              hasResult && match.awayScore! > match.homeScore! ? 'text-white' : 'text-gray-300'
                            )}>{match.awayTeam.name}</span>
                            <TeamFlag team={match.awayTeam} size="xs" />
                          </div>
                        </div>

                        <span className="text-xs text-gray-600">
                          {isFinished ? 'Finalizado' : formatMatchDate(match.kickoffAt)}
                        </span>
                      </div>

                      {/* Predictions grid */}
                      {match.predictions.length > 0 ? (
                        <div className="flex flex-wrap gap-2 px-4 py-3">
                          {match.predictions.map((pred) => {
                            const result = hasResult
                              ? predResult(pred, { homeScore: match.homeScore!, awayScore: match.awayScore! })
                              : 'pending'
                            const isMe = pred.participant.userId === session.user?.id

                            return (
                              <div key={pred.id} className={cn(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
                                result === 'exact'   ? 'bg-amber-500/10 border-amber-500/30' :
                                result === 'result'  ? 'bg-green-500/10 border-green-500/30' :
                                result === 'miss'    ? 'bg-red-500/10 border-red-500/20' :
                                                       'bg-[#1a1a28] border-[#2e2e3e]',
                                isMe ? 'ring-1 ring-green-500/40' : ''
                              )}>
                                <span className={cn('font-medium', isMe ? 'text-green-300' : 'text-gray-300')}>
                                  {pred.participant.displayName}
                                </span>
                                <span className="font-bold tabular-nums font-mono text-white">
                                  {pred.homeScore}–{pred.awayScore}
                                </span>
                                {result === 'exact' && (
                                  <span className="flex items-center gap-0.5 text-amber-400 font-bold">
                                    <Star className="w-3 h-3" />{pred.points}p
                                  </span>
                                )}
                                {result === 'result' && (
                                  <span className="flex items-center gap-0.5 text-green-400 font-bold">
                                    <CheckCircle className="w-3 h-3" />{pred.points}p
                                  </span>
                                )}
                                {result === 'miss' && (
                                  <XCircle className="w-3 h-3 text-red-400" />
                                )}
                                {result === 'pending' && (
                                  <Minus className="w-3 h-3 text-gray-600" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="px-4 py-2.5 text-xs text-gray-700 italic">
                          {isFinished ? 'Ningún participante pronosticó este partido' : 'Sin pronósticos aún'}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap gap-4 text-xs text-gray-600 border-t border-[#1e1e2e] pt-4">
        <span className="flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-400" /> Marcador exacto</span>
        <span className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400" /> Resultado correcto</span>
        <span className="flex items-center gap-1.5"><XCircle className="w-3 h-3 text-red-400" /> Fallo</span>
        <span className="flex items-center gap-1.5"><Minus className="w-3 h-3 text-gray-600" /> Pendiente</span>
      </div>
    </div>
  )
}
