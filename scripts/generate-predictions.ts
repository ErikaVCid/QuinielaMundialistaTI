/**
 * Genera predicciones IA para todos los partidos futuros.
 * Usa ranking FIFA local — no consume APIs externas.
 * No toca predicciones con isManual=true.
 *
 *   npm run predictions:generate
 *
 * Requiere: PREDICTION_PROVIDER="local-fifa-ranking" en .env.local
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generatePrediction } from '../src/lib/predictions'

// ── Validación de entorno ──────────────────────────────────────────────────────

const PREDICTION_PROVIDER = process.env.PREDICTION_PROVIDER ?? 'local-fifa-ranking'

if (PREDICTION_PROVIDER !== 'local-fifa-ranking') {
  console.error(`❌  PREDICTION_PROVIDER="${PREDICTION_PROVIDER}" no está soportado.`)
  console.error('   Usa: PREDICTION_PROVIDER="local-fifa-ranking"')
  process.exit(1)
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🤖  Motor de predicciones: ${PREDICTION_PROVIDER}\n`)

  const matches = await prisma.match.findMany({
    where: {
      status: { in: ['SCHEDULED', 'LIVE'] },
      OR: [
        { aiPrediction: null },
        { aiPrediction: { isManual: false } },
      ],
    },
    include: {
      homeTeam: { select: { name: true, code: true } },
      awayTeam: { select: { name: true, code: true } },
      aiPrediction: { select: { isManual: true } },
    },
    orderBy: { kickoffAt: 'asc' },
  })

  console.log(`   ${matches.length} partidos pendientes de predicción\n`)

  let upserted = 0, skipped = 0, errors = 0

  for (const match of matches) {
    if (match.aiPrediction?.isManual) { skipped++; continue }

    const pred = generatePrediction({
      matchId: match.id,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      phase: match.phase,
      isNeutralVenue: false,
    })

    const data = {
      predictedHomeGoals:  pred.predictedHomeGoals,
      predictedAwayGoals:  pred.predictedAwayGoals,
      predictedResult:     pred.predictedResult,
      homeWinProbability:  pred.homeWinProbability,
      drawProbability:     pred.drawProbability,
      awayWinProbability:  pred.awayWinProbability,
      confidence:          pred.confidence,
      modelVersion:        pred.modelVersion,
      explanation:         pred.explanation,
    }

    try {
      await prisma.aiPrediction.upsert({
        where:  { matchId: match.id },
        update: data,
        create: { matchId: match.id, ...data },
      })

      const result = pred.predictedResult.padEnd(9)
      const score  = `${pred.predictedHomeGoals}-${pred.predictedAwayGoals}`
      const probs  = `${pred.homeWinProbability}/${pred.drawProbability}/${pred.awayWinProbability}`
      console.log(`   ${result} ${match.homeTeam.name} ${score} ${match.awayTeam.name}  (${probs}) conf:${pred.confidence}%`)
      upserted++
    } catch (e) {
      console.error(`   ⚠️  ${match.homeTeam.name} vs ${match.awayTeam.name}: ${(e as Error).message}`)
      errors++
    }
  }

  console.log(`\n✅  ${upserted} predicciones upserted · ${skipped} manuales omitidas · ${errors} errores`)
}

main()
  .catch(e => { console.error('❌  Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
