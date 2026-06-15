import { Phase } from '@prisma/client'

export interface MatchData {
  externalId: string
  homeTeamCode: string
  awayTeamCode: string
  kickoffAt: Date
  stadium?: string
  city?: string
  homeScore?: number
  awayScore?: number
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED'
  phase: Phase
  group?: string
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

// --- Mappings ---

const TEAM_NAME_TO_CODE: Record<string, string> = {
  'Mexico': 'MEX', 'Uruguay': 'URU', 'Kenya': 'KEN', 'Tahiti': 'TAH',
  'Argentina': 'ARG', 'Chile': 'CHI', 'Peru': 'PER', 'New Zealand': 'NZL',
  'United States': 'USA', 'Panama': 'PAN', 'Bolivia': 'BOL', 'Belarus': 'BLR',
  'Brazil': 'BRA', 'Paraguay': 'PAR', 'DR Congo': 'COD', 'Congo DR': 'COD',
  'South Sudan': 'SSD', 'France': 'FRA', 'Serbia': 'SRB', 'Cameroon': 'CMR',
  'Indonesia': 'IDN', 'Germany': 'GER', 'Croatia': 'CRO', 'Scotland': 'SCO',
  'South Africa': 'RSA', 'Spain': 'ESP', 'Greece': 'GRE', 'Portugal': 'POR',
  'Romania': 'ROU', 'Angola': 'ANG', 'Uzbekistan': 'UZB', 'England': 'ENG',
  'Belgium': 'BEL', 'Venezuela': 'VEN', 'Gambia': 'GAM', 'Netherlands': 'NED',
  'Colombia': 'COL', 'Senegal': 'SEN', 'Azerbaijan': 'AZE', 'Italy': 'ITA',
  'Ecuador': 'ECU', 'Nigeria': 'NGA', 'Trinidad and Tobago': 'TRI',
  'Canada': 'CAN', 'Morocco': 'MAR', 'Japan': 'JPN', 'Australia': 'AUS',
}

// api-football status short codes → our MatchStatus
const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])
const POSTPONED_STATUSES = new Set(['PST', 'CANC', 'ABD', 'AWD', 'WO'])

function mapStatus(short: string): MatchData['status'] {
  if (LIVE_STATUSES.has(short)) return 'LIVE'
  if (FINISHED_STATUSES.has(short)) return 'FINISHED'
  if (POSTPONED_STATUSES.has(short)) return 'POSTPONED'
  return 'SCHEDULED'
}

function mapRoundToPhase(round: string): Phase {
  const r = round.toLowerCase()
  if (r.includes('group')) return Phase.GROUP
  if (r.includes('round of 16') || r.includes('last 16')) return Phase.ROUND_OF_16
  if (r.includes('quarter')) return Phase.QUARTER_FINAL
  if (r.includes('semi')) return Phase.SEMI_FINAL
  if (r.includes('3rd') || r.includes('third') || r.includes('place')) return Phase.THIRD_PLACE
  if (r.includes('final')) return Phase.FINAL
  return Phase.GROUP
}

function teamNameToCode(name: string): string {
  return TEAM_NAME_TO_CODE[name] ?? name.substring(0, 3).toUpperCase()
}

// --- Mock provider (development / no API key) ---

class MockFootballProvider implements FootballDataProvider {
  async getMatches(): Promise<MatchData[]> { return [] }
  async getLiveScores(): Promise<MatchData[]> { return [] }
  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> { return {} }
}

class MockNewsProvider implements NewsDataProvider {
  async getLatestNews(_query?: string): Promise<NewsItem[]> {
    return [
      {
        title: 'FIFA World Cup 2026 arranca hoy con el partido inaugural',
        summary: 'México recibe a Kenia en el Estadio Azteca en el partido inaugural del Mundial 2026.',
        url: 'https://fifa.com',
        source: 'FIFA',
        publishedAt: new Date(),
        tags: ['FIFA', 'Mundial 2026', 'México'],
      },
    ]
  }
  async getNewsByTeam(_teamCode: string): Promise<NewsItem[]> { return [] }
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
  teams: {
    home: { name: string }
    away: { name: string }
  }
  goals: { home: number | null; away: number | null }
}

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
    const url = `https://v3.football.api-sports.io${path}`
    const res = await fetch(url, {
      headers: { 'x-apisports-key': this.apiKey },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error(`api-football error ${res.status}: ${path}`)
    const json = await res.json() as { response: T }
    return json.response
  }

  private mapFixture(f: ApiFixtureResponse): MatchData {
    return {
      externalId: String(f.fixture.id),
      homeTeamCode: teamNameToCode(f.teams.home.name),
      awayTeamCode: teamNameToCode(f.teams.away.name),
      kickoffAt: new Date(f.fixture.date),
      stadium: f.fixture.venue.name ?? undefined,
      city: f.fixture.venue.city ?? undefined,
      homeScore: f.goals.home ?? undefined,
      awayScore: f.goals.away ?? undefined,
      status: mapStatus(f.fixture.status.short),
      phase: mapRoundToPhase(f.league.round),
    }
  }

  async getMatches(): Promise<MatchData[]> {
    const fixtures = await this.fetch<ApiFixtureResponse[]>(
      `/fixtures?league=${this.leagueId}&season=${this.season}`
    )
    return fixtures.map(f => this.mapFixture(f))
  }

  async getLiveScores(): Promise<MatchData[]> {
    const fixtures = await this.fetch<ApiFixtureResponse[]>(
      `/fixtures?live=all&league=${this.leagueId}`
    )
    return fixtures.map(f => this.mapFixture(f))
  }

  async getMatchStats(externalId: string): Promise<Record<string, unknown>> {
    const stats = await this.fetch<unknown[]>(`/fixtures/statistics?fixture=${externalId}`)
    return { stats }
  }
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
    const name = Object.entries(TEAM_NAME_TO_CODE).find(([, code]) => code === teamCode)?.[0]
    return this.search(`FIFA World Cup 2026 ${name ?? teamCode}`)
  }
}

// --- Factory ---

export function createFootballProvider(): FootballDataProvider {
  const provider = process.env.FOOTBALL_API_PROVIDER ?? 'mock'
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
