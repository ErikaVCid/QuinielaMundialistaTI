import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

const PROTECTED_ADMIN = process.env.PROTECTED_ADMIN_EMAIL ?? ''

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const { role } = await req.json() as { role: string }

  if (role !== 'ADMIN' && role !== 'USER') {
    return NextResponse.json({ message: 'Rol inválido' }, { status: 400 })
  }

  // Find target user
  const target = await prisma.user.findUnique({ where: { id }, select: { email: true } })
  if (!target) return NextResponse.json({ message: 'Usuario no encontrado' }, { status: 404 })

  // Lock: the protected admin can never be demoted
  if (target.email === PROTECTED_ADMIN && role === 'USER') {
    return NextResponse.json(
      { message: 'Este usuario es el administrador principal y no puede ser demovido.' },
      { status: 403 }
    )
  }

  // Lock: no one else can be promoted to ADMIN
  if (target.email !== PROTECTED_ADMIN && role === 'ADMIN') {
    return NextResponse.json(
      { message: 'Solo el administrador principal puede tener rol ADMIN.' },
      { status: 403 }
    )
  }

  await prisma.user.update({ where: { id }, data: { role } })
  return NextResponse.json({ success: true })
}
