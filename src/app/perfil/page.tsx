import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchTime } from '@/lib/utils'
import { Trophy, Target, TrendingUp, Calendar, Star, ChevronRight } from 'lucide-react'
import { EditProfileForm } from '@/components/edit-profile-form'
import { TeamFlag } from '@/components/team-flag'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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
      },
    },
  })
  if (!participant) redirect('/login')

  const total = participant.predictions.length
  const finished = participant.predictions.filter(p => p.match.status === 'FINISHED')
  const pending  = participant.predictions.filter(p => p.match.status === 'SCHEDULED')
  const exactPct   = finished.length > 0 ? Math.round((participant.exactHits  / finished.length) * 100) : 0
  const resultPct  = finished.length > 0 ? Math.round((participant.resultHits / finished.length) * 100) : 0
  const bestGame   = finished.reduce((max, p) => (p.points ?? 0) > (max?.points ?? 0) ? p : max, finished[0])

  // Membership date
  const memberSince = format(new Date(participant.createdAt), "MMMM yyyy", { locale: es })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl space-y-6">

      {/* ── Profile header ─────────────────────────────────────────────── */}
      <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/30 to-blue-500/30 border border-[#2e2e3e] flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
            {participant.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <EditProfileForm participantId={participant.id} currentDisplayName={participant.displayName} />
            <p className="text-gray-500 text-sm mt-0.5">{participant.user.email}</p>
            <p className="text-gray-600 text-xs mt-1">
              Posición #{participant.position ?? '—'} en el ranking · Miembro desde {memberSince}
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Trophy,    label: 'Puntos totales',  value: participant.totalPoints, color: 'text-green-400',  sub: `Posición #${participant.position ?? '—'}` },
          { icon: Star,      label: 'Marcadores exactos', value: `${participant.exactHits} (${exactPct}%)`,   color: 'text-amber-400',  sub: `de ${finished.length} terminados` },
          { icon: TrendingUp,label: 'Resultados correctos', value: `${participant.resultHits} (${resultPct}%)`, color: 'text-blue-400', sub: 'resultado acertado' },
          { icon: Calendar,  label: 'Pronósticos',     value: total, color: 'text-purple-400', sub: `${pending.length} pendientes` },
        ].map(({ icon: Icon, label, value, color, sub }) => (
          <div key={label} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4 text-center">
            <Icon className={`w-4 h-4 ${color} mx-auto mb-2`} />
            <div className={`text-xl font-bold ${color} leading-tight`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5 font-medium">{label}</div>
            <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Best prediction highlight ──────────────────────────────────── */}
      {bestGame && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-4 flex items-center gap-4">
          <Star className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-0.5">Mejor pronóstico</p>
            <div className="flex items-center gap-2">
              <TeamFlag team={bestGame.match.homeTeam} size="xs" />
              <span className="text-sm text-white font-medium">{bestGame.match.homeTeam.name}</span>
              <span className="text-xs text-gray-500 font-mono">{bestGame.homeScore}–{bestGame.awayScore}</span>
              <span className="text-sm text-white font-medium">{bestGame.match.awayTeam.name}</span>
              <TeamFlag team={bestGame.match.awayTeam} size="xs" />
            </div>
          </div>
          <span className="text-xl font-bold text-amber-400 flex-shrink-0">{bestGame.points} pts</span>
        </div>
      )}

      {/* ── Finished predictions ───────────────────────────────────────── */}
      {finished.length > 0 && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
            <h2 className="text-white font-semibold">Resultados</h2>
            <span className="text-xs text-gray-500">{finished.length} partidos</span>
          </div>
          <div className="divide-y divide-[#1e1e2e]">
            {finished.map((pred) => {
              const m = pred.match
              return (
                <Link key={pred.id} href={`/partidos/${m.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                  {/* Teams */}
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
                  {/* Real result */}
                  <div className="text-center flex-shrink-0">
                    <div className="text-xs text-gray-600">Real</div>
                    <div className="text-xs font-bold text-gray-400 tabular-nums">{m.homeScore}–{m.awayScore}</div>
                  </div>
                  {/* Points badge */}
                  <div className={cn(
                    'text-sm font-bold w-14 text-right flex-shrink-0',
                    pred.points === 5 ? 'text-amber-400' :
                    pred.points === 3 ? 'text-green-400' :
                    pred.points === 1 ? 'text-blue-400' : 'text-gray-600'
                  )}>
                    {pred.points !== null ? `${pred.points} pts` : '—'}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 flex-shrink-0" />
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Pending predictions ────────────────────────────────────────── */}
      {pending.length > 0 && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
            <h2 className="text-white font-semibold">Pronósticos pendientes</h2>
            <span className="text-xs text-gray-500">{pending.length} partidos</span>
          </div>
          <div className="divide-y divide-[#1e1e2e]">
            {pending.slice(0, 8).map((pred) => {
              const m = pred.match
              const d = format(new Date(m.kickoffAt), "EEE d MMM", { locale: es })
              return (
                <Link key={pred.id} href={`/partidos/${m.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                  <div className="w-16 text-center flex-shrink-0">
                    <div className="text-xs font-semibold text-gray-300">{formatMatchTime(m.kickoffAt)}</div>
                    <div className="text-xs text-gray-600">{d}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <TeamFlag team={m.homeTeam} size="xs" />
                    <span className="text-sm text-white truncate">{m.homeTeam.name}</span>
                    <span className="text-xs font-bold tabular-nums font-mono bg-green-500/15 text-green-400 px-2 py-0.5 rounded">
                      {pred.homeScore}–{pred.awayScore}
                    </span>
                    <span className="text-sm text-white truncate">{m.awayTeam.name}</span>
                    <TeamFlag team={m.awayTeam} size="xs" />
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-500 flex-shrink-0" />
                </Link>
              )
            })}
            {pending.length > 8 && (
              <div className="px-5 py-3 text-xs text-gray-500 text-center">
                +{pending.length - 8} pronósticos más
              </div>
            )}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="text-center py-12">
          <Target className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aún no has registrado ningún pronóstico.</p>
          <Link href="/pronosticos" className="mt-2 inline-block text-green-400 text-sm hover:text-green-300">
            Ir a pronósticos →
          </Link>
        </div>
      )}
    </div>
  )
}
