import { NextRequest, NextResponse } from 'next/server'
import { syncLiveScores, syncNews } from '@/lib/sync'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const [scoresResult, newsResult] = await Promise.allSettled([
    syncLiveScores(),
    syncNews(),
  ])

  const scores = scoresResult.status === 'fulfilled' ? scoresResult.value : { errors: [String(scoresResult.reason)] }
  const news = newsResult.status === 'fulfilled' ? newsResult.value : { errors: [String(newsResult.reason)] }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    scores,
    news,
  })
}

// Full sync (all matches, not just live) — call manually from admin or deploy
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  const { syncAllMatches } = await import('@/lib/sync')
  const result = await syncAllMatches()

  return NextResponse.json({ timestamp: new Date().toISOString(), result })
}
