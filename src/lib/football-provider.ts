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

interface ApiFixtureResponse {
  fixture: {
    id: number
    date: string
    venue: { name: string | null; city: string | null }
    status: { short: string }
  }
  league: { round: string }
  teams: { home: { name: string }; away: { name: string } }
  goals: { home: number | null; away: number | null }
}

const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
const POSTPONED_STATUSES = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

class ApiFootballProvider implements FootballDataProvider {
  private apiKey: string
  private leagueId: string
  private season: string

  constructor() {
    this.apiKey = process.env.FOOTBALL_API_KEY ?? ''
    this.leagueId = process.env.FOOTBALL_API_LEAGUE_ID ?? '1'
    this.season = process.env.FOOTBALL_API_SEASON ?? '2026'
  }

  private async fetch<T>(path: string): Promise<T> {
    const res = await fetch(`https://v3.football.api-sports.io${path}`, {
      headers: { 'x-apisports-key': this.apiKey },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`api-football ${res.status} ${path}`)
    const json = await res.json() as { response: T }
    return json.response
  }

  private mapFixture(f: ApiFixtureResponse): MatchData {
    const short = f.fixture.status.short
    const status: MatchData['status'] = LIVE_STATUSES.has(short) ? 'LIVE'
      : FINISHED_STATUSES.has(short) ? 'FINISHED'
      : POSTPONED_STATUSES.has(short) ? 'POSTPONED'
      : 'SCHEDULED'
    const round = f.league.round.toLowerCase()
    const phase: Phase = round.includes('group') ? Phase.GROUP
      : round.includes('16') ? Phase.ROUND_OF_16
      : round.includes('quarter') ? Phase.QUARTER_FINAL
      : round.includes('semi') ? Phase.SEMI_FINAL
      : round.includes('3rd') || round.includes('third') ? Phase.THIRD_PLACE
      : round.includes('final') ? Phase.FINAL
      : Phase.GROUP
    return {
      externalId: String(f.fixture.id),
      homeTeamCode: f.teams.home.name.substring(0, 3).toUpperCase(),
      awayTeamCode: f.teams.away.name.substring(0, 3).toUpperCase(),
      kickoffAt: new Date(f.fixture.date),
      stadium: f.fixture.venue.name ?? undefined,
      city: f.fixture.venue.city ?? undefined,
      homeScore: f.goals.home ?? undefined,
      awayScore: f.goals.away ?? undefined,
      status,
      phase,
    }
  }

  async getMatches(): Promise<MatchData[]> {
    const fixtures = await this.fetch<ApiFixtureResponse[]>(`/fixtures?league=${this.leagueId}&season=${this.season}`)
    return fixtures.map(f => this.mapFixture(f))
  }

  async getLiveScores(): Promise<MatchData[]> {
    const fixtures = await this.fetch<ApiFixtureResponse[]>(`/fixtures?live=all&league=${this.leagueId}`)
    return fixtures.map(f => this.mapFixture(f))
  }

  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> { return {} }
}

// --- Factory ---

export function createFootballProvider(): FootballDataProvider {
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
