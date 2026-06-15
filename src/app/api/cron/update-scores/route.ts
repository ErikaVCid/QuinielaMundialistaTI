import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // In production, call your football API provider here
  // For now, this endpoint exists to be called by external cron (e.g. vercel.json cron)
  const liveMatches = await prisma.match.findMany({
    where: { status: 'LIVE' },
    select: { id: true, externalId: true },
  })

  return NextResponse.json({
    updated: 0,
    liveMatches: liveMatches.length,
    timestamp: new Date().toISOString(),
  })
}
