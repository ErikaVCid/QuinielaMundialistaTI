import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ message: 'No autorizado' }, { status: 403 })
  }

  const type = req.nextUrl.searchParams.get('type') ?? 'ranking'

  let wb: XLSX.WorkBook
  let filename: string

  if (type === 'ranking') {
    const participants = await prisma.participant.findMany({
      include: { user: { select: { email: true } } },
      orderBy: [{ totalPoints: 'desc' }, { exactHits: 'desc' }],
    })

    let pos = 1
    const rows = participants.map((p, i) => {
      if (i > 0) {
        const prev = participants[i - 1]
        if (p.totalPoints !== prev.totalPoints || p.exactHits !== prev.exactHits) pos = i + 1
      }
      return {
        Posición: pos,
        Participante: p.displayName,
        Email: p.user.email,
        Puntos: p.totalPoints,
        'Exactos': p.exactHits,
        'Resultados': p.resultHits,
      }
    })

    const ws = XLSX.utils.json_to_sheet(rows)
    wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ranking')
    filename = 'ranking-mundial-2026.xlsx'

  } else if (type === 'predictions') {
    const predictions = await prisma.prediction.findMany({
      include: {
        participant: true,
        match: { include: { homeTeam: true, awayTeam: true } },
      },
      orderBy: [{ match: { kickoffAt: 'asc' } }, { participant: { totalPoints: 'desc' } }],
    })

    const rows = predictions.map((p) => ({
      Fecha: p.match.kickoffAt.toISOString().slice(0, 10),
      Partido: `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`,
      Participante: p.participant.displayName,
      'Pronóstico': `${p.homeScore}-${p.awayScore}`,
      'Resultado real': p.match.homeScore !== null ? `${p.match.homeScore}-${p.match.awayScore}` : 'Pendiente',
      Puntos: p.points ?? 0,
      Bloqueado: p.isLocked ? 'Sí' : 'No',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pronósticos')
    filename = 'pronosticos-mundial-2026.xlsx'

  } else {
    const participants = await prisma.participant.findMany({
      include: { user: { select: { email: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const rows = participants.map((p) => ({
      Participante: p.displayName,
      Email: p.user.email,
      Puntos: p.totalPoints,
      Exactos: p.exactHits,
      Resultados: p.resultHits,
      Posición: p.position ?? '—',
      'Registro': p.user.createdAt.toISOString().slice(0, 10),
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Participantes')
    filename = 'participantes-mundial-2026.xlsx'
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
