// TheSportsDB v1 — free, no API key registration required
// Docs: https://www.thesportsdb.com/api.php
// FIFA World Cup league ID: 4429

const BASE = 'https://www.thesportsdb.com/api/v1/json/3'
const WC_LEAGUE_ID = '4429'
const WC_SEASON = '2026'

export interface TsdbTeam {
  idTeam: string
  strTeam: string
  strTeamShort: string | null
  strBadge: string | null       // HD team crest/logo
  strDescriptionEN: string | null
  idAPIfootball: string | null  // cross-ref with api-football
}

export interface TsdbEvent {
  idEvent: string
  strEvent: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intAwayScore: string | null
  dateEvent: string             // YYYY-MM-DD
  strTime: string               // HH:MM:SS UTC
  strStatus: string             // FT | NS | etc.
  strGroup: string | null       // A, B, C ...
  strVenue: string | null
  strCity: string | null
  intSpectators: string | null
  strResult: string | null      // narrative description
  strVideo: string | null       // YouTube highlights URL
  strPoster: string | null
  strFanart: string | null
  strHomeTeamBadge: string | null
  strAwayTeamBadge: string | null
  idHomeTeam: string
  idAwayTeam: string
  idAPIfootball: string | null
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`TheSportsDB ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export async function searchTeam(name: string): Promise<TsdbTeam | null> {
  const data = await get<{ teams: TsdbTeam[] | null }>(`/searchteams.php?t=${encodeURIComponent(name)}`)
  return data.teams?.[0] ?? null
}

export async function getSeasonEvents(): Promise<TsdbEvent[]> {
  const data = await get<{ events: TsdbEvent[] | null }>(
    `/eventsseason.php?id=${WC_LEAGUE_ID}&s=${WC_SEASON}`
  )
  return data.events ?? []
}

export async function getPastEvents(): Promise<TsdbEvent[]> {
  const data = await get<{ events: TsdbEvent[] | null }>(
    `/eventspastleague.php?id=${WC_LEAGUE_ID}`
  )
  return data.events ?? []
}

export async function getNextEvents(): Promise<TsdbEvent[]> {
  const data = await get<{ events: TsdbEvent[] | null }>(
    `/eventsnextleague.php?id=${WC_LEAGUE_ID}`
  )
  return data.events ?? []
}

export async function getEventById(id: string): Promise<TsdbEvent | null> {
  const data = await get<{ events: TsdbEvent[] | null }>(`/lookupevent.php?id=${id}`)
  return data.events?.[0] ?? null
}

// Merge past + season events, deduplicated by idEvent
export async function getAllAvailableEvents(): Promise<TsdbEvent[]> {
  const [season, past, next] = await Promise.all([
    getSeasonEvents().catch(() => []),
    getPastEvents().catch(() => []),
    getNextEvents().catch(() => []),
  ])
  const seen = new Set<string>()
  const all: TsdbEvent[] = []
  for (const e of [...season, ...past, ...next]) {
    if (!seen.has(e.idEvent)) { seen.add(e.idEvent); all.push(e) }
  }
  return all
}
