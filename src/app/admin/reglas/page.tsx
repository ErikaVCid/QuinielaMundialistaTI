import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { RulesForm } from './rules-form'

export default async function AdminReglasPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')

  const rules = await prisma.scoringRule.findMany({ orderBy: { createdAt: 'desc' } })
  const activeRule = rules.find(r => r.isActive) ?? rules[0]

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Reglas de Puntuación</h1>
        <p className="text-gray-400 text-sm">Configura el sistema de puntos para la quiniela</p>
      </div>

      {/* Current active rule display */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
        <div className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-1">Regla activa</div>
        <div className="text-white font-bold">{activeRule?.name ?? 'Ninguna'}</div>
        {activeRule && (
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-amber-400 font-bold">{activeRule.exactScore} pts</span> <span className="text-gray-400">marcador exacto</span>
            <span className="text-green-400 font-bold">{activeRule.correctResult} pts</span> <span className="text-gray-400">resultado</span>
            <span className="text-blue-400 font-bold">{activeRule.goalDiff} pt</span> <span className="text-gray-400">diferencia</span>
          </div>
        )}
      </div>

      {/* Points explanation */}
      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-6 mb-6">
        <h2 className="text-white font-semibold mb-4">Sistema de puntuación</h2>
        <div className="space-y-3 text-sm">
          {[
            { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', pts: activeRule?.exactScore ?? 5, label: 'Marcador exacto', desc: 'Acertaste el resultado preciso del partido (ej: 2-1 y fue 2-1)' },
            { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', pts: activeRule?.correctResult ?? 3, label: 'Resultado correcto', desc: 'Acertaste quién ganó o que fue empate, pero no el marcador exacto' },
            { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', pts: activeRule?.goalDiff ?? 1, label: 'Diferencia de goles', desc: 'Acertaste la diferencia de goles pero no el resultado ni el marcador' },
            { color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20', pts: 0, label: 'Sin acierto', desc: 'No acertaste ninguno de los criterios anteriores' },
          ].map((r) => (
            <div key={r.label} className={`flex items-start gap-3 p-3 rounded-lg border ${r.bg}`}>
              <span className={`text-xl font-bold ${r.color} w-8 flex-shrink-0 text-center`}>{r.pts}</span>
              <div>
                <div className={`font-medium ${r.color}`}>{r.label}</div>
                <div className="text-gray-400 text-xs mt-0.5">{r.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-6">
        <h2 className="text-white font-semibold mb-4">Modificar puntuación</h2>
        <RulesForm activeRule={activeRule} />
      </div>
    </div>
  )
}
