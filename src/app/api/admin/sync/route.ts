import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { syncWorldCup26Full, syncWorldCup26Live } from '@/lib/worldcup26-sync'

// Full sync (teams + matches) — call from admin panel or on deploy
export async function POST() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const result = await syncWorldCup26Full()
  return NextResponse.json({ timestamp: new Date().toISOString(), result })
}

// Live scores update — lightweight, safe to call frequently
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const result = await syncWorldCup26Live()
  return NextResponse.json({ timestamp: new Date().toISOString(), result })
}
