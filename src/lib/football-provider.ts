export interface MatchData {
  externalId: string
  homeTeamCode: string
  awayTeamCode: string
  kickoffAt: Date
  stadium?: string
  city?: string
  homeScore?: number
  awayScore?: number
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED'
  phase: string
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

class MockFootballProvider implements FootballDataProvider {
  async getMatches(): Promise<MatchData[]> {
    return []
  }
  async getLiveScores(): Promise<MatchData[]> {
    return []
  }
  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> {
    return {}
  }
}

class MockNewsProvider implements NewsDataProvider {
  async getLatestNews(_query?: string): Promise<NewsItem[]> {
    return []
  }
  async getNewsByTeam(_teamCode: string): Promise<NewsItem[]> {
    return []
  }
}

class ApiFootballProvider implements FootballDataProvider {
  private apiKey: string
  private host: string

  constructor() {
    this.apiKey = process.env.FOOTBALL_API_KEY ?? ''
    this.host = process.env.FOOTBALL_API_HOST ?? 'v3.football.api-sports.io'
  }

  async getMatches(): Promise<MatchData[]> {
    // Implementation with API-Football v3
    return []
  }

  async getLiveScores(): Promise<MatchData[]> {
    return []
  }

  async getMatchStats(_externalId: string): Promise<Record<string, unknown>> {
    return {}
  }
}

export function createFootballProvider(): FootballDataProvider {
  const provider = process.env.FOOTBALL_API_PROVIDER ?? 'mock'
  switch (provider) {
    case 'api-football':
      return new ApiFootballProvider()
    default:
      return new MockFootballProvider()
  }
}

export function createNewsProvider(): NewsDataProvider {
  return new MockNewsProvider()
}
