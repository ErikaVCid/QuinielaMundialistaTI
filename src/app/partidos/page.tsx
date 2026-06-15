import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { formatMatchTime, phaseLabel } from '@/lib/utils'
import { Zap, Target } from 'lucide-react'
import { Phase, MatchStatus } from '@prisma/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

function TeamFlag({ flag, name }: { flag: string | null; name: string }) {
  if (!flag) return <span className="w-8 h-6 rounded bg-[#2e2e3e] flex-shrink-0" />
  if (flag.startsWith('http')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={flag}
        alt={name}
        width={32}
        height={22}
        className="w-8 h-auto rounded-sm object-cover flex-shrink-0"
      />
    )
  }
  return <span className="text-xl leading-none flex-shrink-0">{flag}</span>
}

function groupByDate(matches: Parameters<typeof MatchCard>[0]['match'][]) {
  return matches.reduce((acc, match) => {
    const key = format(new Date(match.kickoffAt), 'yyyy-MM-dd')
    if (!acc[key]) acc[key] = []
    acc[key].push(match)
    return acc
  }, {} as Record<string, typeof matches>)
}

type MatchWithTeams = {
  id: string
  kickoffAt: Date
  status: string
  homeScore: number | null
  awayScore: number | null
  matchday: number | null
  phase: string
  stadium: string | null
  city: string | null
  homeTeam: { name: string; code: string; flag: string | null }
  awayTeam: { name: string; code: string; flag: string | null }
  group: { label: string } | null
}

function MatchCard({ match }: { match: MatchWithTeams }) {
  const isLive = match.status === 'LIVE'
  const isFinished = match.status === 'FINISHED'
  const hasScore = isLive || isFinished

  const homeWins = hasScore && match.homeScore !== null && match.awayScore !== null && match.homeScore > match.awayScore
  const awayWins = hasScore && match.homeScore !== null && match.awayScore !== null && match.awayScore > match.homeScore

  const groupLabel = match.group ? `Grupo ${match.group.label}` : phaseLabel(match.phase)
  const matchdayLabel = match.matchday ? ` · Jornada ${match.matchday}` : ''

  const shortDate = format(new Date(match.kickoffAt), "EEE, d MMM", { locale: es })
  const time = formatMatchTime(match.kickoffAt)

  return (
    <Link href={`/partidos/${match.id}`} className="block group">
      <div className={`
        bg-[#111118] rounded-xl border transition-all duration-150
        group-hover:border-green-500/30 group-hover:bg-[#131320]
        ${isLive ? 'border-red-500/40' : 'border-[#1e1e2e]'}
      `}>
        {/* Group / phase label */}
        <div className="px-4 pt-3 pb-2 text-xs text-gray-500 font-medium border-b border-[#1e1e2e]">
          {groupLabel}{matchdayLabel}
        </div>

        <div className="flex">
          {/* Teams column */}
          <div className="flex-1 px-4 py-3 space-y-2.5">
            {/* Home team */}
            <div className="flex items-center gap-2.5">
              <TeamFlag flag={match.homeTeam.flag} name={match.homeTeam.name} />
              <span className={`flex-1 text-sm ${homeWins ? 'text-white font-semibold' : 'text-gray-300'}`}>
                {match.homeTeam.name}
              </span>
              {hasScore && (
                <span className={`text-base font-bold tabular-nums w-5 text-right ${homeWins ? 'text-white' : 'text-gray-400'}`}>
                  {match.homeScore}
                </span>
              )}
              {homeWins && <span className="text-green-400 text-xs">◀</span>}
            </div>

            {/* Away team */}
            <div className="flex items-center gap-2.5">
              <TeamFlag flag={match.awayTeam.flag} name={match.awayTeam.name} />
              <span className={`flex-1 text-sm ${awayWins ? 'text-white font-semibold' : 'text-gray-300'}`}>
                {match.awayTeam.name}
              </span>
              {hasScore && (
                <span className={`text-base font-bold tabular-nums w-5 text-right ${awayWins ? 'text-white' : 'text-gray-400'}`}>
                  {match.awayScore}
                </span>
              )}
              {awayWins && <span className="text-green-400 text-xs">◀</span>}
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-[#1e1e2e] self-stretch" />

          {/* Time / status column */}
          <div className="w-24 flex flex-col items-center justify-center px-3 py-3 gap-1 flex-shrink-0">
            {isLive ? (
              <>
                <span className="flex items-center gap-1 text-red-400 text-xs font-bold">
                  <Zap className="w-3 h-3" /> EN VIVO
                </span>
              </>
            ) : isFinished ? (
              <>
                <span className="text-gray-400 text-xs font-medium">Fin</span>
                <span className="text-gray-500 text-xs">{shortDate}</span>
              </>
            ) : (
              <>
                <span className="text-white text-sm font-bold">{time}</span>
                <span className="text-gray-500 text-xs">{shortDate}</span>
                <span className="flex items-center gap-1 text-green-400 text-xs font-medium mt-1">
                  <Target className="w-3 h-3" /> Pronóstico
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stadium footer */}
        {(match.stadium || match.city) && (
          <div className="px-4 py-2 border-t border-[#1e1e2e] text-xs text-gray-600 truncate">
            {[match.stadium, match.city].filter(Boolean).join(', ')}
          </div>
        )}
      </div>
    </Link>
  )
}

export default async function PartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; grupo?: string; estado?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const params = await searchParams
  const { fase, grupo, estado } = params

  const matches = await prisma.match.findMany({
    where: {
      ...(fase && Object.values(Phase).includes(fase as Phase) ? { phase: fase as Phase } : {}),
      ...(grupo ? { group: { label: grupo } } : {}),
      ...(estado && Object.values(MatchStatus).includes(estado as MatchStatus) ? { status: estado as MatchStatus } : {}),
    },
    include: { homeTeam: true, awayTeam: true, group: true },
    orderBy: { kickoffAt: 'asc' },
  })

  const groups = await prisma.tournamentGroup.findMany({ orderBy: { label: 'asc' } })
  const grouped = groupByDate(matches)

  const filterBtn = (href: string, active: boolean, label: string, icon?: React.ReactNode) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 whitespace-nowrap
        ${active
          ? href.includes('LIVE') ? 'bg-red-600 text-white'
            : href.includes('FINISHED') ? 'bg-gray-600 text-white'
            : 'bg-green-600 text-white'
          : 'bg-[#111118] border border-[#1e1e2e] text-gray-400 hover:text-white hover:border-gray-600'}`}
    >
      {icon}{label}
    </Link>
  )

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white mb-1">Calendario de Partidos</h1>
        <p className="text-gray-500 text-sm">Mundial FIFA 2026 — Del 11 de junio a la Final</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterBtn('/partidos', !fase && !grupo && !estado, 'Todos')}
        {filterBtn('/partidos?estado=LIVE', estado === 'LIVE', 'En Vivo', <Zap className="w-3 h-3" />)}
        {filterBtn('/partidos?estado=SCHEDULED', estado === 'SCHEDULED', 'Programados')}
        {filterBtn('/partidos?estado=FINISHED', estado === 'FINISHED', 'Finalizados')}
        {groups.map((g) =>
          filterBtn(`/partidos?grupo=${g.label}`, grupo === g.label, `Grupo ${g.label}`)
        )}
      </div>

      {/* Matches grouped by date */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([dateKey, dateMatches]) => {
          const dateLabel = format(new Date(dateKey), "d 'de' MMMM, yyyy", { locale: es }).toUpperCase()
          // Determine phase label for the section
          const firstMatch = dateMatches[0]
          const sectionPhase = firstMatch.group
            ? 'Fase de grupos'
            : phaseLabel(firstMatch.phase)

          return (
            <div key={dateKey}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-medium text-gray-500 bg-[#0d0d14] px-3 py-1 rounded-full border border-[#1e1e2e]">
                  {sectionPhase} · {dateLabel}
                </span>
                <div className="h-px flex-1 bg-[#1e1e2e]" />
              </div>

              {/* 2-column grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {dateMatches.map((match) => (
                  <MatchCard key={match.id} match={match} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-16 text-gray-500 text-sm">
          No se encontraron partidos con los filtros seleccionados.
        </div>
      )}
    </div>
  )
}
