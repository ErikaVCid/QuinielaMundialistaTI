/**
 * Genera predicciones IA para todos los partidos sin predicción (o con predicción antigua).
 * No toca predicciones marcadas como isManual=true.
 *   npm run predictions:generate
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generatePrediction } from '../src/lib/predictions'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  console.log('🤖  Generando predicciones IA...\n')

  // Partidos sin predicción IA o con predicción no manual que necesitan actualización
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

  console.log(`   ${matches.length} partidos sin predicción actualizada\n`)

  let created = 0, updated = 0, skipped = 0

  for (const match of matches) {
    // Skip manual predictions
    if (match.aiPrediction?.isManual) { skipped++; continue }

    const prediction = generatePrediction({
      matchId: match.id,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      phase: match.phase,
      isNeutralVenue: false,
    })

    try {
      if (match.aiPrediction) {
        await prisma.aiPrediction.update({
          where: { matchId: match.id },
          data: {
            predictedHomeGoals: prediction.predictedHomeGoals,
            predictedAwayGoals: prediction.predictedAwayGoals,
            predictedResult: prediction.predictedResult,
            homeWinProbability: prediction.homeWinProbability,
            drawProbability: prediction.drawProbability,
            awayWinProbability: prediction.awayWinProbability,
            confidence: prediction.confidence,
            modelVersion: prediction.modelVersion,
            explanation: prediction.explanation,
          },
        })
        updated++
      } else {
        await prisma.aiPrediction.create({
          data: {
            matchId: match.id,
            predictedHomeGoals: prediction.predictedHomeGoals,
            predictedAwayGoals: prediction.predictedAwayGoals,
            predictedResult: prediction.predictedResult,
            homeWinProbability: prediction.homeWinProbability,
            drawProbability: prediction.drawProbability,
            awayWinProbability: prediction.awayWinProbability,
            confidence: prediction.confidence,
            modelVersion: prediction.modelVersion,
            explanation: prediction.explanation,
          },
        })
        created++
      }

      console.log(
        `   ${prediction.predictedResult.padEnd(9)} ${match.homeTeam.name} ${prediction.predictedHomeGoals}-${prediction.predictedAwayGoals} ${match.awayTeam.name}` +
        `  (${prediction.homeWinProbability}/${prediction.drawProbability}/${prediction.awayWinProbability}) conf:${prediction.confidence}%`
      )
    } catch (e) {
      console.error(`   ⚠️  ${match.homeTeam.name} vs ${match.awayTeam.name}:`, (e as Error).message)
    }
  }

  console.log(`\n✅  ${created} creadas · ${updated} actualizadas · ${skipped} manuales omitidas`)
}

main()
  .catch(e => { console.error('Error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
