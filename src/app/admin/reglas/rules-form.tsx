'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2 } from 'lucide-react'

interface Rule {
  id: string
  name: string
  exactScore: number
  correctResult: number
  goalDiff: number
  noMatch: number
  bonusMultiplier: number
}

type RuleValues = {
  name: string
  exactScore: number
  correctResult: number
  goalDiff: number
  noMatch: number
  bonusMultiplier: number
}

function Field({
  label,
  field,
  min,
  max,
  step = 1,
  values,
  setValues,
}: {
  label: string
  field: keyof RuleValues
  min: number
  max: number
  step?: number
  values: RuleValues
  setValues: React.Dispatch<React.SetStateAction<RuleValues>>
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={values[field] as number}
        onChange={e => setValues(v => ({ ...v, [field]: +e.target.value }))}
        className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm"
      />
    </div>
  )
}

export function RulesForm({ activeRule }: { activeRule: Rule | undefined }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [values, setValues] = useState<RuleValues>({
    name: activeRule?.name ?? 'Reglas Estándar Mundial 2026',
    exactScore: activeRule?.exactScore ?? 5,
    correctResult: activeRule?.correctResult ?? 3,
    goalDiff: activeRule?.goalDiff ?? 1,
    noMatch: 0,
    bonusMultiplier: activeRule?.bonusMultiplier ?? 1.0,
  })

  async function handleSave() {
    setError('')
    setSaved(false)
    startTransition(async () => {
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, ruleId: activeRule?.id }),
      })
      if (!res.ok) {
        setError('Error al guardar reglas')
      } else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre de la regla</label>
        <input
          type="text"
          value={values.name}
          onChange={e => setValues(v => ({ ...v, name: e.target.value }))}
          className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Marcador exacto (pts)" field="exactScore" min={1} max={20} values={values} setValues={setValues} />
        <Field label="Resultado correcto (pts)" field="correctResult" min={1} max={15} values={values} setValues={setValues} />
        <Field label="Diferencia de goles (pts)" field="goalDiff" min={0} max={10} values={values} setValues={setValues} />
        <Field label="Multiplicador bonus" field="bonusMultiplier" min={1} max={5} step={0.5} values={values} setValues={setValues} />
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {saved && <div className="text-green-400 text-sm">✓ Reglas guardadas y activadas</div>}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar y activar reglas
      </button>
    </div>
  )
}
