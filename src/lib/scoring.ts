import { Phase } from '@prisma/client'

export interface ScoringConfig {
  exactScore: number
  correctResult: number
  goalDiff: number
  noMatch: number
  bonusMultiplier: number
}

export const DEFAULT_SCORING: ScoringConfig = {
  exactScore: 5,
  correctResult: 3,
  goalDiff: 1,
  noMatch: 0,
  bonusMultiplier: 1.0,
}

export function calcPoints(
  predHome: number,
  predAway: number,
  realHome: number,
  realAway: number,
  config: ScoringConfig = DEFAULT_SCORING
): number {
  if (predHome === realHome && predAway === realAway) {
    return Math.round(config.exactScore * config.bonusMultiplier)
  }

  const predResult = Math.sign(predHome - predAway)
  const realResult = Math.sign(realHome - realAway)

  if (predResult === realResult) {
    return Math.round(config.correctResult * config.bonusMultiplier)
  }

  const predDiff = Math.abs(predHome - predAway)
  const realDiff = Math.abs(realHome - realAway)

  if (predDiff === realDiff) {
    return Math.round(config.goalDiff * config.bonusMultiplier)
  }

  return config.noMatch
}

export function getPhaseMultiplier(phase: Phase): number {
  switch (phase) {
    case 'FINAL': return 3
    case 'SEMI_FINAL': return 2.5
    case 'QUARTER_FINAL': return 2
    case 'ROUND_OF_16': return 1.5
    default: return 1
  }
}
