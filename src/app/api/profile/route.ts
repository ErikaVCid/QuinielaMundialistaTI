import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ message: 'No autorizado' }, { status: 401 })

  const { displayName } = await req.json()
  if (!displayName || displayName.length < 2 || displayName.length > 30) {
    return NextResponse.json({ message: 'Nombre inválido (2-30 caracteres)' }, { status: 400 })
  }

  await prisma.participant.update({
    where: { userId: session.user.id },
    data: { displayName },
  })

  return NextResponse.json({ success: true })
}
