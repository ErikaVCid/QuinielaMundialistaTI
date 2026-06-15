import { Phase } from '@prisma/client'

export interface MatchData {
  externalId: string
  homeTeamCode: string
  awayTeamCode: string
  homeTeamLabel?: string
  awayTeamLabel?: string
  kickoffAt: Date
  stadium?: string
  city?: string
  country?: string
  homeScore?: number
  awayScore?: number
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED'
  phase: Phase
  group?: string
  matchday?: number
}

export interface TeamData {
  apiId: string
  fifaCode: string
  nameEn: string
  flagUrl: string
  group: string
}

export interface NewsItem {
  title: string
  summary: string
  url: string
  imageUrl?: string
  source: string
  publishedAt: Date
  tags: string[]
}

export interface FootballDataProvider {
  getMatches(): Promise<MatchData[]>
  getLiveScores(): Promise<MatchData[]>
  getMatchStats(externalId: string): Promise<Record<string, unknown>>
}

export interface NewsDataProvider {
  getLatestNews(query?: string): Promise<NewsItem[]>
  getNewsByTeam(teamCode: string): Promise<NewsItem[]>
}

// --- worldcup26.ir types ---

interface WC26Team {
  id: string
  name_en: string
  fifa_code: string
  flag: string
  iso2: string
  groups: string
}

interface WC26Game {
  id: string
  home_team_id: string
  away_team_id: string
  home_score: string | null
  away_score: string | null
  group: string
  matchday: string
  local_date: string
  stadium_id: string
  finished: string
  time_elapsed: string | null
  type: string
  // group stage games
  home_team_name_en?: string
  away_team_name_en?: string
  // knockout placeholders
  home_team_label?: string
  away_team_label?: string
}

interface WC26Stadium {
  id: string
  name_en: string
  city_en: string
  country_en: string
}

// --- WorldCup26 provider ---

export class WorldCup26Provider implements FootballDataProvider {
  static readonly BASE_URL = 'https://worldcup26.ir'
  private token: string

  constructor(token?: string) {
    this.token = token ?? process.env.WORLDCUP26_TOKEN ?? ''
  }

  private async req<T>(path: string): Promise<T> {
    const res = await fetch(`${WorldCup26Provider.BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`worldcup26.ir ${res.status} ${path}`)
    return res.json() as Promise<T>
  }

  // Parse "MM/DD/YYYY HH:MM" → UTC Date
  private parseDate(localDate: string): Date {
    const [datePart, timePart] = localDate.split(' ')
    const [mm, dd, yyyy] = datePart.split('/')
    const [hh, min] = timePart.split(':')
    return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min))
  }

  private mapStatus(game: WC26Game): MatchData['status'] {
    if (game.finished === 'TRUE') return 'FINISHED'
    const elapsed = game.time_elapsed
    if (!elapsed || elapsed === 'notstarted' || elapsed === 'null') return 'SCHEDULED'
    return 'LIVE'
  }

  private mapPhase(type: string): Phase {
    switch (type) {
      case 'r16':   return Phase.ROUND_OF_16
      case 'r32':   return Phase.ROUND_OF_16   // fallback if r32 exists
      case 'qf':    return Phase.QUARTER_FINAL
      case 'sf':    return Phase.SEMI_FINAL
      case 'third': return Phase.THIRD_PLACE
      case 'final': return Phase.FINAL
      default:      return Phase.GROUP
    }
  }

  async getTeams(): Promise<TeamData[]> {
    const data = await this.req<{ teams: WC26Team[] }>('/get/teams')
    return data.teams.map(t => ({
      apiId: t.id,
      fifaCode: t.fifa_code,
      nameEn: t.name_en,
      flagUrl: t.flag,
      group: t.groups,
    }))
  }

  async getStadiums(): Promise<Map<string, WC26Stadium>> {
    const data = await this.req<{ stadiums: WC26Stadium[] }>('/get/stadiums')
    return new Map(data.stadiums.map(s => [s.id, s]))
  }

  async getMatches(): Promise<MatchData[]> {
    const [teamsData, gamesData, stadiums] = await Promise.all([
      this.req<{ teams: WC26Team[] }>('/get/teams'),
      this.req<{ games: WC26Game[] }>('/get/games'),
      this.getStadiums(),
    ])

    // apiId → fifa_code
    const teamById = new Map(teamsData.teams.map(t => [t.id, t.fifa_code]))

    return gamesData.games.map(game => {
      const stadium = stadiums.get(game.stadium_id)
      const homeCode = teamById.get(game.home_team_id) ?? game.home_team_name_en?.substring(0, 3).toUpperCase() ?? 'UNK'
      const awayCode = teamById.get(game.away_team_id) ?? game.away_team_name_en?.substring(0, 3).toUpperCase() ?? 'UNK'
      const homeScore = game.home_score && game.home_score !== 'null' ? parseInt(game.home_score) : undefined
      const awayScore = game.away_score && game.away_score !== 'null' ? parseInt(game.away_score) : undefined

      return {
        externalId: `wc26-${game.id}`,
        homeTeamCode: homeCode,
        awayTeamCode: awayCode,
        homeTeamLabel: game.home_team_label,
        awayTeamLabel: game.away_team_label,
        kickoffAt: this.parseDate(game.local_date),
        stadium: stadium?.name_en,
        city: stadium?.city_en,
        country: stadium?.country_en,
        homeScore: game.home_team_id === '0' ? undefined : homeScore,
        awayScore: game.away_team_id === '0' ? undefined : awayScore,
        status: this.mapStatus(game),
        phase: this.mapPhase(game.type),
        group: game.group,
        matchday: parseInt(game.matchday),
      }
    })
  }

  async getLiveScores(): Promise<MatchData[]> {
    const matches = await this.getMatches()
    return matches.filter(m => m.status === 'LIVE')
  }

  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> {
    return {}
  }

  // Authenticate and return a fresh token
  static async authenticate(email: string, password: string): Promise<string> {
    const res = await fetch(`${WorldCup26Provider.BASE_URL}/auth/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`)
    const json = await res.json() as { token: string }
    return json.token
  }
}

// --- Mock provider (development / no token) ---

class MockFootballProvider implements FootballDataProvider {
  async getMatches(): Promise<MatchData[]> { return [] }
  async getLiveScores(): Promise<MatchData[]> { return [] }
  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> { return {} }
}

class MockNewsProvider implements NewsDataProvider {
  async getLatestNews(_query?: string): Promise<NewsItem[]> {
    return [
      {
        title: 'FIFA World Cup 2026 — Hoy arranca el torneo',
        summary: 'El Mundial FIFA 2026 da inicio hoy con 48 selecciones y 104 partidos.',
        url: 'https://fifa.com',
        source: 'FIFA',
        publishedAt: new Date(),
        tags: ['FIFA', 'Mundial 2026'],
      },
    ]
  }
  async getNewsByTeam(_teamCode: string): Promise<NewsItem[]> { return [] }
}

// --- newsapi.org provider ---

interface NewsApiArticle {
  title: string | null
  description: string | null
  url: string
  urlToImage: string | null
  source: { name: string }
  publishedAt: string
}

class NewsApiProvider implements NewsDataProvider {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.NEWS_API_KEY ?? ''
  }

  private async search(q: string): Promise<NewsItem[]> {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=es&sortBy=publishedAt&pageSize=20&apiKey=${this.apiKey}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return []
    const json = await res.json() as { articles: NewsApiArticle[] }
    return (json.articles ?? []).map(a => ({
      title: a.title ?? '',
      summary: a.description ?? '',
      url: a.url,
      imageUrl: a.urlToImage ?? undefined,
      source: a.source.name,
      publishedAt: new Date(a.publishedAt),
      tags: ['Mundial 2026'],
    }))
  }

  async getLatestNews(query = 'FIFA World Cup 2026'): Promise<NewsItem[]> {
    return this.search(query)
  }

  async getNewsByTeam(teamCode: string): Promise<NewsItem[]> {
    return this.search(`FIFA World Cup 2026 ${teamCode}`)
  }
}

// --- api-football v3 provider ---

export interface ApiFixture {
  fixture: {
    id: number
    date: string
    venue: { id: number | null; name: string | null; city: string | null }
    status: { long: string; short: string; elapsed: number | null }
  }
  league: {
    id: number
    season: number
    round: string   // "Group Stage - 1", "Round of 16", "Quarter-finals", etc.
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

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
const POSTPONED_STATUSES = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

// api-football team name → FIFA 3-letter code
const AF_NAME_TO_CODE: Record<string, string> = {
  'Mexico': 'MEX', 'South Africa': 'RSA', 'South Korea': 'KOR', 'Czech Republic': 'CZE',
  'Canada': 'CAN', 'Bosnia and Herzegovina': 'BIH', 'Qatar': 'QAT', 'Switzerland': 'SUI',
  'Haiti': 'HAI', 'Scotland': 'SCO', 'Australia': 'AUS', 'Turkey': 'TUR',
  'United States': 'USA', 'Panama': 'PAN', 'Iraq': 'IRQ', 'Norway': 'NOR',
  'Brazil': 'BRA', 'Curaçao': 'CUW', 'Ivory Coast': 'CIV', 'Ecuador': 'ECU',
  'Germany': 'GER', 'Netherlands': 'NED', 'Japan': 'JPN', 'Sweden': 'SWE',
  'Tunisia': 'TUN', 'France': 'FRA', 'Senegal': 'SEN', 'Argentina': 'ARG',
  'Algeria': 'ALG', 'Austria': 'AUT', 'Jordan': 'JOR', 'England': 'ENG',
  'Croatia': 'CRO', 'Portugal': 'POR', 'DR Congo': 'COD', 'Uruguay': 'URU',
  'Tahiti': 'TAH', 'Saudi Arabia': 'KSA', 'Morocco': 'MAR', 'Iran': 'IRN',
  'New Zealand': 'NZL', 'Chile': 'CHI', 'Peru': 'PER', 'Colombia': 'COL',
  'Belgium': 'BEL', 'Egypt': 'EGY', 'Serbia': 'SRB', 'Indonesia': 'IDN',
  'Spain': 'ESP', 'Greece': 'GRE', 'Romania': 'ROU', 'Ghana': 'GHA',
  'Uzbekistan': 'UZB', 'Hungary': 'HUN', 'Costa Rica': 'CRC', 'Cameroon': 'CMR',
  'Nigeria': 'NGA', 'Italy': 'ITA', 'Paraguay': 'PAR', 'Kenya': 'KEN',
  'Honduras': 'HON', 'Venezuela': 'VEN', 'Angola': 'ANG', 'Gambia': 'GAM',
  'Trinidad and Tobago': 'TRI', 'Azerbaijan': 'AZE', 'Bolivia': 'BOL',
}

function afTeamCode(name: string, id: number): string {
  return AF_NAME_TO_CODE[name] ?? `AF${id}`
}

function afRoundToPhase(round: string): Phase {
  const r = round.toLowerCase()
  if (r.includes('group')) return Phase.GROUP
  if (r.includes('round of 16') || r.includes('last 16')) return Phase.ROUND_OF_16
  if (r.includes('quarter')) return Phase.QUARTER_FINAL
  if (r.includes('semi')) return Phase.SEMI_FINAL
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return Phase.THIRD_PLACE
  if (r.includes('final')) return Phase.FINAL
  return Phase.GROUP
}

function afGroupFromRound(_round: string): string | undefined {
  // api-football doesn't expose the group letter in fixtures, only in standings
  return undefined
}

export class ApiFootballProvider implements FootballDataProvider {
  // Reads API_FOOTBALL_KEY (as provided by the user) OR legacy FOOTBALL_API_KEY
  static apiKey(): string {
    return process.env.API_FOOTBALL_KEY ?? process.env.FOOTBALL_API_KEY ?? ''
  }

  private async req<T>(url: string): Promise<{ response: T; errors: unknown[]; results: number }> {
    const res = await fetch(url, {
      headers: { 'x-apisports-key': ApiFootballProvider.apiKey() },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`api-football ${res.status}: ${url}`)
    return res.json() as Promise<{ response: T; errors: unknown[]; results: number }>
  }

  async getRawFixtures(league = 1, season = 2026): Promise<ApiFixture[]> {
    const data = await this.req<ApiFixture[]>(
      `https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}`
    )
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      throw new Error(`api-football errors: ${JSON.stringify(data.errors)}`)
    }
    return data.response
  }

  async getRawLiveFixtures(league = 1): Promise<ApiFixture[]> {
    const data = await this.req<ApiFixture[]>(
      `https://v3.football.api-sports.io/fixtures?live=all&league=${league}`
    )
    return data.response
  }

  private mapFixture(f: ApiFixture): MatchData {
    const short = f.fixture.status.short
    const status: MatchData['status'] = LIVE_STATUSES.has(short) ? 'LIVE'
      : FINISHED_STATUSES.has(short) ? 'FINISHED'
      : POSTPONED_STATUSES.has(short) ? 'POSTPONED'
      : 'SCHEDULED'

    // Get score: prefer fulltime, fall back to goals (covers live)
    const homeScore = f.score.fulltime.home ?? f.goals.home ?? undefined
    const awayScore = f.score.fulltime.away ?? f.goals.away ?? undefined

    // Matchday from round string: "Group Stage - 2" → 2
    const matchdayMatch = f.league.round.match(/(\d+)$/)
    const matchday = matchdayMatch ? parseInt(matchdayMatch[1]) : undefined

    return {
      externalId: `af-${f.fixture.id}`,
      homeTeamCode: afTeamCode(f.teams.home.name, f.teams.home.id),
      awayTeamCode: afTeamCode(f.teams.away.name, f.teams.away.id),
      kickoffAt: new Date(f.fixture.date),
      stadium: f.fixture.venue.name ?? undefined,
      city: f.fixture.venue.city ?? undefined,
      homeScore: homeScore ?? undefined,
      awayScore: awayScore ?? undefined,
      status,
      phase: afRoundToPhase(f.league.round),
      group: afGroupFromRound(f.league.round),
      matchday,
    }
  }

  async getMatches(): Promise<MatchData[]> {
    const fixtures = await this.getRawFixtures()
    return fixtures.map(f => this.mapFixture(f))
  }

  async getLiveScores(): Promise<MatchData[]> {
    const fixtures = await this.getRawLiveFixtures()
    return fixtures.map(f => this.mapFixture(f))
  }

  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> { return {} }
}

// --- Factory ---

export function createFootballProvider(): FootballDataProvider {
  // API_FOOTBALL_KEY takes priority (user-supplied variable name)
  if (process.env.API_FOOTBALL_KEY) {
    return new ApiFootballProvider()
  }
  const provider = process.env.FOOTBALL_API_PROVIDER ?? 'mock'
  if (provider === 'worldcup26' && process.env.WORLDCUP26_TOKEN) {
    return new WorldCup26Provider()
  }
  if (provider === 'api-football' && process.env.FOOTBALL_API_KEY) {
    return new ApiFootballProvider()
  }
  return new MockFootballProvider()
}

export function createNewsProvider(): NewsDataProvider {
  if (process.env.NEWS_API_KEY && process.env.NEWS_API_PROVIDER === 'newsapi') {
    return new NewsApiProvider()
  }
  return new MockNewsProvider()
}
