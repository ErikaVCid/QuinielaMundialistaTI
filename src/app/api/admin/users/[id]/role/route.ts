import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const { role } = await req.json()

  if (role !== 'ADMIN' && role !== 'USER') {
    return NextResponse.json({ message: 'Rol inválido' }, { status: 400 })
  }

  await prisma.user.update({ where: { id }, data: { role } })
  return NextResponse.json({ success: true })
}
