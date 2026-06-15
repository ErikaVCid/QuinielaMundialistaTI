import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { name, email, password, displayName } = await req.json()

  if (!email || !password || !displayName) {
    return NextResponse.json({ message: 'Faltan campos requeridos' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ message: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ message: 'Este correo ya está registrado' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      participant: {
        create: { displayName },
      },
    },
  })

  return NextResponse.json({ id: user.id }, { status: 201 })
}
