import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Users, Calendar, Settings, Target, FileSpreadsheet, RefreshCw } from 'lucide-react'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/')

  const [totalUsers, totalPredictions, totalMatches, activeRule] = await Promise.all([
    prisma.user.count(),
    prisma.prediction.count(),
    prisma.match.count(),
    prisma.scoringRule.findFirst({ where: { isActive: true } }),
  ])

  const adminCards = [
    { href: '/admin/usuarios', icon: Users, label: 'Usuarios', desc: `${totalUsers} registrados`, color: 'text-blue-400' },
    { href: '/admin/partidos', icon: Calendar, label: 'Partidos', desc: `${totalMatches} en total`, color: 'text-green-400' },
    { href: '/admin/pronosticos', icon: Target, label: 'Pronósticos', desc: `${totalPredictions} registrados`, color: 'text-amber-400' },
    { href: '/admin/reglas', icon: Settings, label: 'Reglas de puntuación', desc: activeRule?.name ?? 'Sin regla activa', color: 'text-purple-400' },
    { href: '/admin/resultados', icon: RefreshCw, label: 'Cargar resultados', desc: 'Actualizar marcadores', color: 'text-red-400' },
    { href: '/admin/exportar', icon: FileSpreadsheet, label: 'Exportar Excel', desc: 'Descarga ranking y pronósticos', color: 'text-teal-400' },
  ]

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Panel de Administración</h1>
        <p className="text-gray-400 text-sm">Gestión completa de la quiniela</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminCards.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}>
            <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-6 match-card-hover cursor-pointer">
              <Icon className={`w-8 h-8 ${color} mb-4`} />
              <h3 className="text-white font-semibold mb-1">{label}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
