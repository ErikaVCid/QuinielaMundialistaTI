import { FormationPitch, FormationPitchSkeleton, type Player, type TeamLineup } from './formation-pitch'

interface AfLineupPlayer {
  player: { id: number; name: string; number: number; pos: string }
  statistics?: Array<{ games: { rating: string | null } }>
}

interface AfLineupTeam {
  team: { id: number; name: string; colors?: { player?: { primary?: string } } }
  formation: string
  startXI: AfLineupPlayer[]
}

interface Props {
  fixtureId: string   // api-football fixture id (e.g., "1489383")
  homeName: string
  awayName: string
  homeColor?: string
  awayColor?: string
}

// Maps api-football pos codes to our simplified ones
function mapPos(pos: string): Player['pos'] {
  if (pos === 'G') return 'G'
  if (pos === 'D') return 'D'
  if (pos === 'M') return 'M'
  return 'F'
}

async function fetchLineup(fixtureId: string): Promise<AfLineupTeam[] | null> {
  const key = process.env.API_FOOTBALL_KEY ?? ''
  if (!key) return null

  try {
    const res = await fetch(
      `https://v3.football.api-sports.io/fixtures/lineups?fixture=${fixtureId}`,
      {
        headers: { 'x-apisports-key': key },
        next: { revalidate: 120 },   // refresh every 2 min
      }
    )
    if (!res.ok) return null
    const json = await res.json() as { response: AfLineupTeam[] }
    return json.response?.length >= 2 ? json.response : null
  } catch {
    return null
  }
}

export async function LiveLineup({ fixtureId, homeName, awayName, homeColor, awayColor }: Props) {
  const lineupData = await fetchLineup(fixtureId)

  if (!lineupData) {
    return <FormationPitchSkeleton homeName={homeName} awayName={awayName} />
  }

  const [homeRaw, awayRaw] = lineupData

  function toTeamLineup(raw: AfLineupTeam): TeamLineup {
    return {
      formation: raw.formation,
      players: raw.startXI
        .filter(p => p.player?.number != null)
        .map(p => ({
          number: p.player.number,
          name: p.player.name,
          pos: mapPos(p.player.pos),
        }))
        .slice(0, 11),
    }
  }

  return (
    <FormationPitch
      home={toTeamLineup(homeRaw)}
      away={toTeamLineup(awayRaw)}
      homeColor={homeColor ?? 'bg-blue-600 border-blue-300'}
      awayColor={awayColor ?? 'bg-green-700 border-green-400'}
    />
  )
}
