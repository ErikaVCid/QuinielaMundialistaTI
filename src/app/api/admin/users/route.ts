import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const { name, displayName, email, password, role } = await req.json() as {
    name: string; displayName: string; email: string; password: string; role?: string
  }

  if (!name || !email || !password || !displayName) {
    return NextResponse.json({ message: 'Todos los campos son requeridos' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ message: 'La contraseña debe tener mínimo 8 caracteres' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ message: 'Ya existe un usuario con ese correo' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
    },
  })

  await prisma.participant.create({
    data: { userId: user.id, displayName },
  })

  return NextResponse.json({ message: 'Usuario creado', userId: user.id }, { status: 201 })
}
