'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Lock } from 'lucide-react'

interface Team { id: string; name: string; flag: string | null; code: string }
interface PredictionData { homeScore: number; awayScore: number; isLocked: boolean }

interface Props {
  matchId: string
  participantId: string
  homeTeam: Team
  awayTeam: Team
  existingPrediction: PredictionData | null
  isLocked: boolean
}

function ScoreInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white flex items-center justify-center hover:bg-[#2a2a34] transition-all font-bold">
          –
        </button>
        <span className="w-12 text-center text-2xl font-bold text-white tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(20, value + 1))}
          className="w-8 h-8 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white flex items-center justify-center hover:bg-[#2a2a34] transition-all font-bold">
          +
        </button>
      </div>
    </div>
  )
}

export function PredictionForm({ matchId, participantId, homeTeam, awayTeam, existingPrediction, isLocked }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [homeScore, setHomeScore] = useState(existingPrediction?.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(existingPrediction?.awayScore ?? 0)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  if (isLocked && existingPrediction) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">{homeTeam.flag}</span>
          <span className="text-xl font-bold text-white tabular-nums">{existingPrediction.homeScore}</span>
          <span className="text-gray-500">–</span>
          <span className="text-xl font-bold text-white tabular-nums">{existingPrediction.awayScore}</span>
          <span className="text-lg">{awayTeam.flag}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Lock className="w-3 h-3" /> Pronóstico guardado
        </div>
      </div>
    )
  }

  if (isLocked && !existingPrediction) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm flex items-center justify-center gap-2">
        <Lock className="w-4 h-4" /> No registraste pronóstico para este partido.
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)

    startTransition(async () => {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, participantId, homeScore, awayScore }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.message ?? 'Error al guardar')
      } else {
        setSaved(true)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">{homeTeam.flag}</span>
          <span className="text-xs text-gray-400">{homeTeam.code}</span>
        </div>
        <ScoreInput value={homeScore} onChange={setHomeScore} label={homeTeam.name} />
        <span className="text-gray-500 text-xl">–</span>
        <ScoreInput value={awayScore} onChange={setAwayScore} label={awayTeam.name} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl">{awayTeam.flag}</span>
          <span className="text-xs text-gray-400">{awayTeam.code}</span>
        </div>
      </div>

      {error && <div className="text-center text-red-400 text-sm mb-3">{error}</div>}
      {saved && <div className="text-center text-green-400 text-sm mb-3">✓ Pronóstico guardado</div>}

      <div className="flex justify-center">
        <button type="submit" disabled={isPending}
          className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center gap-2">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {existingPrediction ? 'Actualizar pronóstico' : 'Guardar pronóstico'}
        </button>
      </div>
    </form>
  )
}
