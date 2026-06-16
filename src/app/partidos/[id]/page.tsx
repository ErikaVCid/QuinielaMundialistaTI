import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatMatchDate, formatMatchTime, phaseLabel, isMatchLocked } from '@/lib/utils'
import { PredictionForm } from '@/components/prediction-form'
import { MapPin, Clock, Trophy, Users, Play, Users2 } from 'lucide-react'

function youtubeSearchUrl(homeTeam: string, awayTeam: string) {
  const q = encodeURIComponent(`${homeTeam} vs ${awayTeam} FIFA World Cup 2026 en vivo`)
  return `https://www.youtube.com/results?search_query=${q}`
}

function YoutubeIcon() {
  return (
    <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

// Shows badge (HD crest) when available, falls back to flag (national flag)
function TeamImage({ team, size = 'lg' }: {
  team: { name: string; flag: string | null; badge: string | null }
  size?: 'lg' | 'sm'
}) {
  const src = team.badge ?? team.flag
  const cls = size === 'lg' ? 'w-20 h-auto' : 'w-10 h-auto'
  if (!src) return <div className={`${size === 'lg' ? 'w-20 h-20' : 'w-10 h-10'} rounded-full bg-[#2e2e3e]`} />
  if (src.startsWith('http')) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={team.name} className={`${cls} object-contain mx-auto drop-shadow-lg`} />
  }
  return <span className={size === 'lg' ? 'text-6xl' : 'text-3xl'}>{src}</span>
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const { id } = await params
  const match = await prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true, group: true },
  })
  if (!match) notFound()

  const participant = await prisma.participant.findUnique({
    where: { userId: session.user.id },
  })

  const existingPrediction = participant
    ? await prisma.prediction.findUnique({
        where: { participantId_matchId: { participantId: participant.id, matchId: match.id } },
      })
    : null

  const locked = isMatchLocked(match.kickoffAt)

  const allPredictions = match.status === 'FINISHED'
    ? await prisma.prediction.findMany({
        where: { matchId: match.id },
        include: { participant: true },
        orderBy: { points: 'desc' },
      })
    : []

  const isLive     = match.status === 'LIVE'
  const isFinished = match.status === 'FINISHED'

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl space-y-5">

      {/* ── Match header ──────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden ${isLive ? 'border-red-500/30' : 'border-[#1e1e2e]'}`}>

        {/* Poster image (if available) */}
        {match.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.posterUrl} alt="Match poster" className="w-full h-40 object-cover opacity-60" />
        )}

        <div className={`p-6 md:p-8 ${isLive ? 'bg-gradient-to-r from-red-950/40 to-[#111118]' : 'bg-[#111118]'}`}>
          {/* Phase label */}
          <div className="text-center mb-4">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
              {match.group ? `Grupo ${match.group.label} · ` : ''}{phaseLabel(match.phase)}
            </span>
          </div>

          {/* Teams + Score */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center">
              <div className="mb-3 flex justify-center h-20 items-center">
                <TeamImage team={match.homeTeam} size="lg" />
              </div>
              <div className="text-lg font-bold text-white">{match.homeTeam.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{match.homeTeam.code}</div>
            </div>

            <div className="text-center px-4 min-w-32">
              {isFinished || isLive ? (
                <>
                  <div className="text-5xl font-bold text-white tabular-nums font-mono">
                    {match.homeScore ?? 0}
                    <span className="text-gray-600 mx-1">–</span>
                    {match.awayScore ?? 0}
                  </div>
                  <div className={`text-xs font-bold mt-2 ${isLive ? 'text-red-400' : 'text-green-400'}`}>
                    {isLive ? '⚡ EN VIVO' : '✓ FINALIZADO'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-gray-600">VS</div>
                  <div className="text-xl font-bold text-green-400 mt-1">
                    {formatMatchTime(match.kickoffAt)}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">{formatMatchDate(match.kickoffAt)}</div>
                </>
              )}
            </div>

            <div className="flex-1 text-center">
              <div className="mb-3 flex justify-center h-20 items-center">
                <TeamImage team={match.awayTeam} size="lg" />
              </div>
              <div className="text-lg font-bold text-white">{match.awayTeam.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{match.awayTeam.code}</div>
            </div>
          </div>

          {/* Match meta */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-5 pt-4 border-t border-[#1e1e2e] text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatMatchDate(match.kickoffAt)}, {formatMatchTime(match.kickoffAt)}
            </span>
            {match.stadium && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{match.stadium}
              </span>
            )}
            {match.city && <span>{match.city}</span>}
            {match.attendees && (
              <span className="flex items-center gap-1">
                <Users2 className="w-3 h-3" />
                {match.attendees.toLocaleString('es-MX')} asistentes
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Ver en vivo (LIVE matches) ────────────────────────────────── */}
      {isLive && (
        <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 font-bold text-sm">PARTIDO EN VIVO — Ver ahora</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Main CTA */}
            <a
              href={youtubeSearchUrl(match.homeTeam.name, match.awayTeam.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-all shadow-lg shadow-red-600/30"
            >
              <YoutubeIcon />
              Ver ahora en YouTube
            </a>
            {/* Broadcast channels */}
            {[
              { name: 'TUDN',       url: 'https://www.youtube.com/@tudnusa/streams' },
              { name: 'Telemundo',  url: 'https://www.youtube.com/@TelemundoDeportes/streams' },
              { name: 'FIFA TV',    url: 'https://www.youtube.com/@fifatv/streams' },
              { name: 'Fox Sports', url: 'https://www.youtube.com/results?search_query=Fox+Sports+FIFA+World+Cup+2026+live' },
            ].map(ch => (
              <a key={ch.name} href={ch.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1a1a28] hover:bg-[#2a2a38] border border-[#2e2e3e] hover:border-red-500/30 text-gray-300 hover:text-white text-sm font-medium transition-all">
                {ch.name}
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3">
            Los links abren la búsqueda en YouTube — selecciona el canal oficial disponible en tu región.
          </p>
        </div>
      )}

      {/* ── Highlights ────────────────────────────────────────────────── */}
      {match.highlightUrl && (
        <a
          href={match.highlightUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-red-950/30 border border-red-500/20 rounded-xl px-5 py-4 hover:bg-red-950/50 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500 transition-all">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">Ver highlights en YouTube</div>
            <div className="text-red-400 text-xs mt-0.5">
              {match.homeTeam.name} {match.homeScore}–{match.awayScore} {match.awayTeam.name}
            </div>
          </div>
          <div className="ml-auto text-red-400 text-xs font-medium">▶ Reproducir</div>
        </a>
      )}

      {/* ── Match description ─────────────────────────────────────────── */}
      {match.matchDescription && (
        <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] px-5 py-4">
          <p className="text-gray-400 text-sm leading-relaxed line-clamp-4">{match.matchDescription}</p>
        </div>
      )}

      {/* ── Prediction ────────────────────────────────────────────────── */}
      {participant && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-green-400" />
            Tu Pronóstico
          </h2>
          {locked && match.status === 'SCHEDULED' ? (
            <div className="text-center py-4 text-yellow-400 text-sm">
              🔒 Este partido ya comenzó. No se pueden editar pronósticos.
            </div>
          ) : (
            <PredictionForm
              matchId={match.id}
              participantId={participant.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              existingPrediction={existingPrediction
                ? { homeScore: existingPrediction.homeScore, awayScore: existingPrediction.awayScore, isLocked: existingPrediction.isLocked }
                : null}
              isLocked={locked || match.status !== 'SCHEDULED'}
            />
          )}
        </div>
      )}

      {/* ── All predictions (finished) ────────────────────────────────── */}
      {allPredictions.length > 0 && (
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-6">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-green-400" />
            Pronósticos de todos
          </h2>
          <div className="space-y-2">
            {allPredictions.map((pred) => (
              <div key={pred.id} className="flex items-center justify-between py-2 border-b border-[#1e1e2e] last:border-0">
                <span className="text-sm text-gray-300">{pred.participant.displayName}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono text-white font-bold">
                    {pred.homeScore}–{pred.awayScore}
                  </span>
                  <span className={`text-sm font-bold ${
                    pred.points === 5 ? 'text-amber-400' :
                    pred.points === 3 ? 'text-green-400' :
                    pred.points === 1 ? 'text-blue-400' : 'text-gray-500'
                  }`}>
                    {pred.points ?? 0} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
