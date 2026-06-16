// Formation pitch visualization component
// Shows player positions on a stylized football pitch
// Data source: api-football /fixtures/lineups (requires API key)
// Falls back to a generic formation diagram when no data available

export interface Player {
  number: number
  name: string
  pos: 'G' | 'D' | 'M' | 'F'
}

export interface TeamLineup {
  formation: string    // e.g. "4-3-3"
  players: Player[]    // 11 players
}

// Convert formation string to row counts: "4-3-3" → [1,4,3,3]
function parseFormation(f: string): number[] {
  const rows = f.split('-').map(Number)
  return [1, ...rows]  // add GK row
}

// Distribute players into rows based on formation
function distributeRows(players: Player[], formation: string): Player[][] {
  const counts = parseFormation(formation)
  const rows: Player[][] = []
  let idx = 0
  for (const count of counts) {
    rows.push(players.slice(idx, idx + count))
    idx += count
  }
  return rows
}

interface FormationPitchProps {
  home: TeamLineup
  away: TeamLineup
  homeColor?: string
  awayColor?: string
}

function PlayerDot({ player, color }: { player: Player; color: string; inverted?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-0.5 group">
      <div className={`
        w-7 h-7 rounded-full border-2 flex items-center justify-center
        font-bold text-xs text-white shadow-lg transition-transform group-hover:scale-110
        ${color}
      `}>
        {player.number}
      </div>
      <span className="text-[9px] text-white/80 font-medium text-center max-w-[44px] leading-tight truncate drop-shadow">
        {player.name.split(' ').pop()}
      </span>
    </div>
  )
}

function FormationRow({ players, color }: { players: Player[]; color: string; inverted?: boolean }) {
  return (
    <div className="flex items-center justify-around w-full px-2">
      {players.map((p) => (
        <PlayerDot key={p.number} player={p} color={color} />
      ))}
    </div>
  )
}

export function FormationPitch({ home, away, homeColor = 'bg-blue-600 border-blue-400', awayColor = 'bg-red-600 border-red-400' }: FormationPitchProps) {
  const homeRows = distributeRows(home.players, home.formation).reverse()  // GK at bottom
  const awayRows = distributeRows(away.players, away.formation)            // GK at top

  return (
    <div className="relative w-full overflow-hidden rounded-xl" style={{ minHeight: '340px' }}>
      {/* Pitch background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(180deg, #1a4d2e 0%, #1e5c35 25%, #215f37 50%, #1e5c35 75%, #1a4d2e 100%)',
      }} />

      {/* Field lines */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 340" preserveAspectRatio="none">
        {/* Outer border */}
        <rect x="10" y="8" width="180" height="324" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" rx="2"/>
        {/* Center line */}
        <line x1="10" y1="170" x2="190" y2="170" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
        {/* Center circle */}
        <circle cx="100" cy="170" r="28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <circle cx="100" cy="170" r="2" fill="rgba(255,255,255,0.4)"/>
        {/* Top penalty area */}
        <rect x="55" y="8" width="90" height="52" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <rect x="75" y="8" width="50" height="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        {/* Bottom penalty area */}
        <rect x="55" y="280" width="90" height="52" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        <rect x="75" y="310" width="50" height="22" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        {/* Goals */}
        <rect x="82" y="4" width="36" height="6" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
        <rect x="82" y="330" width="36" height="6" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
        {/* Penalty spots */}
        <circle cx="100" cy="42" r="1.5" fill="rgba(255,255,255,0.4)"/>
        <circle cx="100" cy="298" r="1.5" fill="rgba(255,255,255,0.4)"/>
      </svg>

      {/* Player positions */}
      <div className="relative z-10 flex flex-col h-full py-2" style={{ minHeight: '340px' }}>
        {/* Away team (top half, attacks downward) */}
        <div className="flex-1 flex flex-col justify-around py-1">
          {awayRows.map((row, i) => (
            <FormationRow key={i} players={row} color={awayColor} />
          ))}
        </div>

        {/* Center divider label */}
        <div className="flex items-center justify-center py-0.5 my-0.5">
          <div className="text-[9px] text-white/40 font-medium tracking-widest uppercase">
            {home.formation} vs {away.formation}
          </div>
        </div>

        {/* Home team (bottom half, attacks upward) */}
        <div className="flex-1 flex flex-col justify-around py-1">
          {homeRows.map((row, i) => (
            <FormationRow key={i} players={row} color={homeColor} />
          ))}
        </div>
      </div>
    </div>
  )
}

// No-data placeholder
export function FormationPitchSkeleton({ homeName, awayName }: { homeName: string; awayName: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl flex flex-col items-center justify-center gap-3"
      style={{ minHeight: '260px', background: 'linear-gradient(180deg, #1a4d2e, #1e5c35, #1a4d2e)' }}>

      {/* Faint pitch lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 260" preserveAspectRatio="none">
        <rect x="10" y="8" width="180" height="244" fill="none" stroke="white" strokeWidth="1.5" rx="2"/>
        <line x1="10" y1="130" x2="190" y2="130" stroke="white" strokeWidth="1"/>
        <circle cx="100" cy="130" r="24" fill="none" stroke="white" strokeWidth="1"/>
      </svg>

      <div className="relative z-10 text-center px-6">
        <div className="text-white/40 text-2xl mb-2">⚽</div>
        <p className="text-white/70 font-semibold text-sm">{homeName} vs {awayName}</p>
        <p className="text-white/40 text-xs mt-1">Alineación confirmada al inicio del partido</p>
        <p className="text-white/30 text-xs mt-0.5">Conecta api-football para datos en tiempo real</p>
      </div>
    </div>
  )
}
