// FIFA World Rankings — used by the AI prediction engine
// Based on approximate rankings for World Cup 2026 qualifying teams

export const fifaRankings: Record<string, number> = {
  // Top 10
  Argentina: 1,
  France: 2,
  Spain: 3,
  England: 4,
  Brazil: 5,
  Portugal: 6,
  Netherlands: 7,
  Belgium: 8,
  Italy: 9,
  Germany: 10,
  // 11-20
  Croatia: 11,
  Morocco: 12,
  Senegal: 13,
  'United States': 14,
  Mexico: 15,
  Colombia: 16,
  Uruguay: 17,
  Switzerland: 18,
  Japan: 19,
  'South Korea': 20,
  // 21-30
  Norway: 21,
  Turkey: 22,
  Australia: 23,
  Ecuador: 24,
  Serbia: 25,
  Canada: 26,
  Peru: 27,
  Chile: 28,
  Iran: 29,
  'Saudi Arabia': 30,
  // 31-50
  Cameroon: 31,
  Nigeria: 32,
  Tunisia: 33,
  Greece: 34,
  Scotland: 35,
  Algeria: 36,
  Austria: 37,
  'Ivory Coast': 38,
  Hungary: 39,
  'Costa Rica': 40,
  Romania: 41,
  'South Africa': 42,
  Ghana: 43,
  Uzbekistan: 44,
  'Czech Republic': 45,
  Sweden: 46,
  Panama: 47,
  Indonesia: 48,
  Bolivia: 49,
  Jordan: 50,
  // 51-70
  'Bosnia and Herzegovina': 51,
  Azerbaijan: 52,
  Venezuela: 53,
  Gambia: 54,
  Angola: 55,
  Kenya: 56,
  Honduras: 57,
  Qatar: 58,
  'DR Congo': 59,
  Paraguay: 60,
  'New Zealand': 61,
  Iraq: 62,
  Egypt: 63,
  'Trinidad and Tobago': 64,
  Haiti: 65,
  Tahiti: 66,
  Curaçao: 67,
  // Aliases — api-football may use different names
  'Congo DR': 59,
  "Côte d'Ivoire": 38,
  Korea: 20,
  'Bosnia-Herzegovina': 51,
  Curacao: 67,
}

export const DEFAULT_RANKING = 75

export function getRanking(teamName: string): number {
  return fifaRankings[teamName] ?? DEFAULT_RANKING
}

// Host nations get a +3 boost (home advantage)
const HOST_NATIONS = new Set(['Mexico', 'United States', 'Canada'])

export function isHost(teamName: string): boolean {
  return HOST_NATIONS.has(teamName)
}
