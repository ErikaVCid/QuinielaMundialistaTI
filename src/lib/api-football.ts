const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io'

export function getApiKey(): string {
  const key = process.env.API_FOOTBALL_KEY ?? ''
  if (!key) throw new Error('API_FOOTBALL_KEY is not set in .env.local')
  return key
}

export interface ApiFootballResponse<T> {
  response: T
  errors: Record<string, string> | unknown[]
  results: number
  paging: { current: number; total: number }
}

export async function apiFootballGet<T>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const key = getApiKey()
  const url = new URL(`${BASE_URL}${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const res = await fetch(url.toString(), {
    headers: { 'x-apisports-key': key },
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`API-Football ${res.status} ${res.statusText}: ${endpoint}`)
  }

  const json: ApiFootballResponse<T> = await res.json()

  const errors = json.errors
  const hasErrors = Array.isArray(errors) ? errors.length > 0 : Object.keys(errors as object).length > 0
  if (hasErrors) {
    throw new Error(`API-Football errors: ${JSON.stringify(errors)}`)
  }

  return json.response
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AfFixture {
  fixture: {
    id: number
    date: string                                       // ISO 8601
    timezone: string
    venue: { id: number | null; name: string | null; city: string | null }
    status: { long: string; short: string; elapsed: number | null }
  }
  league: {
    id: number
    name: string
    season: number
    round: string                                      // "Group Stage - 1", "Round of 16" …
  }
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null }
    away: { id: number; name: string; logo: string; winner: boolean | null }
  }
  goals: { home: number | null; away: number | null }
  score: {
    halftime: { home: number | null; away: number | null }
    fulltime: { home: number | null; away: number | null }
    extratime: { home: number | null; away: number | null }
    penalty: { home: number | null; away: number | null }
  }
}

export interface AfTeam {
  team: { id: number; name: string; code: string | null; country: string; logo: string }
  venue: { id: number; name: string; city: string } | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const LIVE_SHORT = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const DONE_SHORT = new Set(['FT', 'AET', 'PEN'])
const POST_SHORT = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

export function afStatus(short: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' {
  if (LIVE_SHORT.has(short)) return 'LIVE'
  if (DONE_SHORT.has(short)) return 'FINISHED'
  if (POST_SHORT.has(short)) return 'POSTPONED'
  return 'SCHEDULED'
}

export function afPhase(round: string): 'GROUP' | 'ROUND_OF_16' | 'QUARTER_FINAL' | 'SEMI_FINAL' | 'THIRD_PLACE' | 'FINAL' {
  const r = round.toLowerCase()
  if (r.includes('group')) return 'GROUP'
  if (r.includes('round of 16') || r.includes('last 16')) return 'ROUND_OF_16'
  if (r.includes('quarter')) return 'QUARTER_FINAL'
  if (r.includes('semi')) return 'SEMI_FINAL'
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return 'THIRD_PLACE'
  if (r.includes('final')) return 'FINAL'
  return 'GROUP'
}

export function afScore(f: AfFixture): { home: number | undefined; away: number | undefined } {
  const ft = f.score.fulltime
  const goals = f.goals
  return {
    home: ft.home ?? goals.home ?? undefined,
    away: ft.away ?? goals.away ?? undefined,
  }
}

export function afMatchday(round: string): number | undefined {
  const m = round.match(/(\d+)$/)
  return m ? parseInt(m[1]) : undefined
}
