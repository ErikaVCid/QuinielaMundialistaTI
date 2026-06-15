import { getRanking, isHost } from './fifa-rankings'

export type PredictedResult = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN'

export interface AiPredictionInput {
  matchId: string
  homeTeamName: string
  awayTeamName: string
  phase: string
  isNeutralVenue?: boolean
}

export interface AiPredictionOutput {
  matchId: string
  predictedHomeGoals: number
  predictedAwayGoals: number
  predictedResult: PredictedResult
  homeWinProbability: number
  drawProbability: number
  awayWinProbability: number
  confidence: number
  modelVersion: string
  explanation: string
}

// ── Core engine ────────────────────────────────────────────────────────────────

export function generatePrediction(input: AiPredictionInput): AiPredictionOutput {
  const { matchId, homeTeamName, awayTeamName, phase, isNeutralVenue = false } = input

  const homeRank = getRanking(homeTeamName)
  const awayRank = getRanking(awayTeamName)

  // Convert ranking to strength: rank 1 → strength 100, rank 100 → strength 1
  const homeStrength = Math.max(1, 101 - homeRank)
  const awayStrength = Math.max(1, 101 - awayRank)

  // Home advantage: +8 strength for home nation, +4 for neutral host city
  const homeBoost = (!isNeutralVenue && isHost(homeTeamName)) ? 8
    : isHost(homeTeamName) ? 4
    : !isNeutralVenue ? 3   // generic home crowd advantage
    : 0

  const adjustedHome = homeStrength + homeBoost
  const total = adjustedHome + awayStrength

  // Raw win probabilities from strength ratio
  const rawHomePct = adjustedHome / total
  const rawAwayPct = awayStrength / total

  // Draw probability: highest when teams are close in strength
  const strengthDiff = Math.abs(rawHomePct - rawAwayPct)
  const drawBase = 0.26 - strengthDiff * 0.4   // 26% base draw rate at equal strength
  const drawPct = Math.max(0.05, Math.min(0.35, drawBase))

  // Redistribute win probabilities after accounting for draw
  const remaining = 1 - drawPct
  const homePct = rawHomePct * remaining
  const awayPct = rawAwayPct * remaining

  // Normalize to 100
  const sumCheck = homePct + drawPct + awayPct
  const homeWin = Math.round((homePct / sumCheck) * 100)
  const draw = Math.round((drawPct / sumCheck) * 100)
  const awayWin = 100 - homeWin - draw

  // Expected goals based on strength
  const phaseMultiplier = phaseGoalMultiplier(phase)
  const homeGoalsExpected = (adjustedHome / total) * 2.4 * phaseMultiplier
  const awayGoalsExpected = (awayStrength / total) * 1.8 * phaseMultiplier

  const predictedHomeGoals = Math.round(homeGoalsExpected)
  const predictedAwayGoals = Math.round(awayGoalsExpected)

  // Predicted result
  const predictedResult: PredictedResult =
    homeWin > awayWin && homeWin > draw ? 'HOME_WIN'
    : awayWin > homeWin && awayWin > draw ? 'AWAY_WIN'
    : 'DRAW'

  // Confidence: how dominant is the most likely outcome
  const maxProb = Math.max(homeWin, draw, awayWin)
  const confidence = Math.round(40 + (maxProb - 33) * 0.9)   // 40-70 range

  const explanation = buildExplanation({
    homeTeamName, awayTeamName, homeRank, awayRank,
    homeWin, draw: draw, awayWin,
    predictedHomeGoals, predictedAwayGoals, predictedResult,
    homeBoost, phase,
  })

  return {
    matchId,
    predictedHomeGoals,
    predictedAwayGoals,
    predictedResult,
    homeWinProbability: homeWin,
    drawProbability: draw,
    awayWinProbability: awayWin,
    confidence,
    modelVersion: 'v1',
    explanation,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function phaseGoalMultiplier(phase: string): number {
  switch (phase) {
    case 'FINAL': return 0.85
    case 'SEMI_FINAL': return 0.90
    case 'QUARTER_FINAL': return 0.92
    case 'ROUND_OF_16': return 0.95
    default: return 1.0
  }
}

interface ExplanationParams {
  homeTeamName: string; awayTeamName: string
  homeRank: number; awayRank: number
  homeWin: number; draw: number; awayWin: number
  predictedHomeGoals: number; predictedAwayGoals: number
  predictedResult: PredictedResult
  homeBoost: number; phase: string
}

function buildExplanation(p: ExplanationParams): string {
  const rankDiff = Math.abs(p.homeRank - p.awayRank)
  const stronger = p.homeRank < p.awayRank ? p.homeTeamName : p.awayTeamName
  const weaker = p.homeRank < p.awayRank ? p.awayTeamName : p.homeTeamName

  const parts: string[] = []

  if (rankDiff <= 5) {
    parts.push(`${p.homeTeamName} (FIFA #${p.homeRank}) y ${p.awayTeamName} (FIFA #${p.awayRank}) están muy igualados en el ranking.`)
  } else {
    parts.push(`${stronger} (FIFA #${Math.min(p.homeRank, p.awayRank)}) tiene ventaja sobre ${weaker} (FIFA #${Math.max(p.homeRank, p.awayRank)}).`)
  }

  if (p.homeBoost >= 4) {
    parts.push(`${p.homeTeamName} cuenta con ventaja de local como nación sede.`)
  } else if (p.homeBoost > 0) {
    parts.push(`${p.homeTeamName} tiene ligera ventaja de terreno.`)
  }

  const phaseLabels: Record<string, string> = {
    GROUP: 'fase de grupos', ROUND_OF_16: 'octavos de final',
    QUARTER_FINAL: 'cuartos de final', SEMI_FINAL: 'semifinal',
    THIRD_PLACE: 'tercer lugar', FINAL: 'la gran final',
  }
  parts.push(`En ${phaseLabels[p.phase] ?? p.phase}, el modelo estima ${p.predictedHomeGoals}-${p.predictedAwayGoals}.`)

  const resultLabel = p.predictedResult === 'HOME_WIN' ? `victoria de ${p.homeTeamName}`
    : p.predictedResult === 'AWAY_WIN' ? `victoria de ${p.awayTeamName}`
    : 'empate'

  parts.push(`Probabilidades: ${p.homeTeamName} ${p.homeWin}% · Empate ${p.draw}% · ${p.awayTeamName} ${p.awayWin}%. Resultado más probable: ${resultLabel}.`)

  return parts.join(' ')
}
