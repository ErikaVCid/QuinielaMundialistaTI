import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
  }

  const { ruleId, name, exactScore, correctResult, goalDiff, noMatch, bonusMultiplier } = await req.json()

  // Deactivate all rules first
  await prisma.scoringRule.updateMany({ data: { isActive: false } })

  if (ruleId) {
    await prisma.scoringRule.update({
      where: { id: ruleId },
      data: { name, exactScore, correctResult, goalDiff, noMatch, bonusMultiplier, isActive: true },
    })
  } else {
    await prisma.scoringRule.create({
      data: { name, exactScore, correctResult, goalDiff, noMatch, bonusMultiplier, isActive: true },
    })
  }

  return NextResponse.json({ success: true })
}
