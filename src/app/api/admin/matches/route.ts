import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
  }

  const matches = await prisma.match.findMany({
    include: { homeTeam: true, awayTeam: true, group: true },
    orderBy: { kickoffAt: 'asc' },
  })

  return NextResponse.json({ matches })
}
